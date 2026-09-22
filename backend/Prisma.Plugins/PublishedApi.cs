using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Prisma.Plugins
{
    [DataContract]
    public sealed class PublishedCredit
    {
        [DataMember(Name = "name")] public string Name { get; set; }
        [DataMember(Name = "hours")] public decimal? Hours { get; set; }
        [DataMember(Name = "email", EmitDefaultValue = false)] public string Email { get; set; }
        [DataMember(Name = "effort", EmitDefaultValue = false)] public ContributorInput Effort { get; set; }
    }

    [DataContract]
    public sealed class PublishedDetail
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "rowVersion")] public string RowVersion { get; set; }
        [DataMember(Name = "contributors")] public PublishedCredit[] Contributors { get; set; }
        [DataMember(Name = "totalHours")] public decimal TotalHours { get; set; }
        [DataMember(Name = "projects")] public string[] Projects { get; set; }
        [DataMember(Name = "media")] public MediaSnapshot[] Media { get; set; }
        [DataMember(Name = "libraryNotes", EmitDefaultValue = false)] public string LibraryNotes { get; set; }
    }

    public sealed class PublishedApi : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.MessageName != "nx_GetPublishedDetail") throw MediaPolicy.Invalid("Invalid published-detail operation.");
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            var identifier = (Guid)context.InputParameters["SolutionId"];
            var present = (bool)context.InputParameters["Present"];
            var query = new QueryExpression("nx_solution") { ColumnSet = new ColumnSet("nx_status", "nx_publicationstatus", "nx_clientsafereviewed"), TopCount = 1 };
            if (!present) query.ColumnSet.AddColumn("nx_librarynote");
            query.Criteria.AddCondition("nx_solutionid", ConditionOperator.Equal, identifier);
            query.Criteria.AddCondition("nx_publicationstatus", ConditionOperator.Equal, ReviewPolicy.Published);
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            if (present)
            {
                query.Criteria.AddCondition("nx_clientsafereviewed", ConditionOperator.Equal, true);
                query.Criteria.AddCondition("nx_safetyacknowledged", ConditionOperator.Equal, true);
            }
            var parent = caller.RetrieveMultiple(query).Entities.SingleOrDefault();
            if (parent == null) throw MediaPolicy.Invalid("Published detail is unavailable in this mode.");
            var graph = DraftGraph.Read(caller, parent);
            var credits = new List<PublishedCredit>();
            var totalHours = 0m;
            foreach (var person in graph.Graph.Contributors)
            {
                var consultant = caller.Retrieve("cr6b0_consultant", Guid.Parse(person.PersonId), present ? new ColumnSet("cr6b0_consultantname") : new ColumnSet("cr6b0_consultantname", "cr6b0_email"));
                var hours = ContributorPolicy.Hours(person, parent.GetAttributeValue<OptionSetValue>("nx_status").Value);
                if (!hours.HasValue) throw MediaPolicy.Invalid("Published contributor effort is incomplete.");
                totalHours += hours.Value;
                credits.Add(new PublishedCredit { Name = consultant.GetAttributeValue<string>("cr6b0_consultantname") ?? "Consultant", Hours = present ? null : hours,
                    Email = present ? null : consultant.GetAttributeValue<string>("cr6b0_email"), Effort = present ? null : person });
            }
            var projects = new List<string>();
            if (!present)
                foreach (var project in graph.Graph.ProjectIds)
                {
                    var row = caller.Retrieve("cr6b0_project", Guid.Parse(project), new ColumnSet("cr6b0_projecttitle"));
                    projects.Add(row.GetAttributeValue<string>("cr6b0_projecttitle") ?? "Untitled project");
                }
            var media = MediaApi.Sessions(factory.CreateOrganizationService(null), identifier);
            if (media.Any(row => !row.GetAttributeValue<bool>("nx_complete"))) throw MediaPolicy.Invalid("Published media is incomplete.");
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new PublishedDetail {
                Id = identifier.ToString(), RowVersion = parent.RowVersion, Contributors = credits.ToArray(), TotalHours = totalHours, Projects = projects.ToArray(), Media = media.Select(row => MediaApi.Snapshot(caller, row)).OrderBy(item => item.SortOrder).ThenBy(item => item.Id).ToArray(),
                LibraryNotes = present ? null : parent.GetAttributeValue<string>("nx_librarynote")
            });
        }
    }
}