using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Xunit;

namespace Prisma.Plugins.Tests
{
    public class LibrarianAccessTests
    {
        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void DirectAndTeamRolesGrantAllCapabilitiesInOwnedAreasButNotSecondaryAreas(bool inherited)
        {
            var service = new AccessService { Inherited = inherited };
            var access = LibrarianAccess.Resolve(service, service.User);
            Assert.True(access.Available);
            Assert.False(access.Global);
            Assert.True(access.CanManage(service, service.Solution));
            Assert.NotEqual(service.OwnedCapability, service.Solution.GetAttributeValue<EntityReference>("nx_capability").Id);
            service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            Assert.False(access.CanManage(service, service.Solution));
            service.Solution.Attributes.Remove("nx_capability");
            Assert.False(access.CanManage(service, service.Solution));
        }

        [Theory]
        [InlineData("role")]
        [InlineData("owner")]
        [InlineData("inactive-capability")]
        [InlineData("inactive-area")]
        [InlineData("missing-area")]
        public void MissingOrRevokedScopeDoesNotGrantLibrarianAccess(string reason)
        {
            var service = new AccessService();
            if (reason == "role") service.Role = "System Administrator";
            if (reason == "owner") service.Capabilities[service.OwnedCapability]["nx_capabilityowner"] = new EntityReference("cr6b0_consultant", Guid.NewGuid());
            if (reason == "inactive-capability") service.Capabilities[service.OwnedCapability]["statecode"] = new OptionSetValue(1);
            if (reason == "inactive-area") service.AreaActive = false;
            if (reason == "missing-area") service.Capabilities[service.OwnedCapability].Attributes.Remove("nx_specializationarea");
            var access = LibrarianAccess.Resolve(service, service.User);
            Assert.False(access.Available);
            Assert.False(access.CanManage(service, service.Solution));
            Assert.Throws<InvalidPluginExecutionException>(() => access.FilterQueue(new QueryExpression("nx_solution")));
        }

        [Fact]
        public void ScopeIsRecomputedAfterOwnershipChangesAndCombinesOwnedAreas()
        {
            var service = new AccessService();
            service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            Assert.False(LibrarianAccess.Resolve(service, service.User).CanManage(service, service.Solution));
            service.Capabilities[service.OtherCapability]["nx_capabilityowner"] = new EntityReference("cr6b0_consultant", service.Person);
            Assert.True(LibrarianAccess.Resolve(service, service.User).CanManage(service, service.Solution));
            service.Capabilities[service.OtherCapability].Attributes.Remove("nx_capabilityowner");
            Assert.False(LibrarianAccess.Resolve(service, service.User).CanManage(service, service.Solution));
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void OnlyExplicitGlobalRoleBypassesScopeAndIdentityMapping(bool inherited)
        {
            var service = new AccessService { Role = LibrarianAccess.GlobalRole, Inherited = inherited, ConsultantCount = 0 };
            service.Solution.Attributes.Remove("nx_capability");
            var access = LibrarianAccess.Resolve(service, service.User);
            Assert.True(access.Global);
            Assert.True(access.CanManage(service, service.Solution));
            var query = new QueryExpression("nx_solution");
            access.FilterQueue(query);
            Assert.Empty(query.LinkEntities);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(2)]
        public void MissingOrAmbiguousConsultantFailsExplicitly(int count)
        {
            var service = new AccessService { ConsultantCount = count };
            Assert.Contains("unique active consultant", Assert.Throws<InvalidPluginExecutionException>(() => LibrarianAccess.Resolve(service, service.User)).Message);
        }

        [Fact]
        public void QueueScopeIsAppliedBeforePagingAndReturnsOnlyMainAreaMatches()
        {
            var service = new AccessService();
            var context = service.Context("nx_GetSubmissions");
            context.Input["ReviewQueue"] = true;
            context.Input["PageNumber"] = 2;
            context.Input["PagingCookie"] = "previous";
            new ReviewApi().Execute(context);
            Assert.Equal(2, service.LastQueue.PageInfo.PageNumber);
            Assert.Equal(100, service.LastQueue.PageInfo.Count);
            Assert.Equal("previous", service.LastQueue.PageInfo.PagingCookie);
            var link = Assert.Single(service.LastQueue.LinkEntities);
            Assert.Equal("nx_capability", link.LinkToEntityName);
            Assert.Equal("nx_capability", link.LinkFromAttributeName);
            var area = Assert.Single(link.LinkCriteria.Conditions, condition => condition.AttributeName == "nx_specializationarea");
            Assert.Equal(ConditionOperator.In, area.Operator);
            Assert.Equal(service.Area, Assert.Single(area.Values));
            var json = (string)context.Output["ResultJson"];
            Assert.Contains(service.Solution.Id.ToString(), json);
            Assert.DoesNotContain(service.Outside.Id.ToString(), json);
            Assert.Contains("\"librarian\":true", json);
            Assert.Contains("\"moreRecords\":true", json);
            Assert.Contains("\"pagingCookie\":\"next\"", json);
        }

        [Theory]
        [InlineData("nx_GetSubmission")]
        [InlineData("nx_TransitionSubmission")]
        [InlineData("nx_SaveCoreDraft")]
        [InlineData("nx_GetDraftGraph")]
        [InlineData("nx_SaveDraftGraph")]
        [InlineData("nx_GetDraftMedia")]
        [InlineData("nx_BeginMediaUpload")]
        [InlineData("nx_UploadMediaBlock")]
        [InlineData("nx_FinishMediaUpload")]
        [InlineData("nx_RemoveDraftMedia")]
        [InlineData("nx_BeginResumableUpload")]
        [InlineData("nx_GetUploadCheckpoint")]
        [InlineData("nx_ReadVideoRange")]
        public void EverySubmissionSurfaceRejectsAnotherAreaBeforeMutation(string message)
        {
            var service = new AccessService();
            service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            var context = service.Context(message);
            IPlugin plugin = message == DraftPolicy.SaveMessage ? (IPlugin)new DraftApi()
                : message == DraftGraph.ReadMessage || message == DraftGraph.SaveMessage ? new DraftGraphApi()
                : message == "nx_ReadVideoRange" || message == "nx_BeginResumableUpload" || message == "nx_GetUploadCheckpoint" ? new MediaTransferApi()
                : message == "nx_GetSubmission" || message == ReviewPolicy.Transition ? new ReviewApi()
                : (IPlugin)new MediaApi();
            Assert.Throws<InvalidPluginExecutionException>(() => plugin.Execute(context));
            Assert.Equal(0, service.Writes);
            Assert.Empty(context.Output);
        }

        [Fact]
        public void ScopedCoreEditUsesServerRightsAndRejectsMovingOutsideScope()
        {
            var service = new AccessService();
            var context = service.Context(DraftPolicy.SaveMessage);
            context.Input["DraftJson"] = "{\"name\":\"Updated\",\"capabilityId\":\"" + service.OtherCapability + "\"}";
            Assert.Contains("new main capability", Assert.Throws<InvalidPluginExecutionException>(() => new DraftApi().Execute(context)).Message);
            Assert.Equal(0, service.Writes);
            context.Input["DraftJson"] = "{\"name\":\"Updated\",\"capabilityId\":\"" + service.SameAreaCapability + "\"}";
            new DraftApi().Execute(context);
            Assert.Equal("Updated", service.Solution.GetAttributeValue<string>("nx_solutionname"));
            Assert.Equal(ReviewPolicy.Pending, service.Solution.GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value);
            Assert.True(service.Solution.GetAttributeValue<bool>(DraftPolicy.LibrarianEditPending));
            Assert.NotEmpty(context.Output);
        }

        [Fact]
        public void SelfApprovalIsAllowedOnlyWithinScopeAndOwnerDraftEditingStillWorks()
        {
            var service = new AccessService();
            service.Solution["ownerid"] = new EntityReference("systemuser", service.User);
            var access = LibrarianAccess.Resolve(service, service.User);
            Assert.Equal(ReviewPolicy.Published, ReviewPolicy.Change(service.Solution, service.User, access.CanManage(service, service.Solution), "1", "approve", "", true)
                .GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value);
            service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(service.Solution, service.User, access.CanManage(service, service.Solution), "1", "approve", "", true));
            service.Solution["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus);
            bool librarian;
            var parent = access.ReadSolution(service.Restricted, service, service.User, service.Solution.Id, new ColumnSet("nx_publicationstatus"), out librarian);
            Assert.False(librarian);
            Assert.Equal(EditMode.Owner, DraftPolicy.Editable(parent, service.User, "1", () => librarian));
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public void ImagesUseScopedServerReadsWithNoDirectReadPrivilege(bool chunking)
        {
            var service = new AccessService { Chunking = chunking };
            var context = service.Context("nx_ReadVideoRange");
            context.Input["Mode"] = "image";
            new MediaTransferApi().Execute(context);
            Assert.Contains("\"content\":\"YWJj\"", (string)context.Output["ResultJson"]);
            Assert.Equal(0, service.Writes);
        }

        [Fact]
        public void ImageReadRejectsOwnershipRevocationDuringDownload()
        {
            var service = new AccessService { RevokeOnDownload = true };
            var context = service.Context("nx_ReadVideoRange");
            context.Input["Mode"] = "image";
            Assert.Throws<InvalidPluginExecutionException>(() => new MediaTransferApi().Execute(context));
            Assert.Empty(context.Output);
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void PrivateSuggestionsDoNotInheritLibrarianAccessFromAnotherArea(bool outside)
        {
            var service = new AccessService { PublishedReadable = true };
            service.Solution["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Published);
            if (outside) service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            var context = service.Context(SuggestionPolicy.ListMessage);
            new SuggestionApi().Execute(context);
            Assert.Contains("\"canRead\":" + (outside ? "false" : "true"), (string)context.Output["ResultJson"]);
        }

        [Theory]
        [InlineData(ReviewPolicy.Published, false, true)]
        [InlineData(ReviewPolicy.Pending, false, false)]
        [InlineData(ReviewPolicy.Pending, true, true)]
        public void ImagePolicyPreservesPublishedReadsButRestrictsUnpublished(int status, bool librarian, bool allowed)
        {
            var service = new AccessService();
            service.Solution["nx_publicationstatus"] = new OptionSetValue(status);
            Action read = () => MediaTransferPolicy.ReadAccess(service.Solution, service.User, librarian, "image");
            if (allowed) read(); else Assert.Throws<InvalidPluginExecutionException>(read);
        }

        private sealed class AccessService : IOrganizationService
        {
            public readonly Guid User = Guid.NewGuid(), Person = Guid.NewGuid(), Area = Guid.NewGuid(), OtherArea = Guid.NewGuid();
            public readonly Guid OwnedCapability = Guid.NewGuid(), SameAreaCapability = Guid.NewGuid(), OtherCapability = Guid.NewGuid(), Asset = Guid.NewGuid();
            public readonly Dictionary<Guid, Entity> Capabilities = new Dictionary<Guid, Entity>();
            public Entity Solution, Outside, Session;
            public string Role = LibrarianAccess.ScopedRole;
            public bool Inherited, RevokeOnDownload, PublishedReadable;
            public bool AreaActive = true, Chunking = true;
            public int ConsultantCount = 1, Writes;
            public QueryExpression LastQueue;
            public IOrganizationService Restricted { get { return new CallerService(this); } }

            public AccessService()
            {
                Capabilities[OwnedCapability] = Capability(OwnedCapability, Area);
                Capabilities[OwnedCapability]["nx_capabilityowner"] = new EntityReference("cr6b0_consultant", Person);
                Capabilities[SameAreaCapability] = Capability(SameAreaCapability, Area);
                Capabilities[OtherCapability] = Capability(OtherCapability, OtherArea);
                Solution = new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "1",
                    ["ownerid"] = new EntityReference("systemuser", Guid.NewGuid()), ["nx_capability"] = new EntityReference("nx_capability", SameAreaCapability),
                    ["nx_solutionname"] = "Solution", ["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Pending),
                    ["nx_status"] = new OptionSetValue(125060001), ["statecode"] = new OptionSetValue(0), ["modifiedon"] = DateTime.UtcNow };
                Outside = new Entity("nx_solution", Guid.NewGuid()) { ["nx_capability"] = new EntityReference("nx_capability", OtherCapability) };
                Session = new Entity("nx_uploadsession", Guid.NewGuid()) {
                    ["nx_parentid"] = Solution.Id.ToString("D"), ["nx_targetid"] = Asset.ToString("D"), ["nx_kind"] = "image",
                    ["nx_mime"] = "image/png", ["nx_bytes"] = 3, ["nx_complete"] = true
                };
            }

            private Entity Capability(Guid id, Guid area) { return new Entity("nx_capability", id) { ["nx_specializationarea"] = new EntityReference("nx_specializationarea", area), ["statecode"] = new OptionSetValue(0) }; }
            public TestPluginContext Context(string message)
            {
                var context = new TestPluginContext(User, message) { Service = this, CallerService = Restricted };
                context.Input["SolutionId"] = Solution.Id;
                context.Input["ExpectedRowVersion"] = "1";
                context.Input["DraftJson"] = "{\"name\":\"Updated\"}";
                context.Input["Action"] = "approve";
                context.Input["Cleared"] = true;
                context.Input["Mode"] = "submission";
                context.Input["AssetId"] = Asset;
                context.Input["Offset"] = 0;
                context.Input["Count"] = 3;
                return context;
            }

            public Entity Retrieve(string table, Guid id, ColumnSet columns)
            {
                if (table == "systemuser") return new Entity(table, id) { ["internalemailaddress"] = "owner@example.test" };
                if (table == "nx_capability") return Capabilities[id];
                if (table == "nx_solution") { Assert.Equal(Solution.Id, id); return Solution; }
                if (table == "nx_solutionimage") { Assert.Equal(Asset, id); return new Entity(table, id) { RowVersion = "2", ["nx_solution"] = Solution.ToEntityReference() }; }
                throw new NotSupportedException(table);
            }

            public EntityCollection RetrieveMultiple(QueryBase request)
            {
                var query = Assert.IsType<QueryExpression>(request);
                if (query.EntityName == "role")
                {
                    var name = (string)Assert.Single(query.Criteria.Conditions).Values[0];
                    var inherited = Assert.Single(query.LinkEntities).LinkToEntityName == "teamroles";
                    return Rows(name == Role && inherited == Inherited ? new[] { new Entity("role", Guid.NewGuid()) } : Array.Empty<Entity>());
                }
                if (query.EntityName == "cr6b0_consultant")
                {
                    Assert.Contains(query.Criteria.Conditions, condition => condition.AttributeName == "cr6b0_email" && (string)condition.Values[0] == "owner@example.test");
                    Assert.Contains(query.Criteria.Conditions, condition => condition.AttributeName == "statecode" && (int)condition.Values[0] == 0);
                    return Rows(Enumerable.Range(0, ConsultantCount).Select(index => new Entity(query.EntityName, index == 0 ? Person : Guid.NewGuid())));
                }
                if (query.EntityName == "nx_capability")
                {
                    Assert.Contains(query.Criteria.Conditions, condition => condition.AttributeName == "nx_capabilityowner" && (Guid)condition.Values[0] == Person);
                    Assert.Contains(query.Criteria.Conditions, condition => condition.AttributeName == "statecode" && (int)condition.Values[0] == 0);
                    Assert.Equal("nx_specializationarea", Assert.Single(query.LinkEntities).LinkToEntityName);
                    return Rows(Capabilities.Values.Where(row => AreaActive && row.GetAttributeValue<EntityReference>("nx_capabilityowner")?.Id == Person
                        && row.GetAttributeValue<OptionSetValue>("statecode")?.Value == 0 && row.GetAttributeValue<EntityReference>("nx_specializationarea") != null));
                }
                if (query.EntityName == "nx_solution")
                {
                    LastQueue = query;
                    var areaFilter = Assert.Single(query.LinkEntities).LinkCriteria.Conditions.Single(condition => condition.AttributeName == "nx_specializationarea");
                    return new EntityCollection(new[] { Solution, Outside }.Where(row => areaFilter.Values.Contains(Capabilities[row.GetAttributeValue<EntityReference>("nx_capability").Id].GetAttributeValue<EntityReference>("nx_specializationarea").Id)).ToList()) { MoreRecords = true, PagingCookie = "next" };
                }
                if (query.EntityName == "nx_uploadsession")
                    return query.Criteria.Conditions.Any(condition => condition.AttributeName == "nx_targetid") ? Rows(new[] { Session }) : Rows(Array.Empty<Entity>());
                if (query.EntityName == "nx_specializationarea") return Rows(new[] { new Entity(query.EntityName, Area) });
                if (query.EntityName == "nx_solutioncontributor" || query.EntityName == "nx_solutionsuggestion") return Rows(Array.Empty<Entity>());
                throw new NotSupportedException(query.EntityName);
            }

            public OrganizationResponse Execute(OrganizationRequest request)
            {
                var update = request as UpdateRequest;
                if (update != null) { Assert.Equal(ConcurrencyBehavior.IfRowVersionMatches, update.ConcurrencyBehavior); Update(update.Target); return new UpdateResponse(); }
                var download = request as InitializeFileBlocksDownloadRequest;
                if (download != null)
                {
                    Assert.Equal("nx_imagefile", download.FileAttributeName);
                    return new InitializeFileBlocksDownloadResponse { Results = new ParameterCollection { ["FileSizeInBytes"] = 3L, ["IsChunkingSupported"] = Chunking, ["FileContinuationToken"] = "private" } };
                }
                if (request is DownloadBlockRequest)
                {
                    if (RevokeOnDownload) Capabilities[OwnedCapability].Attributes.Remove("nx_capabilityowner");
                    return new DownloadBlockResponse { Results = new ParameterCollection { ["Data"] = new byte[] { 97, 98, 99 } } };
                }
                throw new NotSupportedException(request.RequestName);
            }

            public void Update(Entity row) { Writes++; Assert.Equal(Solution.Id, row.Id); foreach (var attribute in row.Attributes) Solution[attribute.Key] = attribute.Value; Solution.RowVersion = (int.Parse(Solution.RowVersion) + 1).ToString(); }
            private static EntityCollection Rows(IEnumerable<Entity> rows) { return new EntityCollection(rows.ToList()); }
            public Guid Create(Entity row) { throw new NotSupportedException(); }
            public void Delete(string table, Guid id) { throw new NotSupportedException(); }
            public void Associate(string table, Guid id, Relationship relationship, EntityReferenceCollection rows) { throw new NotSupportedException(); }
            public void Disassociate(string table, Guid id, Relationship relationship, EntityReferenceCollection rows) { throw new NotSupportedException(); }
        }

        private sealed class CallerService : IOrganizationService
        {
            private readonly AccessService service;
            public CallerService(AccessService service) { this.service = service; }
            public Entity Retrieve(string table, Guid id, ColumnSet columns)
            {
                if (table == "nx_solution" && service.Solution.GetAttributeValue<EntityReference>("ownerid").Id != service.User
                    && !(service.PublishedReadable && service.Solution.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value == ReviewPolicy.Published))
                    throw new InvalidPluginExecutionException("No direct solution read privilege.");
                if (table == "nx_solutionimage") throw new InvalidPluginExecutionException("No direct image read privilege.");
                return service.Retrieve(table, id, columns);
            }
            public EntityCollection RetrieveMultiple(QueryBase query) { throw new InvalidPluginExecutionException("No organization-wide query privilege."); }
            public OrganizationResponse Execute(OrganizationRequest request) { throw new InvalidPluginExecutionException("No direct write/download privilege."); }
            public Guid Create(Entity row) { throw new NotSupportedException(); }
            public void Update(Entity row) { throw new NotSupportedException(); }
            public void Delete(string table, Guid id) { throw new NotSupportedException(); }
            public void Associate(string table, Guid id, Relationship relationship, EntityReferenceCollection rows) { throw new NotSupportedException(); }
            public void Disassociate(string table, Guid id, Relationship relationship, EntityReferenceCollection rows) { throw new NotSupportedException(); }
        }
    }
}
