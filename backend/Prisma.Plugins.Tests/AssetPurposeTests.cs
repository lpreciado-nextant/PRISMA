using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Xunit;

namespace Prisma.Plugins.Tests
{
    public class AssetPurposeTests
    {
        private const int Html = 125060000, Video = 125060001, Slide = 125060002, PowerBi = 125060003, Hosted = 125060007;
        private static Guid Id(int value) { return new Guid(value, 0, 0, new byte[8]); }

        [Fact]
        public void DefaultsFollowTheFormatAndPurposesMustFitIt()
        {
            Assert.Equal(AssetPurposePolicy.DemoVideo, AssetPurposePolicy.Default(Video));
            foreach (var type in new[] { Html, PowerBi, Hosted }) Assert.Equal(AssetPurposePolicy.InteractiveDemo, AssetPurposePolicy.Default(type));
            Assert.Equal(AssetPurposePolicy.SupportingMaterial, AssetPurposePolicy.Default(Slide));
            Assert.Equal(AssetPurposePolicy.SupportingMaterial, AssetPurposePolicy.Validated("Supporting material", Video));
            Assert.Equal(AssetPurposePolicy.InteractiveDemo, AssetPurposePolicy.Validated("Interactive demo", Hosted));
            Assert.Throws<InvalidPluginExecutionException>(() => AssetPurposePolicy.Validated("Demo video", Html));
            Assert.Throws<InvalidPluginExecutionException>(() => AssetPurposePolicy.Validated("Interactive demo", Video));
            Assert.Throws<InvalidPluginExecutionException>(() => AssetPurposePolicy.Validated("Interactive demo", Slide));
            Assert.Throws<InvalidPluginExecutionException>(() => AssetPurposePolicy.Validated("Demo", Video));
        }

        [Fact]
        public void StoredPurposeWinsAndUnsetRowsReadTheirFormatDefault()
        {
            var unset = new Entity("nx_demoasset") { ["nx_assettype"] = new OptionSetValue(Video) };
            Assert.Equal(AssetPurposePolicy.DemoVideo, AssetPurposePolicy.Effective(unset));
            unset["nx_assetpurpose"] = new OptionSetValue(AssetPurposePolicy.SupportingMaterial);
            Assert.Equal(AssetPurposePolicy.SupportingMaterial, AssetPurposePolicy.Effective(unset));
        }

        [Fact]
        public void LinksAndMediaMetadataAcceptAnOptionalPurpose()
        {
            var json = "{\"name\":\"Demo\",\"assetType\":\"Hosted web app (URL)\",\"externalUrl\":\"https://example.com/demo\",\"allowsEmbedding\":true,\"embedHint\":\"\"}";
            Assert.Null(LinkedAssetPolicy.Parse(json).Purpose);
            Assert.Equal("Supporting material", LinkedAssetPolicy.Parse(json.Replace("\"embedHint\":\"\"", "\"embedHint\":\"\",\"purpose\":\"Supporting material\"")).Purpose);
            Assert.Throws<InvalidPluginExecutionException>(() => LinkedAssetPolicy.Parse(json.Replace("\"embedHint\":\"\"", "\"embedHint\":\"\",\"purpose\":\"Demo video\"")));
            var metadata = "[{\"id\":\"" + Id(1) + "\",\"caption\":\"\",\"sortOrder\":1}]";
            Assert.Null(MediaPolicy.ParseMetadata(metadata).Single().Purpose);
            Assert.Equal("Demo video", MediaPolicy.ParseMetadata(metadata.Replace("\"sortOrder\":1", "\"sortOrder\":1,\"purpose\":\"Demo video\"")).Single().Purpose);
            Assert.Throws<InvalidPluginExecutionException>(() => MediaPolicy.ParseMetadata(metadata.Replace("\"sortOrder\":1", "\"sortOrder\":1,\"purpose\":\"Training\"")));
        }

        [Fact]
        public void SnapshotsCarryTheAttachmentPurposeOnly()
        {
            var session = new Entity("nx_uploadsession", Id(5)) {
                ["nx_targetid"] = Id(6).ToString("D"), ["nx_kind"] = "attachment", ["nx_filename"] = "demo.mp4", ["nx_mime"] = "video/mp4",
                ["nx_bytes"] = 10, ["nx_received"] = 10, ["nx_nextblock"] = 1, ["nx_complete"] = true
            };
            Assert.Equal("Demo video", MediaApi.Snapshot(session, new Entity("nx_demoasset", Id(6)) { ["nx_sortorder"] = 1, ["nx_assettype"] = new OptionSetValue(Video) }).Purpose);
            session["nx_kind"] = "image";
            Assert.Null(MediaApi.Snapshot(session, new Entity("nx_solutionimage", Id(6)) { ["nx_sortorder"] = 1 }).Purpose);
        }

        [Fact]
        public void CatalogueCountsDemoVideosAndInteractiveDemosPerVisibleSolution()
        {
            var graph = new CatalogueGraph(new[] { Id(1), Id(2) }, true);
            graph.Asset(Id(1), AssetPurposePolicy.DemoVideo);
            graph.Asset(Id(1), AssetPurposePolicy.DemoVideo);
            graph.Asset(Id(1), AssetPurposePolicy.SupportingMaterial);
            graph.Asset(Id(2), AssetPurposePolicy.InteractiveDemo);
            graph.Asset(Id(9), AssetPurposePolicy.DemoVideo);
            var result = graph.Build();
            Assert.True(result.Purposes);
            Assert.Equal(new[] { 2, 0 }, result.Solutions.Select(entry => entry.DemoVideos));
            Assert.Equal(new[] { 0, 1 }, result.Solutions.Select(entry => entry.InteractiveDemos));
        }
    }
}
