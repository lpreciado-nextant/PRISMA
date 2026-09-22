using System;
using Microsoft.Xrm.Sdk;
using Xunit;

namespace Prisma.Plugins.Tests
{
    public class DraftPolicyTests
    {
        private const string Area = "22222222-2222-2222-2222-222222222222";
        private static string Input(string extra = "") { return "{\"name\":\"Named draft\",\"areaId\":\"" + Area + "\"" + extra + "}"; }

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
        public void RetirementRequiresLibrarianAndRestorationRequiresFreshSubmission()
        {
            var owner = Guid.NewGuid();
            var parent = new Entity("nx_solution", Guid.NewGuid()) { RowVersion = "100", ["ownerid"] = new EntityReference("systemuser", owner), ["nx_publicationstatus"] = new OptionSetValue(ReviewPolicy.Published) };
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, false, "100", "retire", "", false));
            Assert.Throws<InvalidPluginExecutionException>(() => ReviewPolicy.Change(parent, owner, true, "99", "retire", "", false));
            var retired = ReviewPolicy.Change(parent, owner, true, "100", "retire", "", false);
            Assert.Equal(ReviewPolicy.Retired, retired.GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value);
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
            var json = "{\"contributors\":[{\"personId\":\"" + Area + "\",\"directHours\":null}],\"technologyIds\":[],\"industryIds\":[],\"projectIds\":[]}";
            var graph = DraftGraph.Parse(json, 125060004);
            Assert.Single(graph.Contributors);
            Assert.Null(graph.Contributors[0].DirectHours);
            Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.Parse(json.Replace("\"directHours\":null", "\"ownerid\":\"fake\""), 125060004));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.Parse(json.Replace("\"projectIds\":[]", "\"projectIds\":[],\"approval\":true"), 125060004));
            Assert.Throws<InvalidPluginExecutionException>(() => DraftGraph.Parse(json.Replace("\"technologyIds\":[]", "\"technologyIds\":[\"fake\"]"), 125060004));
        }

        [Fact]
        public void ContributorsPermitIncompleteDraftsButValidateSuppliedInputs()
        {
            var person = new ContributorInput { PersonId = Area };
            ContributorPolicy.Validate(new[] { person }, 125060004, false);
            Assert.Null(ContributorPolicy.Hours(person, 125060004));
            Assert.Throws<InvalidPluginExecutionException>(() => ContributorPolicy.Validate(new[] { person }, 125060004, true));
            Assert.Throws<InvalidPluginExecutionException>(() => ContributorPolicy.Validate(new[] { person, person }, 125060004, false));
            person.DirectHours = 0;
            ContributorPolicy.Validate(new[] { person }, 125060004, true);
            person.Allocation = 100.001m;
            Assert.Throws<InvalidPluginExecutionException>(() => ContributorPolicy.Validate(new[] { person }, 125060004, false));
        }

        [Theory]
        [InlineData("2026-07-02", "2026-07-06", 16)]
        [InlineData("2021-12-31", "2022-01-03", 8)]
        [InlineData("2020-06-19", "2020-06-19", 8)]
        [InlineData("2021-06-18", "2021-06-18", 0)]
        [InlineData("2024-02-29", "2024-02-29", 8)]
        public void CalendarEffortExcludesObservedFederalHolidays(string start, string end, int expected)
        {
            var person = new ContributorInput { PersonId = Area, StartDate = start, EndDate = end, Allocation = 100 };
            ContributorPolicy.Validate(new[] { person }, 125060002, true);
            Assert.Equal((decimal)expected, ContributorPolicy.Hours(person, 125060002));
        }

        [Theory]
        [InlineData("2019-12-31")]
        [InlineData("2036-01-01")]
        [InlineData("2026-02-30")]
        public void EffortDatesRespectCoverageAndCalendar(string date)
        {
            Assert.Throws<InvalidPluginExecutionException>(() => ContributorPolicy.Date(date));
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
            foreach (var field in new[] { "summary", "useCase", "clientContext", "clientContextRedacted" })
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