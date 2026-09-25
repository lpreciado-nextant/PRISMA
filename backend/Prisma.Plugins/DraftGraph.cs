using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;

namespace Prisma.Plugins
{
    [DataContract]
    public sealed class DraftGraphInput
    {
        [DataMember(Name = "contributors", IsRequired = true)] public List<ContributorInput> Contributors { get; set; }
        [DataMember(Name = "technologyIds", IsRequired = true)] public List<string> TechnologyIds { get; set; }
        [DataMember(Name = "industryIds", IsRequired = true)] public List<string> IndustryIds { get; set; }
        [DataMember(Name = "projectIds", IsRequired = true)] public List<string> ProjectIds { get; set; }
        [DataMember(Name = "areaIds", IsRequired = true)] public List<string> AreaIds { get; set; }
    }

    [DataContract]
    public sealed class DraftGraphSnapshot
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "rowVersion")] public string RowVersion { get; set; }
        [DataMember(Name = "graph")] public DraftGraphInput Graph { get; set; }
        [DataMember(Name = "hours")] public List<decimal?> Hours { get; set; }
    }

    public static class DraftGraph
    {
        public const string SaveMessage = "nx_SaveDraftGraph";
        public const string ReadMessage = "nx_GetDraftGraph";
        public static readonly string[] Relationships = {
            "nx_Solution_nx_Technology_nx_Technology", "nx_Solution_nx_Industry_nx_Industry", "nx_Solution_cr6b0_Project_cr6b0_Project",
            "nx_Solution_nx_SpecializationArea_nx_SpecializationArea"
        };

        public static DraftGraphInput Parse(string json, int maturity)
        {
            if (string.IsNullOrWhiteSpace(json) || json.Length > 200000) throw Invalid("Missing or oversized draft graph.");
            DraftGraphInput input;
            try
            {
                var bytes = Encoding.UTF8.GetBytes(json);
                using (var reader = JsonReaderWriterFactory.CreateJsonReader(bytes, new XmlDictionaryReaderQuotas { MaxDepth = 12, MaxStringContentLength = 200000, MaxArrayLength = 200000 }))
                {
                    var root = XElement.Load(reader);
                    CheckFields(root, "contributors", "technologyIds", "industryIds", "projectIds", "areaIds");
                    var contributors = root.Element("contributors");
                    if (contributors != null)
                        foreach (var contributor in contributors.Elements()) CheckFields(contributor, "id", "personId", "directHours", "startDate", "endDate", "allocation", "roleValue");
                }
                using (var stream = new MemoryStream(bytes)) input = (DraftGraphInput)new DataContractJsonSerializer(typeof(DraftGraphInput)).ReadObject(stream);
            }
            catch (Exception error) when (error is SerializationException || error is XmlException || error is ArgumentException)
            {
                throw Invalid("Invalid draft graph JSON.");
            }
            if (input == null) throw Invalid("Missing draft graph.");
            ContributorPolicy.Validate(input.Contributors, maturity, false);
            Identifiers(input.TechnologyIds);
            Identifiers(input.IndustryIds);
            Identifiers(input.ProjectIds);
            Identifiers(input.AreaIds);
            return input;
        }

        internal static void CheckFields(XElement element, params string[] allowed)
        {
            if ((string)element.Attribute("type") != "object" || element.Elements().Any(field => !allowed.Contains(field.Name.LocalName))
                || element.Elements().GroupBy(field => field.Name.LocalName).Any(group => group.Count() > 1))
                throw Invalid("Unsupported or duplicate draft graph fields.");
        }

        private static HashSet<Guid> Identifiers(List<string> values)
        {
            if (values == null || values.Count > 100) throw Invalid("Too many or missing related records.");
            var identifiers = new HashSet<Guid>(values.Select(ContributorPolicy.Identifier));
            if (identifiers.Count != values.Count) throw Invalid("Duplicate related record.");
            return identifiers;
        }

        public static DraftGraphSnapshot Read(IOrganizationService caller, Entity parent)
        {
            var contributors = Children(caller, parent.Id).Select(row => new ContributorInput {
                Id = row.Id.ToString(), PersonId = row.GetAttributeValue<EntityReference>("nx_builtby")?.Id.ToString(),
                DirectHours = row.Contains("nx_directhours") ? (decimal?)row["nx_directhours"] : null,
                Allocation = row.Contains("nx_allocationpercent") ? (decimal?)row["nx_allocationpercent"] : null,
                StartDate = row.Contains("nx_startdate") ? ((DateTime)row["nx_startdate"]).ToString("yyyy-MM-dd") : null,
                EndDate = row.Contains("nx_enddate") ? ((DateTime)row["nx_enddate"]).ToString("yyyy-MM-dd") : null,
                RoleValue = row.GetAttributeValue<OptionSetValue>("nx_role")?.Value
            }).ToList();
            var maturity = parent.GetAttributeValue<OptionSetValue>("nx_status").Value;
            return new DraftGraphSnapshot {
                Id = parent.Id.ToString(), RowVersion = parent.RowVersion,
                Graph = new DraftGraphInput {
                    Contributors = contributors,
                    TechnologyIds = Links(caller, parent.Id, Relationships[0]).Select(identifier => identifier.ToString()).ToList(),
                    IndustryIds = Links(caller, parent.Id, Relationships[1]).Select(identifier => identifier.ToString()).ToList(),
                    ProjectIds = Links(caller, parent.Id, Relationships[2]).Select(identifier => identifier.ToString()).ToList(),
                    AreaIds = AreaIds(caller, parent.Id)
                },
                Hours = contributors.Select(person => ContributorPolicy.Hours(person, maturity)).ToList()
            };
        }

        public static void Save(IOrganizationService caller, Entity parent, DraftGraphInput input)
        {
            var existing = Children(caller, parent.Id).ToDictionary(row => row.Id);
            var retained = new HashSet<Guid>();
            var maturity = parent.GetAttributeValue<OptionSetValue>("nx_status").Value;
            foreach (var person in input.Contributors)
            {
                var personId = ContributorPolicy.Identifier(person.PersonId);
                caller.Retrieve("cr6b0_consultant", personId, new ColumnSet(false));
                var identifier = string.IsNullOrEmpty(person.Id) ? Guid.Empty : ContributorPolicy.Identifier(person.Id);
                if (identifier != Guid.Empty && !existing.ContainsKey(identifier)) throw Invalid("Contributor does not belong to this draft.");
                var row = new Entity("nx_solutioncontributor", identifier) {
                    ["nx_contributorname"] = "Contributor " + personId.ToString("D"),
                    ["nx_solution"] = parent.ToEntityReference(), ["nx_builtby"] = new EntityReference("cr6b0_consultant", personId),
                    ["nx_effortmode"] = new OptionSetValue(ContributorPolicy.Direct(maturity) ? 125060000 : 125060001),
                    ["nx_directhours"] = person.DirectHours, ["nx_allocationpercent"] = person.Allocation,
                    ["nx_startdate"] = ContributorPolicy.Date(person.StartDate), ["nx_enddate"] = ContributorPolicy.Date(person.EndDate),
                    ["nx_role"] = person.RoleValue.HasValue ? new OptionSetValue(person.RoleValue.Value) : null
                };
                if (identifier == Guid.Empty) caller.Create(row);
                else { caller.Update(row); retained.Add(identifier); }
            }
            foreach (var identifier in existing.Keys.Where(identifier => !retained.Contains(identifier))) caller.Delete("nx_solutioncontributor", identifier);
            SyncLinks(caller, parent.Id, Relationships[0], "nx_technology", Identifiers(input.TechnologyIds));
            SyncLinks(caller, parent.Id, Relationships[1], "nx_industry", Identifiers(input.IndustryIds));
            SyncLinks(caller, parent.Id, Relationships[2], "cr6b0_project", Identifiers(input.ProjectIds));
            SyncLinks(caller, parent.Id, Relationships[3], "nx_specializationarea", Identifiers(input.AreaIds));
        }

        private static List<Entity> Children(IOrganizationService caller, Guid parent)
        {
            var query = new QueryExpression("nx_solutioncontributor") {
                ColumnSet = new ColumnSet("nx_builtby", "nx_directhours", "nx_startdate", "nx_enddate", "nx_allocationpercent", "nx_role"), TopCount = 101
            };
            query.Criteria.AddCondition("nx_solution", ConditionOperator.Equal, parent);
            query.Orders.Add(new OrderExpression("nx_solutioncontributorid", OrderType.Ascending));
            var rows = caller.RetrieveMultiple(query).Entities.ToList();
            if (rows.Count > 100) throw Invalid("Contributor limit exceeded.");
            return rows;
        }

        /// <summary>Linked specialization areas, primary first: ascending Sort Order, then id.</summary>
        public static List<string> AreaIds(IOrganizationService caller, Guid parent)
        {
            var query = new QueryExpression("nx_specializationarea") { ColumnSet = new ColumnSet(false), TopCount = 101 };
            query.AddLink("nx_solution_nx_specializationarea", "nx_specializationareaid", "nx_specializationareaid").LinkCriteria.AddCondition("nx_solutionid", ConditionOperator.Equal, parent);
            query.Orders.Add(new OrderExpression("nx_sortordernumber", OrderType.Ascending));
            query.Orders.Add(new OrderExpression("nx_specializationareaid", OrderType.Ascending));
            var rows = caller.RetrieveMultiple(query).Entities;
            if (rows.Count > 100) throw Invalid("Related record limit exceeded.");
            return rows.Select(row => row.Id.ToString()).ToList();
        }

        private static HashSet<Guid> Links(IOrganizationService caller, Guid parent, string relationship)
        {
            var metadata = (ManyToManyRelationshipMetadata)((RetrieveRelationshipResponse)caller.Execute(new RetrieveRelationshipRequest { Name = relationship })).RelationshipMetadata;
            var first = metadata.Entity1LogicalName == "nx_solution";
            var source = first ? metadata.Entity1IntersectAttribute : metadata.Entity2IntersectAttribute;
            var target = first ? metadata.Entity2IntersectAttribute : metadata.Entity1IntersectAttribute;
            var query = new QueryExpression(metadata.IntersectEntityName) { ColumnSet = new ColumnSet(target), TopCount = 101 };
            query.Criteria.AddCondition(source, ConditionOperator.Equal, parent);
            var rows = caller.RetrieveMultiple(query).Entities;
            if (rows.Count > 100) throw Invalid("Related record limit exceeded.");
            return new HashSet<Guid>(rows.Select(row => row.GetAttributeValue<Guid>(target)));
        }

        private static void SyncLinks(IOrganizationService caller, Guid parent, string relationship, string table, HashSet<Guid> desired)
        {
            foreach (var identifier in desired) caller.Retrieve(table, identifier, new ColumnSet(false));
            var existing = Links(caller, parent, relationship);
            foreach (var identifier in existing.Except(desired)) caller.Disassociate("nx_solution", parent, new Relationship(relationship), new EntityReferenceCollection { new EntityReference(table, identifier) });
            foreach (var identifier in desired.Except(existing)) caller.Associate("nx_solution", parent, new Relationship(relationship), new EntityReferenceCollection { new EntityReference(table, identifier) });
        }

        private static InvalidPluginExecutionException Invalid(string message) { return new InvalidPluginExecutionException(message); }
    }

    public sealed class DraftGraphApi : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            if (context.MessageName != DraftGraph.ReadMessage && context.MessageName != DraftGraph.SaveMessage) throw new InvalidPluginExecutionException("Invalid graph operation.");
            var identifier = (Guid)context.InputParameters["SolutionId"];
            var parent = caller.Retrieve("nx_solution", identifier, new ColumnSet("ownerid", "nx_publicationstatus", "nx_status"));
            var expected = context.MessageName == DraftGraph.ReadMessage ? parent.RowVersion : context.InputParameters["ExpectedRowVersion"] as string;
            DraftPolicy.AssertEditable(parent, context.InitiatingUserId, expected);
            if (context.MessageName == DraftGraph.SaveMessage)
            {
                if (!context.IsInTransaction) throw new InvalidPluginExecutionException("A transaction is required.");
                var input = DraftGraph.Parse(context.InputParameters["GraphJson"] as string, parent.GetAttributeValue<OptionSetValue>("nx_status").Value);
                caller.Execute(new UpdateRequest {
                    Target = new Entity("nx_solution", identifier) { RowVersion = expected, ["nx_status"] = parent["nx_status"] },
                    ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches
                });
                DraftGraph.Save(caller, parent, input);
                factory.CreateOrganizationService(null).Update(new Entity("nx_solution", identifier) { ["nx_clientsafereviewed"] = false, ["nx_safetyacknowledged"] = false });
                parent = caller.Retrieve("nx_solution", identifier, new ColumnSet("nx_status"));
            }
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(DraftGraph.Read(caller, parent));
        }
    }

    public sealed class DraftGraphGuard : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.MessageName == "Associate" || context.MessageName == "Disassociate")
            {
                var relationship = context.InputParameters["Relationship"] as Relationship;
                if (relationship == null || !DraftGraph.Relationships.Contains(relationship.SchemaName)) return;
            }
            else if (context.PrimaryEntityName != "nx_solutioncontributor") throw new InvalidPluginExecutionException("Invalid graph guard registration.");
            if ((context.MessageName == "Delete" || context.MessageName == "Disassociate") && DraftPolicy.IsDeleteContext(context)) return;
            if (DraftPolicy.IsOperationContext(context, DraftGraph.SaveMessage)) return;
            throw new InvalidPluginExecutionException("Use the PRISMA draft graph operation. Direct contributor/link writes are disabled.");
        }
    }
}