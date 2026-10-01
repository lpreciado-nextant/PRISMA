using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;

namespace Prisma.Plugins.Tests
{
    public class FavoriteRankingTests
    {
        private static readonly DateTime Day = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        private static Guid Id(int value) { return new Guid(value, 0, 0, new byte[8]); }
        private static KeyValuePair<Guid, DateTime> Save(int solution, int day) { return new KeyValuePair<Guid, DateTime>(Id(solution), Day.AddDays(day)); }

        [Fact]
        public void RanksByNumberOfPeopleWhoSaved()
        {
            var ranked = FavoriteRanking.Top(new[] { Save(1, 0), Save(2, 0), Save(2, 1), Save(3, 0), Save(3, 1), Save(3, 2) });
            Assert.Equal(new[] { Id(3), Id(2), Id(1) }, ranked);
        }

        [Fact]
        public void RankedCarriesHowManyPeopleSavedEachSolution()
        {
            var ranked = FavoriteRanking.Ranked(new[] { Save(1, 0), Save(2, 0), Save(2, 1), Save(3, 0), Save(3, 1), Save(3, 2) });
            Assert.Equal(new[] { Id(3), Id(2), Id(1) }, ranked.Select(entry => entry.Key));
            Assert.Equal(new[] { 3, 2, 1 }, ranked.Select(entry => entry.Value));
        }

        [Fact]
        public void TiesGoToTheMostRecentlySavedThenToTheId()
        {
            Assert.Equal(new[] { Id(1), Id(2) }, FavoriteRanking.Top(new[] { Save(2, 1), Save(1, 5) }));
            Assert.Equal(new[] { Id(1), Id(2) }, FavoriteRanking.Top(new[] { Save(2, 3), Save(1, 3) }));
        }

        [Fact]
        public void ReturnsAtMostTheTopTenAndNothingForNoSaves()
        {
            var saves = Enumerable.Range(1, 15).SelectMany(solution => Enumerable.Range(0, solution).Select(day => Save(solution, day)));
            var ranked = FavoriteRanking.Top(saves);
            Assert.Equal(FavoriteRanking.TopCount, ranked.Length);
            Assert.Equal(Id(15), ranked[0]);
            Assert.Equal(Id(6), ranked[9]);
            Assert.Empty(FavoriteRanking.Top(Array.Empty<KeyValuePair<Guid, DateTime>>()));
        }
    }
}
