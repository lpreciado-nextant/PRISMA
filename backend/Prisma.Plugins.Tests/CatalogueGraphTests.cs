using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Xunit;

namespace Prisma.Plugins.Tests
{
    public class CatalogueGraphTests
    {
        private static Guid Id(int value) { return new Guid(value, 0, 0, new byte[8]); }

        [Fact]
        public void GroupsTagsAndCreditsByVisibleSolutionInArrivalOrder()
        {
            var graph = new CatalogueGraph(new[] { Id(1), Id(2) }, false);
            graph.Area(Id(1), Id(10), "ai", 10);
            graph.Technology(Id(1), "Dataverse");
            graph.Technology(Id(1), "Power Apps");
            graph.Industry(Id(2), "Retail");
            graph.Contributor(Id(1), "Ana Builder");
            graph.Contributor(Id(1), null);
            var result = graph.Build().Solutions;
            Assert.Equal(new[] { Id(1).ToString("D"), Id(2).ToString("D") }, result.Select(entry => entry.Id));
            Assert.Equal(new[] { "Dataverse", "Power Apps" }, result[0].Technologies);
            Assert.Equal(new[] { "Ana Builder", "Consultant" }, result[0].Contributors);
            Assert.Equal("ai", result[0].Areas.Single().Name);
            Assert.Empty(result[1].Technologies);
            Assert.Empty(result[1].Areas);
            Assert.Equal(new[] { "Retail" }, result[1].Industries);
        }

        [Fact]
        public void RowsForSolutionsOutsideTheReadAreIgnored()
        {
            var graph = new CatalogueGraph(new[] { Id(1) }, false);
            graph.Technology(Id(9), "Late publication");
            graph.Contributor(Id(9), "Someone");
            var entry = graph.Build().Solutions.Single();
            Assert.Empty(entry.Technologies);
            Assert.Empty(entry.Contributors);
        }

        [Fact]
        public void PresentModeNeverCarriesBuilderCredits()
        {
            var graph = new CatalogueGraph(new[] { Id(1) }, true);
            Assert.Throws<InvalidPluginExecutionException>(() => graph.Contributor(Id(1), "Ana Builder"));
            var json = DraftPolicy.Serialize(graph.Build());
            Assert.DoesNotContain("contributors", json);
            Assert.Contains("\"technologies\":[]", json);
        }

        [Fact]
        public void SerializesTheColumnNamesTheClientValidates()
        {
            var graph = new CatalogueGraph(new[] { Id(1) }, false);
            graph.Area(Id(1), Id(10), "data", null);
            graph.Area(Id(1), Id(11), "ai", 5);
            var json = DraftPolicy.Serialize(graph.Build());
            Assert.Contains("\"nx_specializationareaid\":\"" + Id(10).ToString("D") + "\"", json);
            Assert.Contains("\"nx_specializationareaname\":\"data\"", json);
            Assert.Contains("\"nx_sortordernumber\":5", json);
            Assert.Equal(1, json.Split(new[] { "nx_sortordernumber" }, StringSplitOptions.None).Length - 1);
            Assert.Contains("\"contributors\":[]", json);
        }

        [Fact]
        public void MissingNamesAndDuplicateSolutionsFailClosed()
        {
            var graph = new CatalogueGraph(new[] { Id(1) }, false);
            Assert.Throws<InvalidPluginExecutionException>(() => graph.Technology(Id(1), " "));
            Assert.Throws<InvalidPluginExecutionException>(() => graph.Industry(Id(1), null));
            Assert.Throws<InvalidPluginExecutionException>(() => graph.Area(Id(1), Id(10), "", 1));
            Assert.Throws<InvalidPluginExecutionException>(() => new CatalogueGraph(new[] { Id(1), Id(1) }, false));
        }

        private static MediaSnapshot Thumbnail(int id, int order = 1)
        {
            return new MediaSnapshot { Id = Id(id).ToString("D"), SessionId = Id(id + 100).ToString("D"), Kind = "thumbnail", Name = "card.png", Mime = "image/png", Size = 10, Received = 10, Complete = true, Caption = "", SortOrder = order };
        }

        [Fact]
        public void CarriesTheFirstThumbnailOfEachVisibleSolutionAndMarksTheResult()
        {
            var graph = new CatalogueGraph(new[] { Id(1), Id(2) }, true);
            graph.Thumbnail(Id(1), Thumbnail(21, 2));
            graph.Thumbnail(Id(1), Thumbnail(22, 1));
            graph.Thumbnail(Id(9), Thumbnail(23));
            var result = graph.Build();
            Assert.True(result.Thumbnails);
            Assert.Equal(Id(22).ToString("D"), result.Solutions[0].Thumbnail.Id);
            Assert.Null(result.Solutions[1].Thumbnail);
            var json = DraftPolicy.Serialize(result);
            Assert.Contains("\"thumbnails\":true", json);
            Assert.DoesNotContain(Id(23).ToString("D"), json);
            Assert.Equal(1, json.Split(new[] { "\"thumbnail\":" }, StringSplitOptions.None).Length - 1);
        }

        [Fact]
        public void OnlyFinalizedDataverseThumbnailsAreAccepted()
        {
            var graph = new CatalogueGraph(new[] { Id(1) }, false);
            var unfinished = Thumbnail(21); unfinished.Complete = false;
            var image = Thumbnail(22); image.Kind = "image";
            var blob = Thumbnail(23); blob.Storage = "blob";
            Assert.Throws<InvalidPluginExecutionException>(() => graph.Thumbnail(Id(1), unfinished));
            Assert.Throws<InvalidPluginExecutionException>(() => graph.Thumbnail(Id(1), image));
            Assert.Throws<InvalidPluginExecutionException>(() => graph.Thumbnail(Id(1), blob));
        }

        [Fact]
        public void SnapshotFromPreloadedImageMatchesTheSessionAndImageRows()
        {
            var session = new Entity("nx_uploadsession", Id(5)) {
                ["nx_targetid"] = Id(6).ToString("D"), ["nx_kind"] = "thumbnail", ["nx_filename"] = "card.png", ["nx_mime"] = "image/png",
                ["nx_bytes"] = 10, ["nx_received"] = 10, ["nx_nextblock"] = 1, ["nx_complete"] = true
            };
            var snapshot = MediaApi.Snapshot(session, new Entity("nx_solutionimage", Id(6)) { ["nx_sortorder"] = 40, ["nx_caption"] = "Cover" });
            Assert.Equal(Id(6).ToString("D"), snapshot.Id);
            Assert.Equal(Id(5).ToString(), snapshot.SessionId);
            Assert.Equal("Cover", snapshot.Caption);
            Assert.Equal(12, snapshot.SortOrder);
            Assert.Null(snapshot.Storage);
        }
    }
}
