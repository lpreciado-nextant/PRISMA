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

        [Fact]
        public void Only_the_owner_and_contributors_mark_suggestions_addressed()
        {
            Assert.True(SuggestionPolicy.CanAddress(owner: true, contributor: false));
            Assert.True(SuggestionPolicy.CanAddress(owner: false, contributor: true));
            // The librarian reads suggestions but does not address them for the team.
            Assert.False(SuggestionPolicy.CanAddress(owner: false, contributor: false));
        }

        [Fact]
        public void Addressed_timestamps_are_utc_iso_or_null_while_open()
        {
            Assert.Null(SuggestionPolicy.Timestamp(null));
            Assert.Equal("2026-10-14T22:30:00.0000000Z", SuggestionPolicy.Timestamp(new System.DateTime(2026, 10, 14, 22, 30, 0, System.DateTimeKind.Utc)));
        }

        [Fact]
        public void Open_feedback_and_entries_serialize_with_the_client_field_names()
        {
            var json = DraftPolicy.Serialize(new OpenFeedback { Suggestions = new System.Collections.Generic.List<OpenSuggestion> { new OpenSuggestion { Id = "a", SolutionId = "s" } }, ChangesRequested = new System.Collections.Generic.List<string> { "r" } });
            Assert.Contains("\"suggestions\":[{\"id\":\"a\",\"solutionId\":\"s\"}]", json);
            Assert.Contains("\"changesRequested\":[\"r\"]", json);
            Assert.Contains("\"addressedOn\":null", DraftPolicy.Serialize(new SuggestionEntry { Id = "a", Text = "t", Author = "x", CreatedOn = "c" }));
        }
    }
}
