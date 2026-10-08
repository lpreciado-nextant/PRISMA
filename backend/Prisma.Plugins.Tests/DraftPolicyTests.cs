using System;
using Microsoft.Xrm.Sdk;
using Xunit;

namespace Prisma.Plugins.Tests
{
    public class DraftPolicyTests
    {
        private const string Area = "22222222-2222-2222-2222-222222222222";
        private static string Input(string extra = "") { return "{\"name\":\"Named draft\"" + extra + "}"; }

        [Fact]
        public void CoreStoryContractExcludesRetiredField()
        {
            var entity = DraftPolicy.Parse(Input(",\"whatItDoes\":\"Actions\",\"businessValue\":\"Benefits\""));
            Assert.Equal("Actions", entity.GetAttributeValue<string>("nx_whatitdoes"));
            Assert.Equal("Benefits", entity.GetAttributeValue<string>("nx_businessvalue"));
            Assert.False(entity.Contains("nx_usecase"));
            Assert.DoesNotContain("nx_usecase", DraftPolicy.CoreColumns);
            Assert.DoesNotContain("useCase", DraftPolicy.Serialize(new DraftSnapshot()));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.Parse(Input(",\"useCase\":\"Retired\"")));
        }

        [Fact]
        public void SpecializationAreasMoveFromCoreLookupToGraph()
        {
            Assert.DoesNotContain("nx_specializationarea", DraftPolicy.CoreColumns);
            Assert.False(DraftPolicy.Parse(Input()).Contains("nx_specializationarea"));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.Parse(Input(",\"areaId\":\"" + Area + "\"")));
            Assert.DoesNotContain("areaId", DraftPolicy.Serialize(new DraftSnapshot()));
            Assert.Contains("nx_Solution_nx_SpecializationArea_nx_SpecializationArea", DraftGraph.Relationships);
        }

        [Fact]
        public void SubmissionRequiresSpecializationAreaAndStory()
        {
            var parent = new Entity("nx_solution") { ["nx_solutionname"] = "Named draft", ["nx_onelinesummary"] = "Summary",
                ["nx_capability"] = new EntityReference("nx_capability", Guid.NewGuid()), ["nx_safetyacknowledged"] = false };
            var graph = new DraftGraphSnapshot { Graph = new DraftGraphInput { Contributors = new System.Collections.Generic.List<ContributorInput>(),
                TechnologyIds = new System.Collections.Generic.List<string>(), IndustryIds = new System.Collections.Generic.List<string>(),
                ProjectIds = new System.Collections.Generic.List<string>(), AreaIds = new System.Collections.Generic.List<string>() } };
            var media = new System.Collections.Generic.List<Entity>();
            Assert.Contains("specialization", Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Complete(parent, graph, media)).Message);
            graph.Graph.AreaIds.Add(Area);
            Assert.Contains("business value", Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Complete(parent, graph, media)).Message);
            parent["nx_whatitdoes"] = "Matches invoices.";
            Assert.Contains("business value", Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Complete(parent, graph, media)).Message);
            parent["nx_businessvalue"] = " ";
            Assert.Contains("business value", Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Complete(parent, graph, media)).Message);
            parent["nx_businessvalue"] = "Finance focuses on exceptions.";
            Assert.Contains("safety", Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Complete(parent, graph, media)).Message);
        }

        [Fact]
        public void ResumeRequiresExactFileOwnerExpiryAndConfirmedCheckpoint()
        {
            var parent = Guid.NewGuid(); var owner = Guid.NewGuid(); var now = DateTime.UtcNow;
            var digest = new string('a', 64);
            var session = new Entity("nx_uploadsession") { ["nx_parentid"] = parent.ToString("D"), ["nx_callerid"] = owner.ToString("D"),
                ["nx_name"] = MediaPolicy.LargeSessionPrefix, ["nx_sha256"] = digest, ["nx_filename"] = "video.mp4", ["nx_bytes"] = 5000000,
                ["nx_received"] = 4194304, ["nx_nextblock"] = 1, ["nx_expires"] = now.AddMinutes(1) };
            MediaTransferPolicy.Resume(session, parent, owner, digest, "video.mp4", 5000000, now);
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.Resume(session, parent, Guid.NewGuid(), digest, "video.mp4", 5000000, now));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.Resume(session, parent, owner, new string('b', 64), "video.mp4", 5000000, now));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.Resume(session, parent, owner, digest, "other.mp4", 5000000, now));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.Resume(session, parent, owner, digest, "video.mp4", 5000000, now.AddMinutes(2)));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.Resume(session, parent, owner, digest, "video.mp4", 5000000, now.AddMinutes(1)));
            session["nx_complete"] = true;
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.Resume(session, parent, owner, digest, "video.mp4", 5000000, now));
            session["nx_complete"] = false;
            session.Attributes.Remove("nx_sha256");
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.Resume(session, parent, owner, digest, "video.mp4", 5000000, now));
            session["nx_sha256"] = digest;
            session["nx_received"] = 5000000; session["nx_nextblock"] = 2;
            MediaTransferPolicy.Resume(session, parent, owner, digest, "video.mp4", 5000000, now);
            session["nx_nextblock"] = 3;
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.Resume(session, parent, owner, digest, "video.mp4", 5000000, now));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.Digest(digest + "\n"));
        }

        [Fact]
        public void VideoReadsEnforceModeAndBoundedRanges()
        {
            var owner = Guid.NewGuid();
            var parent = new Entity("nx_solution") { ["ownerid"] = new EntityReference("systemuser", owner), ["statecode"] = new OptionSetValue(0),
                ["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Published), ["nx_clientsafereviewed"] = true, ["nx_safetyacknowledged"] = true };
            MediaTransferPolicy.ReadAccess(parent, Guid.NewGuid(), false, "present");
            parent["nx_clientsafereviewed"] = false;
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.ReadAccess(parent, owner, true, "present"));
            parent["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus);
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.ReadAccess(parent, owner, true, "published"));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.ReadAccess(parent, Guid.NewGuid(), false, "submission"));
            MediaTransferPolicy.ReadAccess(parent, owner, false, "submission");
            Assert.Equal(10, MediaTransferPolicy.ReadLength(90, 100, 100));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.ReadLength(0, MediaTransferPolicy.ReadBlockSize + 1, 5000000));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.ReadLength(100, 1, 100));
            Assert.Equal(MediaTransferPolicy.BlobReadBlockSize, MediaTransferPolicy.ReadLength(0, MediaTransferPolicy.BlobReadBlockSize, 50000000, MediaTransferPolicy.BlobReadBlockSize));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaTransferPolicy.ReadLength(0, MediaTransferPolicy.FileReadBlockSize + 1, 50000000, MediaTransferPolicy.FileReadBlockSize));
            Assert.Contains("\"maxRead\":8388608", DraftPolicy.Serialize(new VideoRange { MaxRead = MediaTransferPolicy.BlobReadBlockSize }));
        }

        [Fact]
        public void LargeUploadsKeepExistingSessionSizesAndEnforceFourMiBBoundaries()
        {
            Assert.Equal(524288, MediaPolicy.RequestedBlockSize("attachment"));
            Assert.Equal(2097152, MediaPolicy.RequestedBlockSize("attachment:v2"));
            Assert.Equal(4194304, MediaPolicy.RequestedBlockSize("attachment:v3"));
            var session = new Entity("nx_uploadsession") { ["nx_name"] = MediaPolicy.LargeSessionPrefix + Guid.NewGuid().ToString("N") };
            Assert.Equal(4194304, MediaPolicy.SessionBlockSize(session));
            var block = Convert.ToBase64String(new byte[4194304]);
            Assert.Equal(4194304, MediaPolicy.Block(block, 0, 0, 4194305, 0, 4194304).Length);
            Assert.Single(MediaPolicy.Block("AA==", 1, 1, 4194305, 4194304, 4194304));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block(block, 0, 0, 4194305, 0, 2097152));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block("AA==", 1, 1, 4194305, 2097152, 4194304));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block("AA==", 2, 1, 4194305, 4194304, 4194304));
            var json = DraftPolicy.Serialize(new MediaResult());
            Assert.Contains("\"uploadProtocol\":2", json);
            Assert.Contains("\"maxBlockSize\":4194304", json);
        }

        [Fact]
        public void BlobUploadsNegotiateEightMiBBlocksAndReportServerTiming()
        {
            Assert.Equal(8388608, MediaPolicy.RequestedBlockSize("attachment:v4"));
            var session = new Entity("nx_uploadsession") { ["nx_name"] = MediaPolicy.BlobSessionPrefix + Guid.NewGuid().ToString("N") };
            Assert.Equal(8388608, MediaPolicy.SessionBlockSize(session));
            var block = Convert.ToBase64String(new byte[8388608]);
            Assert.Equal(8388608, MediaPolicy.Block(block, 0, 0, 8388609, 0, 8388608).Length);
            Assert.Single(MediaPolicy.Block("AA==", 1, 1, 8388609, 8388608, 8388608));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block(block, 0, 0, 8388609, 0, 4194304));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block("AA==", 1, 1, 8388609, 4194304, 8388608));
            Assert.Contains("\"blobBlockSize\":8388608", DraftPolicy.Serialize(new MediaResult()));
            var json = DraftPolicy.Serialize(new MediaProgress { Id = Area, RowVersion = "1", SessionId = Area, BlockSize = 8388608, Received = 8388608, NextBlock = 1, ServerMs = 900, HashMs = 40, StorageMs = 300 });
            Assert.Contains("\"serverMs\":900", json);
            Assert.Contains("\"hashMs\":40", json);
            Assert.Contains("\"storageMs\":300", json);
        }

        [Fact]
        public void BlobUploadsNegotiateSixteenMiBBlocks()
        {
            Assert.Equal(16777216, MediaPolicy.RequestedBlockSize("attachment:v5"));
            var session = new Entity("nx_uploadsession") { ["nx_name"] = MediaPolicy.MaxBlobSessionPrefix + Guid.NewGuid().ToString("N") };
            Assert.Equal(16777216, MediaPolicy.SessionBlockSize(session));
            var block = Convert.ToBase64String(new byte[16777216]);
            Assert.Equal(16777216, MediaPolicy.Block(block, 0, 0, 16777217, 0, 16777216).Length);
            Assert.Single(MediaPolicy.Block("AA==", 1, 1, 16777217, 16777216, 16777216));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block(block, 0, 0, 16777217, 0, 8388608));
            var json = DraftPolicy.Serialize(new MediaResult());
            Assert.Contains("\"maxBlobBlockSize\":16777216", json);
            Assert.Contains("\"blobBlockSize\":8388608", json);
        }

        [Fact]
        public void OptimizedUploadsKeepLegacySessionsAndValidateBlockBoundaries()
        {
            var session = new Entity("nx_uploadsession");
            Assert.Equal(524288, MediaPolicy.SessionBlockSize(session));
            session["nx_name"] = MediaPolicy.OptimizedSessionPrefix + Guid.NewGuid().ToString("N");
            Assert.Equal(2097152, MediaPolicy.SessionBlockSize(session));
            var block = Convert.ToBase64String(new byte[2097152]);
            Assert.Equal(2097152, MediaPolicy.Block(block, 0, 0, 2097153, 0, 2097152).Length);
            Assert.Single(MediaPolicy.Block("AA==", 1, 1, 2097153, 2097152, 2097152));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block(block, 0, 0, 2097153, 0));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block("AA==", 1, 1, 2097153, 524288, 2097152));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block("AA==", 2, 1, 2097153, 2097152, 2097152));
            var json = DraftPolicy.Serialize(new MediaProgress { Id = Area, RowVersion = "123", SessionId = Area, BlockSize = 2097152, Received = 2097152, NextBlock = 1 });
            Assert.Contains("\"uploadProgress\":true", json);
            Assert.DoesNotContain("token", json);
            Assert.DoesNotContain("\"media\"", json);
        }

        [Fact]
        public void LibrarianCanSendAPublishedRecordBackForChanges()
        {
            var owner = Guid.NewGuid();
            var parent = new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "5", ["ownerid"] = new EntityReference("systemuser", owner), ["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Published) };
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, false, "5", "request-changes", "Fix it", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "4", "request-changes", "Fix it", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "5", "request-changes", " ", false));
            var reopened = ReviewPolicy.Change(parent, owner, true, "5", "request-changes", " Remove the client name ", false);
            Assert.Equal(DraftPolicy.DraftStatus, reopened.GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value);
            Assert.Equal(125060001, reopened.GetAttributeValue<OptionSetValue>("nx_reviewoutcome").Value);
            Assert.Equal("Remove the client name", reopened.GetAttributeValue<string>("nx_reviewcomments"));
            Assert.False(reopened.GetAttributeValue<bool>("nx_safetyacknowledged"));
            Assert.False(reopened.GetAttributeValue<bool>("nx_clientsafereviewed"));
            foreach (var status in new[] { DraftPolicy.DraftStatus, ReviewPolicy.Pending, ReviewPolicy.Retired })
            {
                parent["nx_publicationstatus"] = new OptionSetValue(status);
                Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "5", "request-changes", "Fix it", false));
            }
        }

        [Fact]
        public void RetirementRequiresLibrarianAndRestorationRequiresFreshSubmission()
        {
            var owner = Guid.NewGuid();
            var parent = new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "100", ["ownerid"] = new EntityReference("systemuser", owner), ["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Published) };
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, false, "100", "retire", "Replaced", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "99", "retire", "Replaced", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "100", "retire", "  ", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "100", "retire", new string('x', 4001), false));
            var retired = ReviewPolicy.Change(parent, owner, true, "100", "retire", "  Replaced by v2  ", false);
            Assert.Equal(ReviewPolicy.Retired, retired.GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value);
            Assert.Equal("Replaced by v2", retired.GetAttributeValue<string>("nx_reviewcomments"));
            Assert.False(retired.Contains("nx_reviewoutcome"));
            Assert.False(retired.GetAttributeValue<bool>("nx_clientsafereviewed"));
            parent["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Retired);
            parent.RowVersion = "101";
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "101", "approve", "", true));
            var withdrawn = ReviewPolicy.Change(parent, owner, false, "101", "withdraw", "", false);
            Assert.Equal(DraftPolicy.DraftStatus, withdrawn.GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value);
            Assert.False(withdrawn.GetAttributeValue<bool>("nx_safetyacknowledged"));
            parent["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus);
            parent.RowVersion = "102";
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "102", "approve", "", true));
            Assert.Equal(ReviewPolicy.Pending, ReviewPolicy.Change(parent, owner, false, "102", "submit", "", false).GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value);
        }

        [Fact]
        public void ReviewValidatesLinkedMetadataWithoutDownloadingAndStillChecksFiles()
        {
            var service = new StoredMediaService();
            var session = new Entity("nx_uploadsession", Guid.NewGuid()) {
                ["nx_targetid"] = Area, ["nx_kind"] = "attachment", ["nx_filename"] = "Linked demo",
                ["nx_mime"] = LinkedAssetPolicy.Mime, ["nx_complete"] = true, ["nx_bytes"] = 0, ["nx_received"] = 0, ["nx_nextblock"] = 0
            };
            MediaApi.VerifyStoredMedia(service, session);
            Assert.Equal(0, service.Downloads);
            service.Url = "javascript:alert(1)";
            Assert.Throws<InvalidPluginExecutionException>(() => MediaApi.VerifyStoredMedia(service, session));
            service.Url = "https://example.com/";
            session["nx_bytes"] = 10;
            Assert.Throws<InvalidPluginExecutionException>(() => MediaApi.VerifyStoredMedia(service, session));
            session["nx_mime"] = "text/html";
            MediaApi.VerifyStoredMedia(service, session);
            Assert.Equal(1, service.Downloads);
            session["nx_bytes"] = 11;
            Assert.Throws<InvalidPluginExecutionException>(() => MediaApi.VerifyStoredMedia(service, session));
            Assert.Equal(2, service.Downloads);
        }

        private sealed class StoredMediaService : IOrganizationService
        {
            public int Downloads { get; private set; }
            public string Url { get; set; } = "https://example.com/";
            public Entity Retrieve(string entityName, Guid id, Microsoft.Xrm.Sdk.Query.ColumnSet columns)
            {
                Assert.Equal("nx_demoasset", entityName);
                return new Entity(entityName, id) { ["nx_assettype"] = new OptionSetValue(125060007), ["nx_externalurl"] = Url, ["nx_allowsembedding"] = false, ["nx_embedhint"] = "", ["nx_sortorder"] = 1 };
            }
            public OrganizationResponse Execute(OrganizationRequest request)
            {
                Assert.IsType<Microsoft.Crm.Sdk.Messages.InitializeFileBlocksDownloadRequest>(request);
                Downloads++;
                return new Microsoft.Crm.Sdk.Messages.InitializeFileBlocksDownloadResponse { Results = new ParameterCollection { ["FileSizeInBytes"] = 10L } };
            }
            public Guid Create(Entity entity) { throw new NotSupportedException(); }
            public void Update(Entity entity) { throw new NotSupportedException(); }
            public void Delete(string entityName, Guid id) { throw new NotSupportedException(); }
            public EntityCollection RetrieveMultiple(Microsoft.Xrm.Sdk.Query.QueryBase query) { throw new NotSupportedException(); }
            public void Associate(string entityName, Guid id, Relationship relationship, EntityReferenceCollection relatedEntities) { throw new NotSupportedException(); }
            public void Disassociate(string entityName, Guid id, Relationship relationship, EntityReferenceCollection relatedEntities) { throw new NotSupportedException(); }
        }

        [Fact]
        public void LinkedAssetsValidateUrlsTypesAndOwnedDraftTransitions()
        {
            var json = "{\"name\":\"Demo\",\"assetType\":\"Hosted web app (URL)\",\"externalUrl\":\"https://example.com/demo\",\"allowsEmbedding\":true,\"embedHint\":\"\"}";
            Assert.Equal(125060007, LinkedAssetPolicy.Choice(LinkedAssetPolicy.Parse(json).AssetType));
            foreach (var url in new[] { "http://example.com", "javascript:alert(1)", "https://user:pass@example.com", "https://example.com/a b" })
                Assert.Throws<InvalidPluginExecutionException>(() => LinkedAssetPolicy.Parse(json.Replace("https://example.com/demo", url)));
            Assert.Throws<InvalidPluginExecutionException>(() => LinkedAssetPolicy.Parse(json.Replace("Hosted web app (URL)", "Power BI")));
            Assert.Throws<InvalidPluginExecutionException>(() => LinkedAssetPolicy.Parse(json.Replace("\"name\":\"Demo\"", "\"ownerid\":\"fake\",\"name\":\"Demo\"")));
            Assert.Throws<InvalidPluginExecutionException>(() => LinkedAssetPolicy.Validate(new LinkedAssetInput { Name = "Desktop", AssetType = "Desktop app or script", ExternalUrl = "", EmbedHint = "" }));
            Assert.Equal(125060004, LinkedAssetPolicy.Choice(LinkedAssetPolicy.Validate(new LinkedAssetInput { Name = "Desktop", AssetType = "Desktop app or script", ExternalUrl = "", EmbedHint = "Contact the builder." }).AssetType));
            var owner = Guid.NewGuid();
            var parent = new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "123", ["ownerid"] = new EntityReference("systemuser", owner), ["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus) };
            Assert.False(ReviewPolicy.Change(parent, owner, false, "123", "asset", json, false).GetAttributeValue<bool>("nx_safetyacknowledged"));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, Guid.NewGuid(), true, "123", "asset", json, false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "122", "asset", json, false));
            parent["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Published);
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "123", "asset", json, false));
        }

        [Fact]
        public void MediaMetadataRejectsProtectedFieldsAndThumbnailsRemainImages()
        {
            var json = "[{\"id\":\"" + Area + "\",\"caption\":\"Dashboard\",\"sortOrder\":0}]";
            Assert.Single(MediaPolicy.ParseMetadata(json));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.ParseMetadata(json.Replace("\"sortOrder\":0", "\"sortOrder\":0,\"ownerid\":\"fake\"")));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.ParseMetadata(json.Replace("Dashboard", new string('x', 201))));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.ParseMetadata(json.Replace("\"sortOrder\":0", "\"sortOrder\":-1")));
            Assert.Equal("image/png", MediaPolicy.Mime("thumbnail", "card.png", 10));
            Assert.Equal("nx_solutionimage", MediaPolicy.Table("thumbnail"));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Mime("thumbnail", "card.html", 10));
        }

        [Fact]
        public void LinkedUrlContractPreservesLongValuesAndRejectsOverLimit()
        {
            const string prefix = "https://example.com/";
            foreach (var length in new[] { 100, 101, 163, 230, 2000 })
            {
                var url = prefix + new string('a', length - prefix.Length);
                var input = new LinkedAssetInput { Name = "Application", AssetType = "Power Apps", ExternalUrl = url, AllowsEmbedding = false, EmbedHint = "" };
                Assert.Equal(url, LinkedAssetPolicy.Parse(DraftPolicy.Serialize(input)).ExternalUrl);
            }
            const string fullUrl = "https://apps.powerapps.com/play/e/example/a/example?tenantId=example&source=one%20two#view";
            Assert.Equal(fullUrl, LinkedAssetPolicy.Validate(new LinkedAssetInput { Name = "Application", AssetType = "Power Apps", ExternalUrl = fullUrl, EmbedHint = "" }).ExternalUrl);
            Assert.Throws<InvalidPluginExecutionException>(() => LinkedAssetPolicy.Validate(new LinkedAssetInput { Name = "Application", AssetType = "Power Apps", ExternalUrl = prefix + new string('a', 2001 - prefix.Length), EmbedHint = "" }));
        }

        [Fact]
        public void PresentationCreditsOmitInternalOptionalFields()
        {
            var json = DraftPolicy.Serialize(new PublishedDetail { Contributors = new[] { new PublishedCredit { Name = "Consultant", Hours = null } } });
            Assert.DoesNotContain("email", json);
            Assert.DoesNotContain("effort", json);
            Assert.DoesNotContain("libraryNotes", json);
            Assert.DoesNotContain("level", json);
            Assert.Contains("\"level\":\"Customer Success Manager\"", DraftPolicy.Serialize(new PublishedCredit { Name = "CSM", Level = "Customer Success Manager" }));
        }

        [Fact]
        public void TechnologyCreationRequiresOwnedDraftAndValidatedName()
        {
            Assert.Equal("React", ReviewPolicy.TechnologyName("  React  "));
            foreach (var name in new[] { "", "   ", "React\nJS", new string('x', 101) }) Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.TechnologyName(name));
            var owner = Guid.NewGuid();
            var parent = new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "123", ["ownerid"] = new EntityReference("systemuser", owner), ["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus) };
            var change = ReviewPolicy.Change(parent, owner, false, "123", "technology", "React", false);
            Assert.False(change.GetAttributeValue<bool>("nx_safetyacknowledged"));
            Assert.False(change.GetAttributeValue<bool>("nx_clientsafereviewed"));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, Guid.NewGuid(), true, "123", "technology", "React", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, false, "122", "technology", "React", false));
            parent["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Published);
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "123", "technology", "React", false));
        }

        [Theory]
        [InlineData(DraftPolicy.DraftStatus)]
        [InlineData(ReviewPolicy.Pending)]
        [InlineData(ReviewPolicy.Published)]
        [InlineData(ReviewPolicy.Retired)]
        public void DeleteRequiresOwnerAndExactVersionInEverySupportedState(int status)
        {
            var owner = Guid.NewGuid();
            var parent = new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "123", ["ownerid"] = new EntityReference("systemuser", owner), ["nx_publicationstatus"] = new OptionSetValue(status) };
            var change = ReviewPolicy.Change(parent, owner, false, "123", "delete", "", false);
            Assert.Equal(DraftPolicy.DraftStatus, change.GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value);
            Assert.False(change.GetAttributeValue<bool>("nx_clientsafereviewed"));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, Guid.NewGuid(), true, "123", "delete", "", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "122", "delete", "", false));
        }

        [Fact]
        public void ReviewTransitionsRequireOwnerOrExplicitLibrarianAndExactVersion()
        {
            var owner = Guid.NewGuid();
            var parent = new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "123", ["ownerid"] = new EntityReference("systemuser", owner), ["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus) };
            var metadata = ReviewPolicy.Change(parent, owner, false, "123", "media", "[]", false);
            Assert.False(metadata.GetAttributeValue<bool>("nx_safetyacknowledged"));
            Assert.False(metadata.GetAttributeValue<bool>("nx_clientsafereviewed"));
            Assert.False(metadata.Contains("nx_reviewcomments"));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, Guid.NewGuid(), true, "123", "media", "[]", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "122", "media", "[]", false));
            Assert.Equal(ReviewPolicy.Pending, ReviewPolicy.Change(parent, owner, false, "123", "submit", "", false).GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value);
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, Guid.NewGuid(), false, "123", "submit", "", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "122", "submit", "", false));
            parent["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Pending);
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "123", "media", "[]", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, false, "123", "approve", "", true));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "123", "approve", "", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "123", "return", "", false));
            Assert.False(ReviewPolicy.Change(parent, owner, true, "123", "return", "Revise the screenshot", false).GetAttributeValue<bool>("nx_safetyacknowledged"));
            Assert.True(ReviewPolicy.Change(parent, owner, true, "123", "approve", "", true).GetAttributeValue<bool>("nx_clientsafereviewed"));
            parent["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Published);
            Assert.False(ReviewPolicy.Change(parent, owner, false, "123", "withdraw", "", false).GetAttributeValue<bool>("nx_clientsafereviewed"));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, false, "123", "retire", "", false));
        }

        [Theory]
        [InlineData("image", "x.svg", 10)]
        [InlineData("image", "x.html", 10)]
        [InlineData("attachment", "x.png", 10)]
        [InlineData("image", "../x.png", 10)]
        [InlineData("image", "x.png", 0)]
        [InlineData("image", "x.png", 5242881)]
        [InlineData("attachment", "x.pdf", 26214401)]
        public void MediaRejectsUnsupportedNamesTypesAndSizes(string kind, string name, int bytes)
        {
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Mime(kind, name, bytes));
        }

        [Fact]
        public void UploadBlocksAreBoundedSequentialAndExactLength()
        {
            var serialized = DraftPolicy.Serialize(new MediaResult { Id = Area, Media = new[] { new MediaSnapshot { Id = Area, Complete = true } } });
            Assert.Contains("\"media\":[{", serialized);
            Assert.DoesNotContain("token", serialized);
            Assert.Equal("image/png", MediaPolicy.Mime("image", "image.PNG", 10));
            Assert.Equal("text/html", MediaPolicy.Mime("attachment", "demo.html", 10));
            Assert.Equal(new byte[] { 1, 2, 3 }, MediaPolicy.Block("AQID", 0, 0, 3, 0));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block("AQID", 1, 0, 3, 0));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block("AQID", 0, 0, 4, 0));
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.Block("!", 0, 0, 1, 0));
            Assert.Equal(MediaPolicy.BlockId(Guid.Empty, 0).Length, MediaPolicy.BlockId(Guid.Empty, 1000).Length);
        }

        [Fact]
        public void GraphParserRejectsProtectedFieldsAndAcceptsIncompleteContributors()
        {
            var json = "{\"contributors\":[{\"personId\":\"" + Area + "\",\"directHours\":null}],\"technologyIds\":[],\"industryIds\":[],\"projectIds\":[],\"areaIds\":[\"" + Area + "\"]}";
            var graph = DraftGraph.Parse(json);
            Assert.Single(graph.Contributors);
            Assert.Null(graph.Contributors[0].DirectHours);
            Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.Parse(json.Replace("\"directHours\":null", "\"ownerid\":\"fake\"")));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.Parse(json.Replace("\"projectIds\":[]", "\"projectIds\":[],\"approval\":true")));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.Parse(json.Replace("\"technologyIds\":[]", "\"technologyIds\":[\"fake\"]")));
            Assert.Equal(new[] { Area }, graph.AreaIds);
            Assert.Empty(DraftGraph.Parse(json.Replace("\"areaIds\":[\"" + Area + "\"]", "\"areaIds\":[]")).AreaIds);
            Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.Parse(json.Replace(",\"areaIds\":[\"" + Area + "\"]", "")));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.Parse(json.Replace("\"areaIds\":[\"" + Area + "\"]", "\"areaIds\":[\"" + Area + "\",\"" + Area + "\"]")));
        }

        [Fact]
        public void ContributorsPermitIncompleteDraftsButRequireMinimumHoursToSubmit()
        {
            var person = new ContributorInput { PersonId = Area };
            ContributorPolicy.Validate(new[] { person }, false);
            Assert.Throws<InvalidPluginExecutionException>(() => ContributorPolicy.Validate(new[] { person }, true));
            Assert.Throws<InvalidPluginExecutionException>(() => ContributorPolicy.Validate(new[] { person, person }, false));
            person.DirectHours = 0;
            ContributorPolicy.Validate(new[] { person }, true);
            foreach (var invalid in new[] { -1m, 1.001m, 1000000000.01m })
            {
                person.DirectHours = invalid;
                Assert.Throws<InvalidPluginExecutionException>(() => ContributorPolicy.Validate(new[] { person }, false));
            }
        }

        [Fact]
        public void GraphParserIgnoresRetiredDatesAllocationAndRoleFromOlderClients()
        {
            var json = "{\"contributors\":[{\"personId\":\"" + Area + "\",\"directHours\":12.5,\"startDate\":\"2026-01-01\",\"endDate\":\"2026-01-31\",\"allocation\":150,\"roleValue\":125060000}],\"technologyIds\":[],\"industryIds\":[],\"projectIds\":[],\"areaIds\":[]}";
            var person = DraftGraph.Parse(json).Contributors[0];
            Assert.Equal(12.5m, person.DirectHours);
            Assert.DoesNotContain("allocation", DraftPolicy.Serialize(person));
            Assert.DoesNotContain("roleValue", DraftPolicy.Serialize(person));
        }

        [Fact]
        public void NamedIncompleteDraftUsesRealDefaultsWithoutProtectedFields()
        {
            var record = DraftPolicy.Parse(Input());
            Assert.Equal("Named draft", record["nx_solutionname"]);
            Assert.Null(record["nx_capability"]);
            Assert.Null(record["nx_onelinesummary"]);
            Assert.Equal(125060004, record.GetAttributeValue<OptionSetValue>("nx_status").Value);
            Assert.False(record.Contains("nx_publicationstatus"));
            Assert.False(record.Contains("nx_reviewcomments"));
            Assert.False(record.Contains("ownerid"));
        }

        [Theory]
        [InlineData(",\"publicationStatus\":125060000")]
        [InlineData(",\"ownerid\":\"other\"")]
        [InlineData(",\"reviewComments\":\"approved\"")]
        [InlineData(",\"maturity\":99")]
        [InlineData(",\"safetyAcknowledged\":\"true\"")]
        [InlineData(",\"capabilityId\":\"fake\"")]
        public void RejectsUnsupportedProtectedOrMalformedFields(string extra)
        {
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.Parse(Input(extra)));
        }

        [Theory]
        [InlineData("")]
        [InlineData("Untitled solution")]
        public void RequiresAuthoredNames(string name)
        {
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.Parse(Input().Replace("Named draft", name)));
        }

        [Fact]
        public void EnforcesLengthsAndJsonShape()
        {
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.Parse(Input().Replace("Named draft", new string('x', 101))));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.Parse(Input(",\"summary\":\"" + new string('x', 4001) + "\"")));
            foreach (var field in new[] { "summary", "clientContext", "clientContextRedacted" })
                Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.Parse(Input(",\"" + field + "\":\"" + new string('x', 201) + "\"")));
            Assert.NotNull(DraftPolicy.Parse(Input(",\"whatItDoes\":\"" + new string('x', 4000) + "\"")));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.Parse("[]"));
        }

        [Fact]
        public void OptionalIntegerParametersUseDataverseZeroDefault()
        {
            Assert.Equal(1, DraftPolicy.NormalizePage(0));
            Assert.Equal(1, DraftPolicy.NormalizePage(1));
            Assert.Equal(2, DraftPolicy.NormalizePage(2));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.NormalizePage(-1));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.NormalizePage(10001));
        }

        [Fact]
        public void OnlyOwnerDraftWithCurrentVersionIsEditable()
        {
            var owner = Guid.NewGuid();
            var record = new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "100" };
            record["ownerid"] = new EntityReference("systemuser", owner);
            record["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus);
            DraftPolicy.AssertEditable(record, owner, "100");
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.AssertEditable(record, Guid.NewGuid(), "100"));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.AssertEditable(record, owner, "99"));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.AssertEditable(record, owner, ""));
            record["nx_publicationstatus"] = new OptionSetValue(125060000);
            Assert.Throws<InvalidPluginExecutionException>(() => DraftPolicy.AssertEditable(record, owner, "100"));
        }
    }
}