using System;
using System.Collections.Generic;
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
        /// <summary>`nx_directhours`: the minimum hours this person needed to work on the solution, at every maturity.</summary>
        [DataMember(Name = "directHours")] public decimal? DirectHours { get; set; }
    }

    public static class ContributorPolicy
    {
        public static void Validate(IList<ContributorInput> contributors, bool complete)
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
                var hours = contributor.DirectHours;
                if (hours.HasValue && (hours < 0 || hours > 1000000000m || decimal.Round(hours.Value, 2) != hours))
                    throw Invalid("Hours must be nonnegative, within their range and have at most two decimal places.");
                if (complete && !hours.HasValue) throw Invalid("Enter the minimum hours required for every contributor.");
            }
        }

        public static Guid Identifier(string text)
        {
            Guid identifier;
            if (!Guid.TryParseExact(text, "D", out identifier) || identifier == Guid.Empty) throw Invalid("Invalid record identifier.");
            return identifier;
        }

        private static InvalidPluginExecutionException Invalid(string message) { return new InvalidPluginExecutionException(message); }
    }
}