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
        /// <summary>When the owner or a contributor marked it addressed (`nx_addressedon`); null while open.</summary>
        [DataMember(Name = "addressedOn")] public string AddressedOn { get; set; }
    }

    [DataContract]
    public sealed class SuggestionAddressed
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "addressedOn")] public string AddressedOn { get; set; }
    }

    [DataContract]
    public sealed class OpenSuggestion
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "solutionId")] public string SolutionId { get; set; }
    }

    /// <summary>The caller's open feedback in one read: unaddressed suggestions on their published solutions, and their returned drafts.</summary>
    [DataContract]
    public sealed class OpenFeedback
    {
        [DataMember(Name = "suggestions")] public List<OpenSuggestion> Suggestions { get; set; }
        [DataMember(Name = "changesRequested")] public List<string> ChangesRequested { get; set; }
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
        public const string AddressMessage = "nx_AddressSuggestion";
        public const string OpenFeedbackMessage = "nx_GetMyOpenFeedback";
        public const int ChangesRequested = 125060001;
        public const int OpenLimit = 500;
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

        /// <summary>The solution's team (owner and contributors) mark suggestions addressed; the librarian reads but does not.</summary>
        public static bool CanAddress(bool owner, bool contributor) { return owner || contributor; }

        public static string Timestamp(DateTime? value) { return value.HasValue ? value.Value.ToUniversalTime().ToString("o") : null; }

        private static InvalidPluginExecutionException Invalid(string message) { return new InvalidPluginExecutionException(message); }
    }

    /// <summary>
    /// Private suggestions on published solutions, separate from the librarian review. Anyone who can read a
    /// Published, active solution may send one, its owner included. Only the owner, its contributors and the PRISMA
    /// Librarian may list them; the owner and contributors mark each one addressed. The caller proves Read on the solution; the table itself is read and written as the
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
            if (context.MessageName == SuggestionPolicy.OpenFeedbackMessage) { OpenFeedbackFor(context, server); return; }
            if (context.MessageName == SuggestionPolicy.AddressMessage) { Address(context, caller, server); return; }
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
                var query = new QueryExpression("nx_solutionsuggestion") { ColumnSet = new ColumnSet("nx_suggestion", "createdon", "nx_addressedon"), TopCount = SuggestionPolicy.ListLimit };
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
                    CreatedOn = row.GetAttributeValue<DateTime>("createdon").ToUniversalTime().ToString("o"),
                    AddressedOn = SuggestionPolicy.Timestamp(row.GetAttributeValue<DateTime?>("nx_addressedon"))
                }).ToList();
            }
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(result);
        }

        /// <summary>
        /// Marks one suggestion addressed (now) or open again. The caller proves Read on its solution and must be its owner
        /// or a contributor; the row is written as the server, like every other suggestion write.
        /// </summary>
        private static void Address(IPluginExecutionContext context, IOrganizationService caller, IOrganizationService server)
        {
            var suggestionId = (Guid)context.InputParameters["SuggestionId"];
            var addressed = (bool)context.InputParameters["Addressed"];
            var suggestion = server.Retrieve("nx_solutionsuggestion", suggestionId, new ColumnSet("nx_solution", "statecode"));
            var solutionRef = suggestion.GetAttributeValue<EntityReference>("nx_solution");
            if (solutionRef == null || suggestion.GetAttributeValue<OptionSetValue>("statecode")?.Value != 0) throw new InvalidPluginExecutionException("This suggestion is no longer available.");
            // Throws for a solution the caller cannot read.
            var solution = caller.Retrieve("nx_solution", solutionRef.Id, new ColumnSet("ownerid"));
            var owner = solution.GetAttributeValue<EntityReference>("ownerid")?.Id == context.InitiatingUserId;
            if (!SuggestionPolicy.CanAddress(owner, owner || IsContributor(server, solution.Id, context.InitiatingUserId)))
                throw new InvalidPluginExecutionException("Only the solution's owner or contributors can mark its suggestions as addressed.");
            DateTime? addressedOn = addressed ? DateTime.UtcNow : (DateTime?)null;
            server.Update(new Entity("nx_solutionsuggestion", suggestionId) { ["nx_addressedon"] = addressedOn });
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new SuggestionAddressed { Id = suggestionId.ToString(), AddressedOn = SuggestionPolicy.Timestamp(addressedOn) });
        }

        /// <summary>
        /// The caller's open feedback in one read, for the masthead count: unaddressed suggestions on the active published
        /// solutions they own, and their drafts returned with Changes requested. Filtered by the caller as owner, so it
        /// never reveals anyone else's rows even though it reads as the server.
        /// </summary>
        private static void OpenFeedbackFor(IPluginExecutionContext context, IOrganizationService server)
        {
            var suggestions = new QueryExpression("nx_solutionsuggestion") { ColumnSet = new ColumnSet("nx_solution"), TopCount = SuggestionPolicy.OpenLimit };
            suggestions.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            suggestions.Criteria.AddCondition("nx_addressedon", ConditionOperator.Null);
            var parent = suggestions.AddLink("nx_solution", "nx_solution", "nx_solutionid", JoinOperator.Inner);
            parent.LinkCriteria.AddCondition("ownerid", ConditionOperator.Equal, context.InitiatingUserId);
            parent.LinkCriteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            parent.LinkCriteria.AddCondition("nx_publicationstatus", ConditionOperator.Equal, ReviewPolicy.Published);
            var returned = new QueryExpression("nx_solution") { ColumnSet = new ColumnSet(false), TopCount = SuggestionPolicy.OpenLimit };
            returned.Criteria.AddCondition("ownerid", ConditionOperator.Equal, context.InitiatingUserId);
            returned.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            returned.Criteria.AddCondition("nx_publicationstatus", ConditionOperator.Equal, DraftPolicy.DraftStatus);
            returned.Criteria.AddCondition("nx_reviewoutcome", ConditionOperator.Equal, SuggestionPolicy.ChangesRequested);
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new OpenFeedback {
                Suggestions = server.RetrieveMultiple(suggestions).Entities.Select(row => new OpenSuggestion { Id = row.Id.ToString(), SolutionId = row.GetAttributeValue<EntityReference>("nx_solution")?.Id.ToString() }).ToList(),
                ChangesRequested = server.RetrieveMultiple(returned).Entities.Select(row => row.Id.ToString()).ToList()
            });
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
