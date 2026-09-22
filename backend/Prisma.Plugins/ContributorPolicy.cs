using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Xrm.Sdk;

namespace Prisma.Plugins
{
    [DataContract]
    public sealed class ContributorInput
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "personId", IsRequired = true)] public string PersonId { get; set; }
        [DataMember(Name = "directHours")] public decimal? DirectHours { get; set; }
        [DataMember(Name = "startDate")] public string StartDate { get; set; }
        [DataMember(Name = "endDate")] public string EndDate { get; set; }
        [DataMember(Name = "allocation")] public decimal? Allocation { get; set; }
    }

    public static class ContributorPolicy
    {
        public static bool Direct(int maturity) { return maturity == 125060001 || maturity == 125060004; }

        public static void Validate(IList<ContributorInput> contributors, int maturity, bool complete)
        {
            if (contributors == null || contributors.Count > 100 || (complete && contributors.Count == 0))
                throw Invalid("Select between one and 100 contributors for submission.");
            var people = new HashSet<Guid>();
            var rows = new HashSet<Guid>();
            foreach (var contributor in contributors)
            {
                if (contributor == null) throw Invalid("Invalid contributor.");
                if (!people.Add(Identifier(contributor.PersonId))) throw Invalid("Select each contributor only once.");
                if (!string.IsNullOrEmpty(contributor.Id) && !rows.Add(Identifier(contributor.Id))) throw Invalid("Duplicate contributor row.");
                Number(contributor.DirectHours, 1000000000m, "Direct hours");
                Number(contributor.Allocation, 100m, "Allocation");
                var start = Date(contributor.StartDate);
                var end = Date(contributor.EndDate);
                if (start.HasValue && end.HasValue && end < start) throw Invalid("End date must not precede start date.");
                if (complete && (Direct(maturity) ? !contributor.DirectHours.HasValue : !start.HasValue || !end.HasValue || !contributor.Allocation.HasValue))
                    throw Invalid("Complete the active effort inputs for every contributor.");
            }
        }

        public static decimal? Hours(ContributorInput contributor, int maturity)
        {
            if (Direct(maturity)) return contributor.DirectHours;
            var start = Date(contributor.StartDate);
            var end = Date(contributor.EndDate);
            if (!start.HasValue || !end.HasValue || !contributor.Allocation.HasValue) return null;
            var holidays = new HashSet<DateTime>();
            for (var year = start.Value.Year - 1; year <= end.Value.Year + 1; year++)
                holidays.UnionWith(Holidays(year));
            var days = 0;
            for (var date = start.Value; date <= end.Value; date = date.AddDays(1))
                if (date.DayOfWeek != DayOfWeek.Saturday && date.DayOfWeek != DayOfWeek.Sunday && !holidays.Contains(date)) days++;
            return Math.Round(days * 8m * contributor.Allocation.Value / 100m, 2, MidpointRounding.AwayFromZero);
        }

        public static Guid Identifier(string text)
        {
            Guid identifier;
            if (!Guid.TryParseExact(text, "D", out identifier) || identifier == Guid.Empty) throw Invalid("Invalid record identifier.");
            return identifier;
        }

        public static DateTime? Date(string text)
        {
            if (string.IsNullOrEmpty(text)) return null;
            DateTime date;
            if (!DateTime.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date) || date.Year < 2020 || date.Year > 2035)
                throw Invalid("Effort dates must be valid dates within 2020-2035.");
            return date;
        }

        private static void Number(decimal? value, decimal maximum, string name)
        {
            if (value.HasValue && (value < 0 || value > maximum || decimal.Round(value.Value, 2) != value))
                throw Invalid(name + " must be nonnegative, within its range and have at most two decimal places.");
        }

        private static IEnumerable<DateTime> Holidays(int year)
        {
            yield return Observed(new DateTime(year, 1, 1));
            yield return Nth(year, 1, DayOfWeek.Monday, 3);
            yield return Nth(year, 2, DayOfWeek.Monday, 3);
            var memorial = new DateTime(year, 5, 31);
            while (memorial.DayOfWeek != DayOfWeek.Monday) memorial = memorial.AddDays(-1);
            yield return memorial;
            if (year >= 2021) yield return Observed(new DateTime(year, 6, 19));
            yield return Observed(new DateTime(year, 7, 4));
            yield return Nth(year, 9, DayOfWeek.Monday, 1);
            yield return Nth(year, 10, DayOfWeek.Monday, 2);
            yield return Observed(new DateTime(year, 11, 11));
            yield return Nth(year, 11, DayOfWeek.Thursday, 4);
            yield return Observed(new DateTime(year, 12, 25));
        }

        private static DateTime Observed(DateTime date)
        {
            return date.DayOfWeek == DayOfWeek.Saturday ? date.AddDays(-1) : date.DayOfWeek == DayOfWeek.Sunday ? date.AddDays(1) : date;
        }

        private static DateTime Nth(int year, int month, DayOfWeek weekday, int ordinal)
        {
            var date = new DateTime(year, month, 1);
            return date.AddDays(((int)weekday - (int)date.DayOfWeek + 7) % 7 + (ordinal - 1) * 7);
        }

        private static InvalidPluginExecutionException Invalid(string message) { return new InvalidPluginExecutionException(message); }
    }
}