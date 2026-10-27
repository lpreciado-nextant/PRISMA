using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
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

        [Fact]
        public void ScopeNamesTheManagedAreasAndOwnedCapabilitiesOrGlobalForTheQueueFilters()
        {
            var service = new AccessService();
            var scope = LibrarianAccess.Resolve(service, service.User).Scope();
            Assert.False(scope.Global);
            Assert.Equal(new[] { service.Area.ToString("D") }, scope.AreaIds);
            // Only the capability the librarian owns, not every capability of the area they manage.
            Assert.Equal(new[] { service.OwnedCapability.ToString("D") }, scope.CapabilityIds);
            Assert.Contains("\"scope\":{\"areaIds\":[\"" + service.Area + "\"],\"capabilityIds\":[\"" + service.OwnedCapability + "\"],\"global\":false}", DraftPolicy.Serialize(new SubmissionPage { Records = new List<SubmissionSummary>(), Scope = scope }));
            Assert.DoesNotContain("\"scope\"", DraftPolicy.Serialize(new SubmissionPage { Records = new List<SubmissionSummary>() }));

            var global = LibrarianAccess.Resolve(new AccessService { Role = LibrarianAccess.GlobalRole }, service.User).Scope();
            Assert.True(global.Global);
            Assert.Empty(global.AreaIds);
            Assert.Empty(global.CapabilityIds);
            Assert.Null(LibrarianAccess.Resolve(new AccessService { Role = "Basic User" }, service.User).Scope());
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
            Assert.False(access.CanView(service, service.Solution));
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
        public void QueueShowsEveryAreaAndMarksOnlyTheLibrariansOwnRowsAsManageable()
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
            // No area filter before paging: every librarian reads the whole queue.
            Assert.Empty(service.LastQueue.LinkEntities);
            var json = (string)context.Output["ResultJson"];
            Assert.Contains("\"id\":\"" + service.Solution.Id + "\"", json);
            Assert.Contains("\"id\":\"" + service.Outside.Id + "\"", json);
            // Deciding stays with the area: the outside row says so.
            var own = json.IndexOf(service.Solution.Id.ToString(), StringComparison.Ordinal);
            var outside = json.IndexOf(service.Outside.Id.ToString(), StringComparison.Ordinal);
            Assert.Contains("\"manage\":true", own < outside ? json.Substring(own, outside - own) : json.Substring(own));
            Assert.Contains("\"manage\":false", outside < own ? json.Substring(outside, own - outside) : json.Substring(outside));
            Assert.Contains("\"librarian\":true", json);
            Assert.Contains("\"moreRecords\":true", json);
            Assert.Contains("\"pagingCookie\":\"next\"", json);
        }

        [Theory]
        [InlineData(ReviewPolicy.Pending)]
        [InlineData(ReviewPolicy.Published)]
        [InlineData(DraftPolicy.DraftStatus)]
        public void AnotherAreasQueueRecordIsReadableButNeverDecidable(int status)
        {
            var service = new AccessService();
            service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            service.Solution["nx_publicationstatus"] = new OptionSetValue(status);
            service.Solution["nx_reviewoutcome"] = new OptionSetValue(SuggestionPolicy.ChangesRequested);
            var read = service.Context("nx_GetSubmission");
            new ReviewApi().Execute(read);
            var json = (string)read.Output["ResultJson"];
            Assert.Contains("\"librarian\":false", json);
            Assert.Contains("\"librarianEdit\":false", json);
            Assert.Contains("\"viewer\":true", json);
            Assert.Equal(0, service.Writes);
            // Its images and attachments are readable too.
            var image = service.Context("nx_ReadVideoRange");
            image.Input["Mode"] = "image";
            new MediaTransferApi().Execute(image);
            Assert.Contains("\"content\":\"YWJj\"", (string)image.Output["ResultJson"]);
            Assert.Equal(0, service.Writes);
        }

        [Theory]
        [InlineData("submission", "application/pdf", true)]
        [InlineData("submission", "text/html", true)]
        [InlineData("submission", "video/mp4", true)]
        [InlineData("published", "video/mp4", false)]
        [InlineData("present", "video/mp4", false)]
        public void CrossAreaFilesUseProtectedSubmissionReadsAndRequireCompletion(string mode, string mime, bool allowed)
        {
            var service = new AccessService();
            service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            service.Session["nx_kind"] = "attachment";
            service.Session["nx_mime"] = mime;
            var context = service.Context("nx_ReadVideoRange");
            context.Input["Mode"] = mode;
            if (allowed)
            {
                new MediaTransferApi().Execute(context);
                Assert.Contains("\"content\":\"YWJj\"", (string)context.Output["ResultJson"]);
                context.Output.Clear();
                service.Session["nx_complete"] = false;
                Assert.Throws<InvalidPluginExecutionException>(() => new MediaTransferApi().Execute(context));
                Assert.Empty(context.Output);
            }
            else Assert.Throws<InvalidPluginExecutionException>(() => new MediaTransferApi().Execute(context));
            Assert.Equal(0, service.Writes);
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void CrossAreaMediaRechecksRevocationAndQueueExitBeforeReturningBytes(bool revoke)
        {
            var service = new AccessService { RevokeOnDownload = revoke, LeaveQueueOnDownload = !revoke };
            service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            var context = service.Context("nx_ReadVideoRange");
            context.Input["Mode"] = "image";
            Assert.Throws<InvalidPluginExecutionException>(() => new MediaTransferApi().Execute(context));
            Assert.Empty(context.Output);
        }

        [Theory]
        [InlineData(ReviewPolicy.Pending)]
        [InlineData(ReviewPolicy.Published)]
        [InlineData(DraftPolicy.DraftStatus)]
        public void InactiveRecordsNeverGainCrossAreaReadAccess(int status)
        {
            var service = new AccessService();
            service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            service.Solution["nx_publicationstatus"] = new OptionSetValue(status);
            service.Solution["nx_reviewoutcome"] = new OptionSetValue(SuggestionPolicy.ChangesRequested);
            service.Solution["statecode"] = new OptionSetValue(1);
            Assert.False(LibrarianAccess.Resolve(service, service.User).CanView(service, service.Solution));
            Assert.Throws<InvalidPluginExecutionException>(() => new ReviewApi().Execute(service.Context("nx_GetSubmission")));
            Assert.Throws<InvalidPluginExecutionException>(() => new SuggestionApi().Execute(service.Context(SuggestionPolicy.ListMessage)));
            Assert.Equal(0, service.Writes);
        }

        [Fact]
        public void AnotherAreasDraftOutsideTheQueueStaysClosed()
        {
            var service = new AccessService();
            service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            service.Solution["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus);
            foreach (var message in new[] { "nx_GetSubmission", "nx_ReadVideoRange" })
            {
                var context = service.Context(message);
                IPlugin plugin = message == "nx_GetSubmission" ? (IPlugin)new ReviewApi() : new MediaTransferApi();
                Assert.Throws<InvalidPluginExecutionException>(() => plugin.Execute(context));
                Assert.Empty(context.Output);
            }
            // Returned with Changes requested, it is back in the queue and readable.
            service.Solution["nx_reviewoutcome"] = new OptionSetValue(SuggestionPolicy.ChangesRequested);
            var returned = service.Context("nx_GetSubmission");
            new ReviewApi().Execute(returned);
            Assert.Contains("\"viewer\":true", (string)returned.Output["ResultJson"]);
        }

        [Theory]
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
        public void EveryDecisionAndEditSurfaceRejectsAnotherAreaBeforeMutation(string message)
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
        public void PrivateSuggestionsAreReadableByLibrariansOfEveryArea(bool outside)
        {
            var service = new AccessService { PublishedReadable = true };
            service.Solution["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Published);
            if (outside) service.Solution["nx_capability"] = new EntityReference("nx_capability", service.OtherCapability);
            var context = service.Context(SuggestionPolicy.ListMessage);
            new SuggestionApi().Execute(context);
            Assert.Contains("\"canRead\":true", (string)context.Output["ResultJson"]);
        }

        [Fact]
        public void SuggestionsStayClosedToANonLibrarian()
        {
            var service = new AccessService { PublishedReadable = true, Role = "Basic User" };
            service.Solution["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Published);
            var context = service.Context(SuggestionPolicy.ListMessage);
            new SuggestionApi().Execute(context);
            Assert.Contains("\"canRead\":false", (string)context.Output["ResultJson"]);
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
            public bool Inherited, RevokeOnDownload, LeaveQueueOnDownload, PublishedReadable;
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
                Outside = new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "1",
                    ["ownerid"] = new EntityReference("systemuser", Guid.NewGuid()), ["nx_capability"] = new EntityReference("nx_capability", OtherCapability),
                    ["nx_solutionname"] = "Outside", ["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Pending),
                    ["nx_status"] = new OptionSetValue(125060001), ["statecode"] = new OptionSetValue(0), ["modifiedon"] = DateTime.UtcNow };
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
                if (table == "nx_solutionimage" || table == "nx_demoasset") { Assert.Equal(Asset, id); return new Entity(table, id) { RowVersion = "2", ["nx_solution"] = Solution.ToEntityReference() }; }
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
                    return new EntityCollection(new List<Entity> { Solution, Outside }) { MoreRecords = true, PagingCookie = "next" };
                }
                if (query.EntityName == "nx_uploadsession")
                    return query.Criteria.Conditions.Any(condition => condition.AttributeName == "nx_targetid") ? Rows(new[] { Session }) : Rows(Array.Empty<Entity>());
                if (query.EntityName == "nx_specializationarea") return Rows(new[] { new Entity(query.EntityName, Area) });
                if (query.EntityName == "nx_solutioncontributor" || query.EntityName == "nx_solutionsuggestion") return Rows(Array.Empty<Entity>());
                // Tag intersect tables (technologies, industries, projects, client roles, secondary capability): none linked.
                if (DraftGraph.Relationships.Concat(new[] { DraftGraph.SecondaryRelationship }).Any(name => name.ToLowerInvariant() == query.EntityName)) return Rows(Array.Empty<Entity>());
                throw new NotSupportedException(query.EntityName);
            }

            public OrganizationResponse Execute(OrganizationRequest request)
            {
                var update = request as UpdateRequest;
                if (update != null) { Assert.Equal(ConcurrencyBehavior.IfRowVersionMatches, update.ConcurrencyBehavior); Update(update.Target); return new UpdateResponse(); }
                var download = request as InitializeFileBlocksDownloadRequest;
                if (download != null)
                {
                    Assert.Equal(Session.GetAttributeValue<string>("nx_kind") == "attachment" ? "nx_filemedia" : "nx_imagefile", download.FileAttributeName);
                    return new InitializeFileBlocksDownloadResponse { Results = new ParameterCollection { ["FileSizeInBytes"] = 3L, ["IsChunkingSupported"] = Chunking, ["FileContinuationToken"] = "private" } };
                }
                var relationship = request as RetrieveRelationshipRequest;
                if (relationship != null)
                    return new RetrieveRelationshipResponse { Results = new ParameterCollection { ["RelationshipMetadata"] = new ManyToManyRelationshipMetadata {
                        Entity1LogicalName = "nx_solution", Entity1IntersectAttribute = "nx_solutionid", Entity2LogicalName = "tag",
                        Entity2IntersectAttribute = "tagid", IntersectEntityName = relationship.Name.ToLowerInvariant()
                    } } };
                if (request is DownloadBlockRequest)
                {
                    if (RevokeOnDownload) Capabilities[OwnedCapability].Attributes.Remove("nx_capabilityowner");
                    if (LeaveQueueOnDownload) Solution["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Retired);
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
