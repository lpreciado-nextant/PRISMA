using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Prisma.Plugins
{
    [DataContract]
    public sealed class SuggestionCreated
    {
        [DataMember(Name = "id")] public string Id { get; set; }
    }

    [DataContract]
    public sealed class SuggestionEntry
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "text")] public string Text { get; set; }
        [DataMember(Name = "author")] public string Author { get; set; }
        [DataMember(Name = "createdOn")] public string CreatedOn { get; set; }
    }

    [DataContract]
    public sealed class SuggestionList
    {
        /// <summary>False for anyone who is not the owner, a contributor or the PRISMA Librarian; the list is then empty.</summary>
        [DataMember(Name = "canRead")] public bool CanRead { get; set; }
        [DataMember(Name = "suggestions")] public List<SuggestionEntry> Suggestions { get; set; }
    }

    /// <summary>Validation for private change suggestions on published solutions (`nx_solutionsuggestion`).</summary>
    public static class SuggestionPolicy
    {
        public const string SuggestMessage = "nx_SuggestChange";
        public const string ListMessage = "nx_GetSolutionSuggestions";
        public const int MaxLength = 1000;
        public const int ListLimit = 200;

        public static string CleanText(string raw)
        {
            var text = (raw ?? "").Trim();
            if (text.Length == 0) throw Invalid("Write a suggestion before sending it.");
            if (text.Length > MaxLength) throw Invalid("A suggestion can be up to " + MaxLength + " characters.");
            if (text.Any(character => char.IsControl(character) && character != '\n' && character != '\r' && character != '\t'))
                throw Invalid("A suggestion cannot contain control characters.");
            return text;
        }

        /// <summary>The row's primary name, for Dataverse lists only; the app never shows it.</summary>
        public static string Name(string solutionName)
        {
            var name = "Suggestion · " + (solutionName ?? "").Trim();
            return name.Length <= 100 ? name : name.Substring(0, 100);
        }

        /// <summary>Owner, any contributor and the PRISMA Librarian read a solution's suggestions; nobody else.</summary>
        public static bool CanRead(bool owner, bool contributor, bool librarian) { return owner || contributor || librarian; }

        private static InvalidPluginExecutionException Invalid(string message) { return new InvalidPluginExecutionException(message); }
    }

    /// <summary>
    /// Private suggestions on published solutions, separate from the librarian review. Anyone who can read a
    /// Published, active solution may send one, its owner included. Only the owner, its contributors and the PRISMA
    /// Librarian may list them. The caller proves Read on the solution; the table itself is read and written as the
    /// server, so no role carries privileges on it and nobody can read another person's suggestions directly.
    /// </summary>
    public sealed class SuggestionApi : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            var server = factory.CreateOrganizationService(null);
            var solutionId = (Guid)context.InputParameters["SolutionId"];
            // Throws for a solution the caller cannot read.
            var solution = caller.Retrieve("nx_solution", solutionId, new ColumnSet("nx_solutionname", "nx_publicationstatus", "statecode", "ownerid"));
            var owner = solution.GetAttributeValue<EntityReference>("ownerid")?.Id == context.InitiatingUserId;
            if (context.MessageName == SuggestionPolicy.SuggestMessage) { Suggest(context, server, solution); return; }
            if (context.MessageName == SuggestionPolicy.ListMessage) { List(context, server, solution, owner); return; }
            throw new InvalidPluginExecutionException("Invalid PRISMA suggestion registration.");
        }

        private static void Suggest(IPluginExecutionContext context, IOrganizationService server, Entity solution)
        {
            if (solution.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value != ReviewPolicy.Published || solution.GetAttributeValue<OptionSetValue>("statecode")?.Value != 0)
                throw new InvalidPluginExecutionException("Only published solutions accept suggestions.");
            var text = SuggestionPolicy.CleanText(context.InputParameters["Text"] as string);
            var consultantId = FavoriteApi.ResolveConsultant(server, context.InitiatingUserId);
            var id = server.Create(new Entity("nx_solutionsuggestion") {
                ["nx_name"] = SuggestionPolicy.Name(solution.GetAttributeValue<string>("nx_solutionname")),
                ["nx_solution"] = solution.ToEntityReference(),
                ["nx_suggestion"] = text,
                ["nx_suggestedby"] = new EntityReference("cr6b0_consultant", consultantId),
                // The author owns the row; Assign does not cascade from the solution, so it stays theirs.
                ["ownerid"] = new EntityReference("systemuser", context.InitiatingUserId)
            });
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new SuggestionCreated { Id = id.ToString() });
        }

        private static void List(IPluginExecutionContext context, IOrganizationService server, Entity solution, bool owner)
        {
            var readable = SuggestionPolicy.CanRead(owner, IsContributor(server, solution.Id, context.InitiatingUserId), ReviewApi.IsLibrarian(server, context.InitiatingUserId));
            var result = new SuggestionList { CanRead = readable, Suggestions = new List<SuggestionEntry>() };
            if (readable)
            {
                var query = new QueryExpression("nx_solutionsuggestion") { ColumnSet = new ColumnSet("nx_suggestion", "createdon"), TopCount = SuggestionPolicy.ListLimit };
                query.Criteria.AddCondition("nx_solution", ConditionOperator.Equal, solution.Id);
                query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
                query.Orders.Add(new OrderExpression("createdon", OrderType.Descending));
                var author = query.AddLink("cr6b0_consultant", "nx_suggestedby", "cr6b0_consultantid", JoinOperator.LeftOuter);
                author.EntityAlias = "author";
                author.Columns = new ColumnSet("cr6b0_consultantname");
                result.Suggestions = server.RetrieveMultiple(query).Entities.Select(row => new SuggestionEntry {
                    Id = row.Id.ToString(),
                    Text = row.GetAttributeValue<string>("nx_suggestion") ?? "",
                    Author = (row.GetAttributeValue<AliasedValue>("author.cr6b0_consultantname")?.Value as string) ?? "Unknown consultant",
                    CreatedOn = row.GetAttributeValue<DateTime>("createdon").ToUniversalTime().ToString("o")
                }).ToList();
            }
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(result);
        }

        /// <summary>Whether the caller's consultant record is credited on the solution. Callers without one are not contributors.</summary>
        private static bool IsContributor(IOrganizationService server, Guid solutionId, Guid userId)
        {
            Guid consultantId;
            try { consultantId = FavoriteApi.ResolveConsultant(server, userId); }
            catch (InvalidPluginExecutionException) { return false; }
            var query = new QueryExpression("nx_solutioncontributor") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            query.Criteria.AddCondition("nx_solution", ConditionOperator.Equal, solutionId);
            query.Criteria.AddCondition("nx_builtby", ConditionOperator.Equal, consultantId);
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            return server.RetrieveMultiple(query).Entities.Count > 0;
        }
    }
}
