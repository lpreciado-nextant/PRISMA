using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

namespace Prisma.Plugins
{
    public sealed class DraftApi : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            if (context.MessageName == DraftPolicy.ListMessage)
            {
                List(context, caller);
                return;
            }
            if (context.MessageName != DraftPolicy.SaveMessage || !context.IsInTransaction)
                throw new InvalidPluginExecutionException("Use the transactional PRISMA draft operation.");
            var input = DraftPolicy.Parse(context.InputParameters.Contains("DraftJson") ? context.InputParameters["DraftJson"] as string : null);
            var capability = input.GetAttributeValue<EntityReference>("nx_capability");
            if (capability != null) caller.Retrieve(capability.LogicalName, capability.Id, new ColumnSet(false));
            var identifier = context.InputParameters.Contains("SolutionId") ? (Guid)context.InputParameters["SolutionId"] : Guid.Empty;
            var expectedVersion = context.InputParameters.Contains("ExpectedRowVersion") ? context.InputParameters["ExpectedRowVersion"] as string : null;
            if (identifier == Guid.Empty)
            {
                if (!string.IsNullOrEmpty(expectedVersion)) throw new InvalidPluginExecutionException("A new draft cannot have a row version.");
                input["ownerid"] = new EntityReference("systemuser", context.InitiatingUserId);
                input["nx_dateadded"] = DateTime.UtcNow;
                identifier = caller.Create(input);
            }
            else
            {
                var server = factory.CreateOrganizationService(null);
                var current = caller.Retrieve("nx_solution", identifier, new ColumnSet(DraftPolicy.CoreColumns.Concat(new[] { "ownerid", "nx_publicationstatus" }).ToArray()));
                var mode = DraftPolicy.Editable(current, context.InitiatingUserId, expectedVersion, () => ReviewApi.IsLibrarian(server, context.InitiatingUserId));
                // The owner's safety acknowledgment covers what they submitted; a librarian never sets or clears it.
                if (mode == EditMode.Librarian) input.Attributes.Remove("nx_safetyacknowledged");
                var changed = DraftPolicy.Changed(current, input);
                input.Id = identifier;
                input.RowVersion = expectedVersion;
                caller.Execute(new UpdateRequest { Target = input, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
                if (mode == EditMode.Librarian)
                {
                    // Pending review and Published records keep their status; only a real change is recorded.
                    if (changed) server.Update(DraftPolicy.LibrarianEdit(identifier, current.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value, DraftPolicy.Editor(server, context.InitiatingUserId), DateTime.UtcNow));
                    context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(Snapshot(caller.Retrieve("nx_solution", identifier, Columns())));
                    return;
                }
            }
            var protectedUpdate = new Entity("nx_solution", identifier) {
                ["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus),
                ["nx_clientsafereviewed"] = false
            };
            factory.CreateOrganizationService(null).Update(protectedUpdate);
            var saved = caller.Retrieve("nx_solution", identifier, Columns());
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(Snapshot(saved));
        }

        private static void List(IPluginExecutionContext context, IOrganizationService caller)
        {
            var page = DraftPolicy.NormalizePage(context.InputParameters.Contains("PageNumber") ? (int)context.InputParameters["PageNumber"] : 0);
            var cookie = context.InputParameters.Contains("PagingCookie") ? context.InputParameters["PagingCookie"] as string : null;
            if (page > 1 && string.IsNullOrWhiteSpace(cookie)) throw new InvalidPluginExecutionException("Missing draft page token.");
            var query = new QueryExpression("nx_solution") {
                ColumnSet = Columns(),
                PageInfo = new PagingInfo { Count = 100, PageNumber = page, PagingCookie = cookie }
            };
            query.Criteria.AddCondition("ownerid", ConditionOperator.Equal, context.InitiatingUserId);
            query.Criteria.AddCondition("nx_publicationstatus", ConditionOperator.Equal, DraftPolicy.DraftStatus);
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            query.Orders.Add(new OrderExpression("nx_solutionid", OrderType.Ascending));
            var result = caller.RetrieveMultiple(query);
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new DraftPage {
                Records = result.Entities.Select(Snapshot).ToList(),
                MoreRecords = result.MoreRecords,
                PagingCookie = result.PagingCookie
            });
        }

        private static ColumnSet Columns() { return new ColumnSet(DraftPolicy.CoreColumns); }

        public static DraftSnapshot Snapshot(Entity record)
        {
            if (string.IsNullOrEmpty(record.RowVersion)) throw new InvalidPluginExecutionException("Draft row-version metadata is unavailable.");
            return new DraftSnapshot {
                Id = record.Id.ToString(), RowVersion = record.RowVersion,
                Name = record.GetAttributeValue<string>("nx_solutionname") ?? "",
                Summary = record.GetAttributeValue<string>("nx_onelinesummary") ?? "",
                CapabilityId = record.GetAttributeValue<EntityReference>("nx_capability")?.Id.ToString() ?? "",
                Maturity = record.GetAttributeValue<OptionSetValue>("nx_status")?.Value ?? 125060004,
                WhatItDoes = record.GetAttributeValue<string>("nx_whatitdoes") ?? "",
                BusinessValue = record.GetAttributeValue<string>("nx_businessvalue") ?? "",
                ClientContext = record.GetAttributeValue<string>("nx_clientcontext") ?? "",
                ClientContextRedacted = record.GetAttributeValue<string>("nx_clientcontextredacted") ?? "",
                Challenges = record.GetAttributeValue<string>("nx_challenges") ?? "",
                LessonsLearned = record.GetAttributeValue<string>("nx_lessonslearned") ?? "",
                SafetyAcknowledged = record.GetAttributeValue<bool>("nx_safetyacknowledged"),
                EstimatedMinimumHours = record.GetAttributeValue<int?>("nx_estimatedminimumhours"),
                ComplexityValue = record.GetAttributeValue<OptionSetValue>("nx_complexity")?.Value
            };
        }
    }

    [DataContract]
    public sealed class DraftPage
    {
        [DataMember(Name = "records")] public List<DraftSnapshot> Records { get; set; }
        [DataMember(Name = "moreRecords")] public bool MoreRecords { get; set; }
        [DataMember(Name = "pagingCookie")] public string PagingCookie { get; set; }
    }

    [DataContract]
    public sealed class DraftSnapshot
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "rowVersion")] public string RowVersion { get; set; }
        [DataMember(Name = "name")] public string Name { get; set; }
        [DataMember(Name = "summary")] public string Summary { get; set; }
        [DataMember(Name = "capabilityId")] public string CapabilityId { get; set; }
        [DataMember(Name = "maturity")] public int Maturity { get; set; }
        [DataMember(Name = "whatItDoes")] public string WhatItDoes { get; set; }
        [DataMember(Name = "businessValue")] public string BusinessValue { get; set; }
        [DataMember(Name = "clientContext")] public string ClientContext { get; set; }
        [DataMember(Name = "clientContextRedacted")] public string ClientContextRedacted { get; set; }
        [DataMember(Name = "challenges")] public string Challenges { get; set; }
        [DataMember(Name = "lessonsLearned")] public string LessonsLearned { get; set; }
        [DataMember(Name = "safetyAcknowledged")] public bool SafetyAcknowledged { get; set; }
        /// <summary>`nx_estimatedminimumhours`: whole-hour estimate for the whole solution. Internal only.</summary>
        [DataMember(Name = "estimatedMinimumHours", EmitDefaultValue = false)] public int? EstimatedMinimumHours { get; set; }
        /// <summary>`nx_complexity`: Easy, Medium or Hard. Internal only.</summary>
        [DataMember(Name = "complexityValue", EmitDefaultValue = false)] public int? ComplexityValue { get; set; }
    }
}