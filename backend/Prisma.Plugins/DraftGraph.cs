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
        /// <summary>Target client roles (PR-031). Optional on input: clients built before it omit the field, and their saves leave the stored roles alone.</summary>
        [DataMember(Name = "clientRoleIds", EmitDefaultValue = false)] public List<string> ClientRoleIds { get; set; }
        /// <summary>Omitted by older clients: preserve the stored secondary capability. An empty list clears it.</summary>
        [DataMember(Name = "secondaryCapabilityIds", EmitDefaultValue = false)] public List<string> SecondaryCapabilityIds { get; set; }
    }

    [DataContract]
    public sealed class DraftGraphSnapshot
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "rowVersion")] public string RowVersion { get; set; }
        [DataMember(Name = "graph")] public DraftGraphInput Graph { get; set; }
    }

    public static class DraftGraph
    {
        public const string SaveMessage = "nx_SaveDraftGraph";
        public const string ReadMessage = "nx_GetDraftGraph";
        public const string SecondaryRelationship = "nx_Solution_nx_SecondaryCapability";
        public static readonly string[] Relationships = {
            "nx_Solution_nx_Technology_nx_Technology", "nx_Solution_nx_Industry_nx_Industry", "nx_Solution_cr6b0_Project_cr6b0_Project",
            "nx_Solution_nx_SpecializationArea_nx_SpecializationArea", "nx_ClientRole_nx_Solution_nx_Solution", SecondaryRelationship
        };

        public static DraftGraphInput Parse(string json)
        {
            if (string.IsNullOrWhiteSpace(json) || json.Length > 200000) throw Invalid("Missing or oversized draft graph.");
            DraftGraphInput input;
            try
            {
                var bytes = Encoding.UTF8.GetBytes(json);
                using (var reader = JsonReaderWriterFactory.CreateJsonReader(bytes, new XmlDictionaryReaderQuotas { MaxDepth = 12, MaxStringContentLength = 200000, MaxArrayLength = 200000 }))
                {
                    var root = XElement.Load(reader);
                    CheckFields(root, "contributors", "technologyIds", "industryIds", "projectIds", "areaIds", "clientRoleIds", "secondaryCapabilityIds");
                    var contributors = root.Element("contributors");
                    if (contributors != null)
                        // startDate, endDate, allocation and roleValue are retired; clients built before that still send them, and they are ignored.
                        foreach (var contributor in contributors.Elements()) CheckFields(contributor, "id", "personId", "directHours", "startDate", "endDate", "allocation", "roleValue");
                }
                using (var stream = new MemoryStream(bytes)) input = (DraftGraphInput)new DataContractJsonSerializer(typeof(DraftGraphInput)).ReadObject(stream);
            }
            catch (Exception error) when (error is SerializationException || error is XmlException || error is ArgumentException)
            {
                throw Invalid("Invalid draft graph JSON.");
            }
            if (input == null) throw Invalid("Missing draft graph.");
            ContributorPolicy.Validate(input.Contributors, false);
            Identifiers(input.TechnologyIds);
            Identifiers(input.IndustryIds);
            Identifiers(input.ProjectIds);
            Identifiers(input.AreaIds);
            if (input.ClientRoleIds != null) Identifiers(input.ClientRoleIds);
            if (input.SecondaryCapabilityIds != null) SecondaryIdentifiers(input.SecondaryCapabilityIds);
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

        private static HashSet<Guid> SecondaryIdentifiers(List<string> values)
        {
            var identifiers = Identifiers(values);
            if (identifiers.Count > 1) throw Invalid("Choose at most one secondary capability.");
            return identifiers;
        }

        public static List<string> SecondaryIds(IOrganizationService caller, Guid parent)
        {
            return Links(caller, parent, SecondaryRelationship).OrderBy(id => id).Select(id => id.ToString("D")).ToList();
        }

        /// <summary>Validate the effective capabilities and replace client-supplied areas with their areas, main first.</summary>
        public static void PrepareClassification(IOrganizationService caller, Entity parent, DraftGraphInput input)
        {
            var secondary = input.SecondaryCapabilityIds ?? SecondaryIds(caller, parent.Id);
            var ids = SecondaryIdentifiers(secondary);
            var main = parent.GetAttributeValue<EntityReference>("nx_capability");
            if (main == null && ids.Count > 0) throw Invalid("Choose a main capability before a secondary capability.");
            if (main != null && ids.Contains(main.Id)) throw Invalid("The secondary capability cannot be the main capability.");
            var areas = new List<string>();
            foreach (var id in (main == null ? Enumerable.Empty<Guid>() : new[] { main.Id }).Concat(ids))
            {
                var capability = caller.Retrieve("nx_capability", id, new ColumnSet("statecode", "nx_specializationarea"));
                if (capability.GetAttributeValue<OptionSetValue>("statecode")?.Value != 0) throw Invalid("Choose an active capability.");
                var area = capability.GetAttributeValue<EntityReference>("nx_specializationarea");
                if (area == null) throw Invalid("The selected capability has no specialization area. Contact the librarian.");
                if (!areas.Contains(area.Id.ToString("D"))) areas.Add(area.Id.ToString("D"));
            }
            input.SecondaryCapabilityIds = secondary;
            input.AreaIds = areas;
        }

        /// <summary>A core capability edit must not leave the stored area links pointing at the old capability.</summary>
        public static void SaveCapabilityAreas(IOrganizationService caller, Entity parent)
        {
            var classification = new DraftGraphInput();
            PrepareClassification(caller, parent, classification);
            SyncLinks(caller, parent.Id, Relationships[3], "nx_specializationarea", Identifiers(classification.AreaIds));
        }

        public static DraftGraphSnapshot Read(IOrganizationService caller, Entity parent)
        {
            var contributors = Children(caller, parent.Id).Select(row => new ContributorInput {
                Id = row.Id.ToString(), PersonId = row.GetAttributeValue<EntityReference>("nx_builtby")?.Id.ToString()
            }).ToList();
            return new DraftGraphSnapshot {
                Id = parent.Id.ToString(), RowVersion = parent.RowVersion,
                Graph = new DraftGraphInput {
                    Contributors = contributors,
                    TechnologyIds = Links(caller, parent.Id, Relationships[0]).Select(identifier => identifier.ToString()).ToList(),
                    IndustryIds = Links(caller, parent.Id, Relationships[1]).Select(identifier => identifier.ToString()).ToList(),
                    ProjectIds = Links(caller, parent.Id, Relationships[2]).Select(identifier => identifier.ToString()).ToList(),
                    AreaIds = AreaIds(caller, parent),
                    ClientRoleIds = Links(caller, parent.Id, Relationships[4]).Select(identifier => identifier.ToString()).ToList(),
                    SecondaryCapabilityIds = SecondaryIds(caller, parent.Id)
                }
            };
        }

        /// <summary>Saves the graph; a librarian save (ADR-0013) leaves every contributor row and its hours untouched.</summary>
        public static void Save(IOrganizationService caller, Entity parent, DraftGraphInput input, bool contributors = true, IOrganizationService references = null)
        {
            PrepareClassification(caller, parent, input);
            var existing = contributors ? Children(caller, parent.Id).ToDictionary(row => row.Id) : new Dictionary<Guid, Entity>();
            var retained = new HashSet<Guid>();
            foreach (var person in contributors ? input.Contributors : new List<ContributorInput>())
            {
                var personId = ContributorPolicy.Identifier(person.PersonId);
                caller.Retrieve("cr6b0_consultant", personId, new ColumnSet(false));
                var identifier = string.IsNullOrEmpty(person.Id) ? Guid.Empty : ContributorPolicy.Identifier(person.Id);
                if (identifier != Guid.Empty && !existing.ContainsKey(identifier)) throw Invalid("Contributor does not belong to this draft.");
                var row = new Entity("nx_solutioncontributor", identifier) {
                    ["nx_contributorname"] = "Contributor " + personId.ToString("D"),
                    ["nx_solution"] = parent.ToEntityReference(), ["nx_builtby"] = new EntityReference("cr6b0_consultant", personId),
                    // Effort is an estimate on the solution now: nx_directhours, the dates and allocation are no longer written.
                    // The person's role is their cr6b0_consultantlevel in the directory; nx_role is retired and never touched.
                    ["nx_effortmode"] = new OptionSetValue(125060000)
                };
                if (identifier == Guid.Empty) caller.Create(row);
                else { caller.Update(row); retained.Add(identifier); }
            }
            foreach (var identifier in existing.Keys.Where(identifier => !retained.Contains(identifier))) caller.Delete("nx_solutioncontributor", identifier);
            SyncLinks(caller, parent.Id, Relationships[0], "nx_technology", Identifiers(input.TechnologyIds), references);
            SyncLinks(caller, parent.Id, Relationships[1], "nx_industry", Identifiers(input.IndustryIds), references);
            SyncLinks(caller, parent.Id, Relationships[2], "cr6b0_project", Identifiers(input.ProjectIds), references);
            SyncLinks(caller, parent.Id, Relationships[3], "nx_specializationarea", Identifiers(input.AreaIds), references);
            if (input.ClientRoleIds != null) SyncLinks(caller, parent.Id, Relationships[4], "nx_clientrole", Identifiers(input.ClientRoleIds), references);
            SyncLinks(caller, parent.Id, SecondaryRelationship, "nx_capability", SecondaryIdentifiers(input.SecondaryCapabilityIds), references);
        }

        /// <summary>True when the tags, projects, areas or client roles differ from the stored graph. Contributors are not compared.</summary>
        public static bool LinksChanged(DraftGraphInput stored, DraftGraphInput input)
        {
            Func<List<string>, HashSet<Guid>> set = values => new HashSet<Guid>(values.Select(ContributorPolicy.Identifier));
            return !set(stored.TechnologyIds).SetEquals(set(input.TechnologyIds)) || !set(stored.IndustryIds).SetEquals(set(input.IndustryIds))
                || !set(stored.ProjectIds).SetEquals(set(input.ProjectIds)) || !set(stored.AreaIds).SetEquals(set(input.AreaIds))
                || (input.ClientRoleIds != null && !set(stored.ClientRoleIds).SetEquals(set(input.ClientRoleIds)))
                || (input.SecondaryCapabilityIds != null && !set(stored.SecondaryCapabilityIds ?? new List<string>()).SetEquals(set(input.SecondaryCapabilityIds)));
        }

        private static List<Entity> Children(IOrganizationService caller, Guid parent)
        {
            var query = new QueryExpression("nx_solutioncontributor") {
                ColumnSet = new ColumnSet("nx_builtby"), TopCount = 101
            };
            query.Criteria.AddCondition("nx_solution", ConditionOperator.Equal, parent);
            query.Orders.Add(new OrderExpression("nx_solutioncontributorid", OrderType.Ascending));
            var rows = caller.RetrieveMultiple(query).Entities.ToList();
            if (rows.Count > 100) throw Invalid("Contributor limit exceeded.");
            return rows;
        }

        /// <summary>Linked areas, main capability's area first, then ascending Sort Order and id.</summary>
        public static List<string> AreaIds(IOrganizationService caller, Entity parent)
        {
            var query = new QueryExpression("nx_specializationarea") { ColumnSet = new ColumnSet(false), TopCount = 101 };
            query.AddLink("nx_solution_nx_specializationarea", "nx_specializationareaid", "nx_specializationareaid").LinkCriteria.AddCondition("nx_solutionid", ConditionOperator.Equal, parent.Id);
            query.Orders.Add(new OrderExpression("nx_sortordernumber", OrderType.Ascending));
            query.Orders.Add(new OrderExpression("nx_specializationareaid", OrderType.Ascending));
            var rows = caller.RetrieveMultiple(query).Entities;
            if (rows.Count > 100) throw Invalid("Related record limit exceeded.");
            var main = parent.GetAttributeValue<EntityReference>("nx_capability");
            var primaryArea = main == null ? null : caller.Retrieve("nx_capability", main.Id, new ColumnSet("nx_specializationarea")).GetAttributeValue<EntityReference>("nx_specializationarea");
            return rows.OrderBy(row => row.Id == primaryArea?.Id ? 0 : 1).Select(row => row.Id.ToString()).ToList();
        }

        private static HashSet<Guid> Links(IOrganizationService caller, Guid parent, string relationship)
        {
            string intersect, source, target;
            IntersectOf(caller, relationship, out intersect, out source, out target);
            var query = new QueryExpression(intersect) { ColumnSet = new ColumnSet(target), TopCount = 101 };
            query.Criteria.AddCondition(source, ConditionOperator.Equal, parent);
            var rows = caller.RetrieveMultiple(query).Entities;
            if (rows.Count > 100) throw Invalid("Related record limit exceeded.");
            return new HashSet<Guid>(rows.Select(row => row.GetAttributeValue<Guid>(target)));
        }

        /// <summary>Intersect table of a Solution N:N, with its Solution-side (source) and tag-side (target) columns.</summary>
        internal static void IntersectOf(IOrganizationService service, string relationship, out string intersect, out string source, out string target)
        {
            var metadata = (ManyToManyRelationshipMetadata)((RetrieveRelationshipResponse)service.Execute(new RetrieveRelationshipRequest { Name = relationship })).RelationshipMetadata;
            var first = metadata.Entity1LogicalName == "nx_solution";
            intersect = metadata.IntersectEntityName;
            source = first ? metadata.Entity1IntersectAttribute : metadata.Entity2IntersectAttribute;
            target = first ? metadata.Entity2IntersectAttribute : metadata.Entity1IntersectAttribute;
        }

        private static void SyncLinks(IOrganizationService caller, Guid parent, string relationship, string table, HashSet<Guid> desired, IOrganizationService references = null)
        {
            foreach (var identifier in desired) (references ?? caller).Retrieve(table, identifier, new ColumnSet(false));
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
            var server = factory.CreateOrganizationService(null);
            bool librarian;
            var parent = LibrarianAccess.Resolve(server, context.InitiatingUserId).ReadSolution(caller, server, context.InitiatingUserId, identifier, new ColumnSet("ownerid", "nx_publicationstatus", "nx_status", "nx_capability"), out librarian);
            var expected = context.MessageName == DraftGraph.ReadMessage ? parent.RowVersion : context.InputParameters["ExpectedRowVersion"] as string;
            var mode = DraftPolicy.Editable(parent, context.InitiatingUserId, expected, () => librarian);
            var writer = mode == EditMode.Librarian ? server : caller;
            if (context.MessageName == DraftGraph.SaveMessage)
            {
                if (!context.IsInTransaction) throw new InvalidPluginExecutionException("A transaction is required.");
                var input = DraftGraph.Parse(context.InputParameters["GraphJson"] as string);
                var stored = mode == EditMode.Librarian ? DraftGraph.Read(writer, parent).Graph : null;
                writer.Execute(new UpdateRequest {
                    Target = new Entity("nx_solution", identifier) { RowVersion = expected, ["nx_status"] = parent["nx_status"] },
                    ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches
                });
                DraftGraph.Save(writer, parent, input, mode == EditMode.Owner, caller);
                if (mode == EditMode.Owner) server.Update(new Entity("nx_solution", identifier) { ["nx_clientsafereviewed"] = false, ["nx_safetyacknowledged"] = false });
                else if (DraftGraph.LinksChanged(stored, input)) server.Update(DraftPolicy.LibrarianEdit(identifier, parent.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value, DraftPolicy.Editor(server, context.InitiatingUserId), DateTime.UtcNow));
                parent = writer.Retrieve("nx_solution", identifier, new ColumnSet("nx_status", "nx_capability"));
            }
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(DraftGraph.Read(writer, parent));
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
                if (relationship == null || !DraftGraph.Relationships.Contains(relationship.SchemaName, StringComparer.OrdinalIgnoreCase)) return;
                if (string.Equals(relationship.SchemaName, DraftGraph.Relationships[3], StringComparison.OrdinalIgnoreCase)
                    && DraftPolicy.IsOperationContext(context, DraftPolicy.SaveMessage)) return;
            }
            else if (context.PrimaryEntityName != "nx_solutioncontributor") throw new InvalidPluginExecutionException("Invalid graph guard registration.");
            if ((context.MessageName == "Delete" || context.MessageName == "Disassociate") && DraftPolicy.IsDeleteContext(context)) return;
            if (DraftPolicy.IsOperationContext(context, DraftGraph.SaveMessage)) return;
            throw new InvalidPluginExecutionException("Use the PRISMA draft graph operation. Direct contributor/link writes are disabled.");
        }
    }
}