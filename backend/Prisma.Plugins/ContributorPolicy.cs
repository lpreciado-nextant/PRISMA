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
        /// <summary>
        /// Retired with per-person effort: effort is now an estimate on the solution (`nx_estimatedminimumhours`,
        /// `nx_complexity`). Older clients still send it; it is accepted, never validated, stored or returned.
        /// </summary>
        [DataMember(Name = "directHours", EmitDefaultValue = false)] public decimal? DirectHours { get; set; }
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
                contributor.DirectHours = null;
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