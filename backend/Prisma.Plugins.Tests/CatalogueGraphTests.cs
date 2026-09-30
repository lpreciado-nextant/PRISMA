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
    }
}
