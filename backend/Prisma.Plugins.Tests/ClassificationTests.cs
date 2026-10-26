using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Remoting.Messaging;
using System.Runtime.Remoting.Proxies;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Xunit;

namespace Prisma.Plugins.Tests
{
    public class ClassificationTests
    {
        private static readonly Guid Main = Guid.NewGuid(), Secondary = Guid.NewGuid(), MainArea = Guid.NewGuid(), OtherArea = Guid.NewGuid();
        private const string EmptyJson = "{\"contributors\":[],\"technologyIds\":[],\"industryIds\":[],\"projectIds\":[],\"areaIds\":[]}";
        private static Entity Parent() { return new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "1", ["nx_capability"] = new EntityReference("nx_capability", Main) }; }
        private static DraftGraphInput Input(params Guid[] secondary)
        {
            var input = DraftGraph.Parse(EmptyJson);
            input.SecondaryCapabilityIds = secondary.Select(id => id.ToString("D")).ToList();
            return input;
        }
        private static GraphService Service()
        {
            var service = new GraphService();
            service.Capabilities[Main] = new Entity("nx_capability", Main) { ["statecode"] = new OptionSetValue(0), ["nx_specializationarea"] = new EntityReference("nx_specializationarea", MainArea) };
            service.Capabilities[Secondary] = new Entity("nx_capability", Secondary) { ["statecode"] = new OptionSetValue(0), ["nx_specializationarea"] = new EntityReference("nx_specializationarea", OtherArea) };
            return service;
        }

        [Fact]
        public void SecondaryInputIsOptionalButRejectsInvalidDuplicateAndExcessIds()
        {
            Assert.Null(DraftGraph.Parse(EmptyJson).SecondaryCapabilityIds);
            Func<string, DraftGraphInput> parse = value => DraftGraph.Parse(EmptyJson.Replace("\"areaIds\":[]", "\"areaIds\":[],\"secondaryCapabilityIds\":" + value));
            Assert.Empty(parse("[]").SecondaryCapabilityIds);
            Assert.Equal(new[] { Secondary.ToString("D") }, parse("[\"" + Secondary + "\"]").SecondaryCapabilityIds);
            foreach (var value in new[] { "[\"invalid\"]", "[\"" + Guid.Empty + "\"]", "[\"" + Secondary + "\",\"" + Secondary + "\"]", "[\"" + Secondary + "\",\"" + Main + "\"]" })
                Assert.Throws<InvalidPluginExecutionException>(() => parse(value));
        }

        [Fact]
        public void SaveDerivesAreasAndRoundTripsTheSecondaryWhileOldClientsPreserveIt()
        {
            var service = Service();
            var parent = Parent();
            var input = Input(Secondary);
            input.AreaIds.Add(Guid.NewGuid().ToString("D"));
            DraftGraph.Save(service, parent, input);
            Assert.Equal(new[] { MainArea.ToString("D"), OtherArea.ToString("D") }, input.AreaIds);
            var read = DraftGraph.Read(service, parent);
            Assert.Equal(input.AreaIds, read.Graph.AreaIds);
            Assert.Equal(input.SecondaryCapabilityIds, read.Graph.SecondaryCapabilityIds);
            Assert.Contains("\"secondaryCapabilityIds\":[\"" + Secondary + "\"]", DraftPolicy.Serialize(read));

            DraftGraph.Save(service, parent, DraftGraph.Parse(EmptyJson));
            Assert.Contains(Secondary, service.Links[DraftGraph.SecondaryRelationship]);
            DraftGraph.Save(service, parent, Input());
            Assert.Empty(service.Links[DraftGraph.SecondaryRelationship]);
            Assert.Equal(new[] { MainArea }, service.Links[DraftGraph.Relationships[3]]);
        }

        [Fact]
        public void SharedCapabilityAreasAreDeduplicatedAndUnclassifiedDraftsHaveNoAreas()
        {
            var service = Service();
            service.Capabilities[Secondary]["nx_specializationarea"] = new EntityReference("nx_specializationarea", MainArea);
            var input = Input(Secondary);
            DraftGraph.PrepareClassification(service, Parent(), input);
            Assert.Equal(new[] { MainArea.ToString("D") }, input.AreaIds);
            var unclassified = Input();
            unclassified.AreaIds.Add(OtherArea.ToString("D"));
            DraftGraph.PrepareClassification(service, new Entity("nx_solution", Guid.NewGuid()), unclassified);
            Assert.Empty(unclassified.AreaIds);
        }

        [Theory]
        [InlineData("main")]
        [InlineData("inactive")]
        [InlineData("missing-area")]
        [InlineData("no-main")]
        [InlineData("too-many")]
        public void InvalidSecondaryFailsBeforeAnyGraphWrite(string scenario)
        {
            var service = Service();
            var parent = Parent();
            var input = Input(Secondary);
            if (scenario == "main") input = Input(Main);
            if (scenario == "inactive") service.Capabilities[Secondary]["statecode"] = new OptionSetValue(1);
            if (scenario == "missing-area") service.Capabilities[Secondary].Attributes.Remove("nx_specializationarea");
            if (scenario == "no-main") parent.Attributes.Remove("nx_capability");
            if (scenario == "too-many") input = Input(Secondary, Guid.NewGuid());
            Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.Save(service, parent, input));
            Assert.Equal(0, service.Writes);
        }

        [Fact]
        public void CoreCapabilityEditsRefreshAreasAndRejectAnExistingSecondaryAsMain()
        {
            var service = Service();
            var parent = Parent();
            service.Links[DraftGraph.Relationships[3]].Add(OtherArea);
            DraftGraph.SaveCapabilityAreas(service, parent);
            Assert.Equal(new[] { MainArea }, service.Links[DraftGraph.Relationships[3]]);
            service.Links[DraftGraph.SecondaryRelationship].Add(Main);
            Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.SaveCapabilityAreas(service, parent));
        }

        [Fact]
        public void LibrarianChangesIncludeSecondaryButOldClientsDoNotClearIt()
        {
            var stored = Input(Secondary);
            var oldClient = DraftGraph.Parse(EmptyJson);
            Assert.False(DraftGraph.LinksChanged(stored, oldClient));
            Assert.True(DraftGraph.LinksChanged(stored, Input()));
            var same = Input(Secondary);
            same.SecondaryCapabilityIds[0] = same.SecondaryCapabilityIds[0].ToUpperInvariant();
            Assert.False(DraftGraph.LinksChanged(stored, same));
        }

        [Theory]
        [InlineData("Associate")]
        [InlineData("Disassociate")]
        public void GuardBlocksDirectSecondaryWritesAndOnlyAllowsGraphOperations(string message)
        {
            var user = Guid.NewGuid();
            var context = new TestPluginContext(user, message);
            context.Input["Relationship"] = new Relationship(DraftGraph.SecondaryRelationship.ToLowerInvariant());
            Assert.Throws<InvalidPluginExecutionException>(() => new DraftGraphGuard().Execute(context));
            context.Parent = new TestPluginContext(user, DraftPolicy.SaveMessage).Context;
            Assert.Throws<InvalidPluginExecutionException>(() => new DraftGraphGuard().Execute(context));
            context.Parent = new TestPluginContext(user, DraftGraph.SaveMessage).Context;
            new DraftGraphGuard().Execute(context);
            context.Parent = new TestPluginContext(Guid.NewGuid(), DraftGraph.SaveMessage).Context;
            Assert.Throws<InvalidPluginExecutionException>(() => new DraftGraphGuard().Execute(context));
        }

        [Theory]
        [InlineData("Associate")]
        [InlineData("Disassociate")]
        public void CoreSavesMayOnlyMaintainAreaLinks(string message)
        {
            var user = Guid.NewGuid();
            var context = new TestPluginContext(user, message) { Parent = new TestPluginContext(user, DraftPolicy.SaveMessage).Context };
            context.Input["Relationship"] = new Relationship(DraftGraph.Relationships[3]);
            new DraftGraphGuard().Execute(context);
            context.Input["Relationship"] = new Relationship(DraftGraph.Relationships[0]);
            Assert.Throws<InvalidPluginExecutionException>(() => new DraftGraphGuard().Execute(context));
        }

        [Fact]
        public void SummaryReturnsTheSolutionModificationTimestampInUtcIso()
        {
            Assert.Contains("modifiedon", ReviewApi.Columns().Columns);
            var parent = Parent();
            parent["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus);
            parent["modifiedon"] = new DateTime(2026, 10, 26, 14, 45, 12, DateTimeKind.Utc);
            parent["createdon"] = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
            var summary = ReviewApi.Summary(Service(), parent, false);
            Assert.Equal("2026-10-26T14:45:12.0000000Z", summary.ModifiedOn);
            Assert.Contains("\"modifiedOn\":\"2026-10-26T14:45:12.0000000Z\"", DraftPolicy.Serialize(summary));
            parent.Attributes.Remove("modifiedon");
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewApi.Summary(Service(), parent, false));
        }

        [Fact]
        public void SaveReusesContributorRowAfterReselectingSamePerson()
        {
            var service = Service();
            var parent = Parent();
            var personId = Guid.NewGuid();
            var contributorId = Guid.NewGuid();
            service.Contributors[contributorId] = new Entity("nx_solutioncontributor", contributorId) {
                ["nx_solution"] = parent.ToEntityReference(), ["nx_builtby"] = new EntityReference("cr6b0_consultant", personId)
            };
            var input = Input();
            input.Contributors.Add(new ContributorInput { PersonId = personId.ToString("D") });

            DraftGraph.Save(service, parent, input);

            Assert.Equal(0, service.Creates);
            Assert.Equal(1, service.Updates);
            Assert.Equal(0, service.Deletes);
            Assert.Equal(contributorId, Assert.Single(service.Contributors.Values).Id);
            Assert.Equal(contributorId.ToString("D"), Assert.Single(DraftGraph.Read(service, parent).Graph.Contributors).Id);
        }

        [Fact]
        public void SaveReusesReselectedContributorAndRemovesOmittedPeople()
        {
            var service = Service();
            var parent = Parent();
            var personId = Guid.NewGuid();
            var keptId = Guid.NewGuid();
            var removedId = Guid.NewGuid();
            service.Contributors[keptId] = new Entity("nx_solutioncontributor", keptId) {
                ["nx_solution"] = parent.ToEntityReference(), ["nx_builtby"] = new EntityReference("cr6b0_consultant", personId)
            };
            service.Contributors[removedId] = new Entity("nx_solutioncontributor", removedId) {
                ["nx_solution"] = parent.ToEntityReference(), ["nx_builtby"] = new EntityReference("cr6b0_consultant", Guid.NewGuid())
            };
            var input = Input();
            input.Contributors.Add(new ContributorInput { PersonId = personId.ToString("D") });

            DraftGraph.Save(service, parent, input);

            Assert.Equal(keptId, Assert.Single(service.Contributors.Values).Id);
            Assert.Equal(0, service.Creates);
            Assert.Equal(1, service.Updates);
            Assert.Equal(1, service.Deletes);
        }

        [Fact]
        public void SaveCreatesAndUpdatesContributorWithoutReusingAnotherDraftRow()
        {
            var service = Service();
            var parent = Parent();
            var personId = Guid.NewGuid();
            var foreignId = Guid.NewGuid();
            service.Contributors[foreignId] = new Entity("nx_solutioncontributor", foreignId) {
                ["nx_solution"] = Parent().ToEntityReference(), ["nx_builtby"] = new EntityReference("cr6b0_consultant", personId)
            };
            var input = Input();
            input.Contributors.Add(new ContributorInput { PersonId = personId.ToString("D") });

            DraftGraph.Save(service, parent, input);
            var stored = Assert.Single(DraftGraph.Read(service, parent).Graph.Contributors);
            Assert.NotEqual(foreignId.ToString("D"), stored.Id);
            input.Contributors[0].Id = stored.Id;
            DraftGraph.Save(service, parent, input);

            Assert.Equal(2, service.Contributors.Count);
            Assert.True(service.Contributors.ContainsKey(foreignId));
            Assert.Equal(1, service.Creates);
            Assert.Equal(1, service.Updates);
            Assert.Equal(0, service.Deletes);
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void SaveRejectsForeignContributorIdEvenWhenPersonAlreadyExists(bool samePersonExists)
        {
            var service = Service();
            var parent = Parent();
            var personId = Guid.NewGuid();
            var foreignId = Guid.NewGuid();
            service.Contributors[foreignId] = new Entity("nx_solutioncontributor", foreignId) {
                ["nx_solution"] = Parent().ToEntityReference(), ["nx_builtby"] = new EntityReference("cr6b0_consultant", personId)
            };
            if (samePersonExists)
            {
                var localId = Guid.NewGuid();
                service.Contributors[localId] = new Entity("nx_solutioncontributor", localId) {
                    ["nx_solution"] = parent.ToEntityReference(), ["nx_builtby"] = new EntityReference("cr6b0_consultant", personId)
                };
            }
            var input = Input();
            input.Contributors.Add(new ContributorInput { Id = foreignId.ToString("D"), PersonId = personId.ToString("D") });

            Assert.Contains("does not belong", Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.Save(service, parent, input)).Message);
            Assert.Equal(0, service.Writes);
        }

        private sealed class GraphService : IOrganizationService
        {
            public Dictionary<Guid, Entity> Capabilities = new Dictionary<Guid, Entity>();
            public Dictionary<Guid, Entity> Contributors = new Dictionary<Guid, Entity>();
            public Dictionary<string, HashSet<Guid>> Links = DraftGraph.Relationships.ToDictionary(name => name, name => new HashSet<Guid>());
            public int Writes;
            public int Creates, Updates, Deletes;
            public Entity Retrieve(string entityName, Guid id, ColumnSet columns)
            {
                if (entityName == "nx_capability") return Capabilities[id];
                if (entityName == "cr6b0_consultant") return new Entity(entityName, id);
                Assert.Equal("nx_specializationarea", entityName);
                return new Entity(entityName, id);
            }
            public EntityCollection RetrieveMultiple(QueryBase request)
            {
                var query = Assert.IsType<QueryExpression>(request);
                if (query.EntityName == "nx_uploadsession") return new EntityCollection();
                if (query.EntityName == "nx_solutioncontributor")
                {
                    var parentId = (Guid)query.Criteria.Conditions.Single(condition => condition.AttributeName == "nx_solution").Values[0];
                    return new EntityCollection(Contributors.Values.Where(row => row.GetAttributeValue<EntityReference>("nx_solution").Id == parentId).ToList());
                }
                if (query.EntityName == "nx_specializationarea")
                    return new EntityCollection(Links[DraftGraph.Relationships[3]].OrderBy(id => id == OtherArea ? 0 : 1).Select(id => new Entity(query.EntityName, id)).ToList());
                var name = Links.Keys.Single(key => key.ToLowerInvariant() == query.EntityName);
                return new EntityCollection(Links[name].Select(id => new Entity(query.EntityName) { ["tagid"] = id }).ToList());
            }
            public OrganizationResponse Execute(OrganizationRequest request)
            {
                var relationship = Assert.IsType<RetrieveRelationshipRequest>(request);
                return new RetrieveRelationshipResponse { Results = new ParameterCollection { ["RelationshipMetadata"] = new ManyToManyRelationshipMetadata {
                    Entity1LogicalName = "nx_solution", Entity1IntersectAttribute = "nx_solutionid", Entity2LogicalName = "tag",
                    Entity2IntersectAttribute = "tagid", IntersectEntityName = relationship.Name.ToLowerInvariant()
                } } };
            }
            public void Associate(string entityName, Guid id, Relationship relationship, EntityReferenceCollection relatedEntities)
            {
                Writes++;
                foreach (var row in relatedEntities) Links[relationship.SchemaName].Add(row.Id);
            }
            public void Disassociate(string entityName, Guid id, Relationship relationship, EntityReferenceCollection relatedEntities)
            {
                Writes++;
                foreach (var row in relatedEntities) Links[relationship.SchemaName].Remove(row.Id);
            }
            private void CheckContributorKey(Entity entity)
            {
                Assert.Equal("nx_solutioncontributor", entity.LogicalName);
                if (Contributors.Values.Any(row => row.Id != entity.Id
                    && row.GetAttributeValue<EntityReference>("nx_solution").Id == entity.GetAttributeValue<EntityReference>("nx_solution").Id
                    && row.GetAttributeValue<EntityReference>("nx_builtby").Id == entity.GetAttributeValue<EntityReference>("nx_builtby").Id))
                    throw new InvalidPluginExecutionException("Solution Contributor Key violated.");
            }
            public Guid Create(Entity entity)
            {
                CheckContributorKey(entity);
                entity.Id = Guid.NewGuid();
                Contributors.Add(entity.Id, entity);
                Creates++; Writes++;
                return entity.Id;
            }
            public void Update(Entity entity)
            {
                CheckContributorKey(entity);
                Assert.True(Contributors.ContainsKey(entity.Id));
                Contributors[entity.Id] = entity;
                Updates++; Writes++;
            }
            public void Delete(string entityName, Guid id)
            {
                Assert.Equal("nx_solutioncontributor", entityName);
                Assert.True(Contributors.Remove(id));
                Deletes++; Writes++;
            }
        }
    }

    internal sealed class TestPluginContext : RealProxy, IServiceProvider, IOrganizationServiceFactory
    {
        private readonly Guid user;
        private readonly string message;
        public ParameterCollection Input = new ParameterCollection();
        public ParameterCollection Output = new ParameterCollection();
        public IPluginExecutionContext Parent;
        public IOrganizationService Service;
        public IOrganizationService CallerService;
        public IPluginExecutionContext Context { get { return (IPluginExecutionContext)GetTransparentProxy(); } }
        public TestPluginContext(Guid user, string message) : base(typeof(IPluginExecutionContext)) { this.user = user; this.message = message; }
        public override IMessage Invoke(IMessage messageCall)
        {
            var call = (IMethodCallMessage)messageCall;
            object result;
            switch (call.MethodName)
            {
                case "get_MessageName": result = message; break;
                case "get_InitiatingUserId": result = user; break;
                case "get_IsInTransaction": result = true; break;
                case "get_ParentContext": result = Parent; break;
                case "get_InputParameters": result = Input; break;
                case "get_OutputParameters": result = Output; break;
                default: return new ReturnMessage(new NotSupportedException(call.MethodName), call);
            }
            return new ReturnMessage(result, null, 0, call.LogicalCallContext, call);
        }
        public object GetService(Type type)
        {
            if (type == typeof(IPluginExecutionContext)) return Context;
            if (type == typeof(IOrganizationServiceFactory)) return this;
            if (type == typeof(ITracingService)) return null;
            throw new NotSupportedException(type.Name);
        }
        public IOrganizationService CreateOrganizationService(Guid? userId) { return (userId.HasValue ? CallerService ?? Service : Service) ?? throw new NotSupportedException(); }
    }
}
