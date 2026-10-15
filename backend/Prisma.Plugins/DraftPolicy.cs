using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization.Json;
using System.Text;
using Microsoft.Xrm.Sdk;

namespace Prisma.Plugins
{
    public enum EditMode { Owner, Librarian }

    public static class DraftPolicy
    {
        public const int DraftStatus = 125060003;
        public const string SaveMessage = "nx_SaveCoreDraft";
        public const string ListMessage = "nx_GetMyCoreDrafts";
        /// <summary>Librarian edit trail on `nx_solution` (ADR-0013). Protected; written only by the PRISMA APIs.</summary>
        public const string LibrarianEditedBy = "nx_librarianeditedby";
        public const string LibrarianEditedOn = "nx_librarianeditedon";
        public const string LibrarianEditPending = "nx_librarianeditpending";
        public static readonly string[] CoreColumns = {
            "nx_solutionname", "nx_onelinesummary", "nx_whatitdoes", "nx_businessvalue",
            "nx_capability", "nx_status", "nx_clientcontext", "nx_clientcontextredacted", "nx_safetyacknowledged",
            "nx_clientrole", "nx_challenges", "nx_lessonslearned", "nx_estimatedminimumhours", "nx_complexity"
        };
        /// <summary>Live `nx_solution.nx_complexity` choice values: Easy, Medium, Hard. Required at submit/publication.</summary>
        public static readonly int[] ComplexityValues = { 125060000, 125060001, 125060002 };
        /// <summary>Upper bound for `nx_estimatedminimumhours`, a whole-number estimate for the whole solution.</summary>
        public const int MaxEstimatedHours = 100000;
        /// <summary>Live `nx_solution.nx_clientrole` choice values (SchemaV2, 2026-09-23). Optional, no default.</summary>
        public static readonly int[] ClientRoleValues = {
            125060000, 125060001, 125060002, 125060008, 125060009, 125060003, 125060004, 125060005,
            125060006, 125060007, 125060010, 125060011, 125060012, 125060013
        };
        private static readonly Dictionary<string, string> TextColumns = new Dictionary<string, string> {
            { "name", "nx_solutionname" }, { "summary", "nx_onelinesummary" }, { "whatItDoes", "nx_whatitdoes" },
            { "businessValue", "nx_businessvalue" },
            { "clientContext", "nx_clientcontext" }, { "clientContextRedacted", "nx_clientcontextredacted" },
            // Internal only (never in present mode); both columns are 2000 characters in Dataverse.
            { "challenges", "nx_challenges" }, { "lessonsLearned", "nx_lessonslearned" }
        };

        public static Entity Parse(string json)
        {
            if (string.IsNullOrWhiteSpace(json) || json.Length > 60000) throw Invalid("Draft content is missing or too large.");
            Dictionary<string, object> values;
            try
            {
                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                    values = (Dictionary<string, object>)Serializer(typeof(Dictionary<string, object>)).ReadObject(stream);
            }
            catch (Exception error) when (error is System.Runtime.Serialization.SerializationException || error is ArgumentException)
            {
                throw Invalid("Draft content must be a JSON object.");
            }
            if (values == null) throw Invalid("Draft content must be a JSON object.");
            var allowed = new HashSet<string>(TextColumns.Keys) { "capabilityId", "maturity", "safetyAcknowledged", "clientRoleValue", "estimatedMinimumHours", "complexityValue" };
            if (values.Keys.Any(key => !allowed.Contains(key))) throw Invalid("Draft contains unsupported or protected fields.");
            var entity = new Entity("nx_solution");
            foreach (var pair in TextColumns)
            {
                object raw;
                values.TryGetValue(pair.Key, out raw);
                if (raw != null && !(raw is string)) throw Invalid(pair.Key + " must be text.");
                var text = ((string)raw ?? "").Trim();
                var limit = pair.Key == "name" ? 100 : pair.Key == "whatItDoes" || pair.Key == "businessValue" ? 4000
                    : pair.Key == "challenges" || pair.Key == "lessonsLearned" ? 2000 : 200;
                if (text.Length > limit) throw Invalid(pair.Key + " exceeds " + limit + " characters.");
                if (pair.Key == "name" && (text.Length == 0 || text.Equals("Untitled solution", StringComparison.OrdinalIgnoreCase)))
                    throw Invalid("Enter an authored solution name.");
                entity[pair.Value] = text.Length == 0 ? null : text;
            }
            entity["nx_capability"] = Lookup(values, "capabilityId", "nx_capability", false);
            object maturity;
            if (!values.TryGetValue("maturity", out maturity)) maturity = 125060004;
            if (!(maturity is int) || !new[] { 125060000, 125060001, 125060002, 125060004 }.Contains((int)maturity))
                throw Invalid("Select a supported maturity.");
            entity["nx_status"] = new OptionSetValue((int)maturity);
            object acknowledgment;
            if (!values.TryGetValue("safetyAcknowledged", out acknowledgment)) acknowledgment = false;
            if (!(acknowledgment is bool)) throw Invalid("Safety acknowledgment must be true or false.");
            entity["nx_safetyacknowledged"] = acknowledgment;
            object clientRole;
            if (values.TryGetValue("clientRoleValue", out clientRole) && clientRole != null)
            {
                if (!(clientRole is int) || !ClientRoleValues.Contains((int)clientRole)) throw Invalid("Select a supported client role.");
                entity["nx_clientrole"] = new OptionSetValue((int)clientRole);
            }
            else entity["nx_clientrole"] = null;
            // Solution-level effort: an optional whole-hour estimate and a complexity, both internal only.
            object estimate;
            if (values.TryGetValue("estimatedMinimumHours", out estimate) && estimate != null)
            {
                if (!(estimate is int) || (int)estimate < 0 || (int)estimate > MaxEstimatedHours) throw Invalid("Estimated minimum hours must be a whole number from 0 to " + MaxEstimatedHours + ".");
                entity["nx_estimatedminimumhours"] = (int)estimate;
            }
            else entity["nx_estimatedminimumhours"] = null;
            object complexity;
            if (values.TryGetValue("complexityValue", out complexity) && complexity != null)
            {
                if (!(complexity is int) || !ComplexityValues.Contains((int)complexity)) throw Invalid("Select a supported complexity.");
                entity["nx_complexity"] = new OptionSetValue((int)complexity);
            }
            else entity["nx_complexity"] = null;
            return entity;
        }

        public static void AssertEditable(Entity current, Guid caller, string expectedVersion)
        {
            Editable(current, caller, expectedVersion, () => false);
        }

        /// <summary>
        /// The owner edits their own Draft; a PRISMA Librarian edits someone else's Pending review or Published record in
        /// place (ADR-0013). The librarian check is deferred so owner saves never query roles.
        /// </summary>
        public static EditMode Editable(Entity current, Guid caller, string expectedVersion, Func<bool> librarian)
        {
            var owner = current.GetAttributeValue<EntityReference>("ownerid");
            var owns = owner != null && owner.LogicalName == "systemuser" && owner.Id == caller;
            var status = current.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value;
            EditMode mode;
            if (owns && status == DraftStatus) mode = EditMode.Owner;
            else if (LibrarianMayEdit(current, caller) && librarian()) mode = EditMode.Librarian;
            else if (!owns) throw Invalid("You can only edit your own drafts.");
            else throw Invalid("Only Draft records can be edited in this workflow.");
            if (string.IsNullOrWhiteSpace(expectedVersion) || expectedVersion.Any(character => character < '0' || character > '9'))
                throw Invalid("A valid expected row version is required.");
            if (current.RowVersion != expectedVersion) throw Invalid("This draft changed. Reopen it before saving again.");
            return mode;
        }

        /// <summary>
        /// Whether a librarian may edit this record as librarian: someone else's, Pending review or Published. A librarian's
        /// own record is edited as its owner (withdraw first), so they never explain changes to themselves.
        /// </summary>
        public static bool LibrarianMayEdit(Entity record, Guid caller)
        {
            var owner = record.GetAttributeValue<EntityReference>("ownerid");
            var status = record.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value;
            return !(owner != null && owner.LogicalName == "systemuser" && owner.Id == caller) && (status == ReviewPolicy.Pending || status == ReviewPolicy.Published);
        }

        /// <summary>
        /// Marks a real librarian change: who and when, and that the owner has not been told yet. A Published record keeps
        /// its status but leaves present mode until the librarian confirms the edit (`confirm-edit`). `editor` is the
        /// librarian's consultant row; null when none matches, so an earlier editor's name is never left in place.
        /// </summary>
        public static Entity LibrarianEdit(Guid solution, int? status, EntityReference editor, DateTime now)
        {
            var edit = new Entity("nx_solution", solution) {
                [LibrarianEditedBy] = editor, [LibrarianEditedOn] = now, [LibrarianEditPending] = true
            };
            if (status == ReviewPolicy.Published) edit["nx_clientsafereviewed"] = false;
            return edit;
        }

        /// <summary>
        /// The librarian as a `cr6b0_consultant` (PRISMA names people by consultant, not systemuser), by the same exact
        /// email rule as favorites. A librarian missing from the directory still edits; the edit just carries no name.
        /// </summary>
        public static EntityReference Editor(IOrganizationService server, Guid caller)
        {
            try { return new EntityReference("cr6b0_consultant", FavoriteApi.ResolveConsultant(server, caller)); }
            catch (InvalidPluginExecutionException) { return null; }
        }

        /// <summary>True when any supplied core value differs from the stored one; blank text equals no text.</summary>
        public static bool Changed(Entity current, Entity input)
        {
            return input.Attributes.Any(pair => !Same(current.Contains(pair.Key) ? current[pair.Key] : null, pair.Value));
        }

        private static bool Same(object stored, object supplied)
        {
            if (stored is string || supplied is string) return ((stored as string) ?? "") == ((supplied as string) ?? "");
            if (stored is EntityReference || supplied is EntityReference) return (stored as EntityReference)?.Id == (supplied as EntityReference)?.Id;
            if (stored is OptionSetValue || supplied is OptionSetValue) return (stored as OptionSetValue)?.Value == (supplied as OptionSetValue)?.Value;
            return Equals(stored ?? false, supplied ?? false);
        }

        public static bool IsSaveContext(IPluginExecutionContext context)
        {
            return IsOperationContext(context, SaveMessage) || IsOperationContext(context, DraftGraph.SaveMessage)
                || MediaPolicy.Writes.Any(message => IsOperationContext(context, message)) || IsOperationContext(context, "nx_BeginResumableUpload") || IsOperationContext(context, ReviewPolicy.Transition);
        }

        public static bool IsDeleteContext(IPluginExecutionContext context)
        {
            return IsTransitionContext(context, "delete");
        }

        public static bool IsTransitionContext(IPluginExecutionContext context, string action)
        {
            for (var parent = context.ParentContext; parent != null; parent = parent.ParentContext)
                if (parent.MessageName == ReviewPolicy.Transition && parent.InitiatingUserId == context.InitiatingUserId && parent.IsInTransaction
                    && parent.InputParameters.Contains("Action") && parent.InputParameters["Action"] as string == action) return true;
            return false;
        }

        public static bool IsOperationContext(IPluginExecutionContext context, string message)
        {
            for (var parent = context.ParentContext; parent != null; parent = parent.ParentContext)
                if (parent.MessageName == message && parent.InitiatingUserId == context.InitiatingUserId && parent.IsInTransaction)
                    return true;
            return false;
        }

        public static int NormalizePage(int page)
        {
            if (page == 0) return 1;
            if (page < 1 || page > 10000) throw Invalid("Invalid draft page.");
            return page;
        }

        public static string Serialize<T>(T value)
        {
            using (var stream = new MemoryStream())
            {
                Serializer(typeof(T)).WriteObject(stream, value);
                return Encoding.UTF8.GetString(stream.ToArray());
            }
        }

        private static DataContractJsonSerializer Serializer(Type type)
        {
            return new DataContractJsonSerializer(type, new DataContractJsonSerializerSettings { UseSimpleDictionaryFormat = true });
        }

        private static EntityReference Lookup(Dictionary<string, object> values, string key, string table, bool required)
        {
            object raw;
            values.TryGetValue(key, out raw);
            if (!required && (raw == null || raw as string == "")) return null;
            Guid identifier;
            if (!(raw is string) || !Guid.TryParse((string)raw, out identifier) || identifier == Guid.Empty)
                throw Invalid("Select a valid " + key + ".");
            return new EntityReference(table, identifier);
        }

        private static InvalidPluginExecutionException Invalid(string message) { return new InvalidPluginExecutionException(message); }
    }
}