using Microsoft.Xrm.Sdk;
using Prisma.Plugins;
using Xunit;

namespace Prisma.Plugins.Tests
{
    public class SuggestionPolicyTests
    {
        [Fact]
        public void Text_is_trimmed_required_limited_and_free_of_control_characters()
        {
            Assert.Equal("Add an export to Excel.", SuggestionPolicy.CleanText("  Add an export to Excel.\n"));
            Assert.Equal("Line one\nLine two", SuggestionPolicy.CleanText("Line one\nLine two"));
            Assert.Throws<InvalidPluginExecutionException>(() => SuggestionPolicy.CleanText("   "));
            Assert.Throws<InvalidPluginExecutionException>(() => SuggestionPolicy.CleanText(null));
            Assert.Equal(1000, SuggestionPolicy.CleanText(new string('x', 1000)).Length);
            Assert.Throws<InvalidPluginExecutionException>(() => SuggestionPolicy.CleanText(new string('x', 1001)));
            Assert.Throws<InvalidPluginExecutionException>(() => SuggestionPolicy.CleanText("Bell\u0007"));
        }

        [Fact]
        public void Row_name_fits_the_primary_column()
        {
            Assert.Equal("Suggestion · Invoice matching", SuggestionPolicy.Name(" Invoice matching "));
            Assert.Equal(100, SuggestionPolicy.Name(new string('n', 200)).Length);
        }

        [Fact]
        public void Only_owner_contributors_and_the_librarian_read_suggestions()
        {
            Assert.True(SuggestionPolicy.CanRead(owner: true, contributor: false, librarian: false));
            Assert.True(SuggestionPolicy.CanRead(owner: false, contributor: true, librarian: false));
            Assert.True(SuggestionPolicy.CanRead(owner: false, contributor: false, librarian: true));
            Assert.False(SuggestionPolicy.CanRead(owner: false, contributor: false, librarian: false));
        }
    }
}
