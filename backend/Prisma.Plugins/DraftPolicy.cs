using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization.Json;
using System.Text;
using Microsoft.Xrm.Sdk;

namespace Prisma.Plugins
{
    public static class DraftPolicy
    {
        public const int DraftStatus = 125060003;
        public const string SaveMessage = "nx_SaveCoreDraft";
        public const string ListMessage = "nx_GetMyCoreDrafts";
        public static readonly string[] CoreColumns = {
            "nx_solutionname", "nx_onelinesummary", "nx_whatitdoes", "nx_businessvalue",
            "nx_specializationarea", "nx_capability", "nx_status", "nx_clientcontext", "nx_clientcontextredacted", "nx_safetyacknowledged"
        };
        private static readonly Dictionary<string, string> TextColumns = new Dictionary<string, string> {
            { "name", "nx_solutionname" }, { "summary", "nx_onelinesummary" }, { "whatItDoes", "nx_whatitdoes" },
            { "businessValue", "nx_businessvalue" },
            { "clientContext", "nx_clientcontext" }, { "clientContextRedacted", "nx_clientcontextredacted" }
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
            var allowed = new HashSet<string>(TextColumns.Keys) { "areaId", "capabilityId", "maturity", "safetyAcknowledged" };
            if (values.Keys.Any(key => !allowed.Contains(key))) throw Invalid("Draft contains unsupported or protected fields.");
            var entity = new Entity("nx_solution");
            foreach (var pair in TextColumns)
            {
                object raw;
                values.TryGetValue(pair.Key, out raw);
                if (raw != null && !(raw is string)) throw Invalid(pair.Key + " must be text.");
                var text = ((string)raw ?? "").Trim();
                var limit = pair.Key == "name" ? 100 : pair.Key == "whatItDoes" || pair.Key == "businessValue" ? 4000 : 200;
                if (text.Length > limit) throw Invalid(pair.Key + " exceeds " + limit + " characters.");
                if (pair.Key == "name" && (text.Length == 0 || text.Equals("Untitled solution", StringComparison.OrdinalIgnoreCase)))
                    throw Invalid("Enter an authored solution name.");
                entity[pair.Value] = text.Length == 0 ? null : text;
            }
            entity["nx_specializationarea"] = Lookup(values, "areaId", "nx_specializationarea", true);
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
            return entity;
        }

        public static void AssertEditable(Entity current, Guid caller, string expectedVersion)
        {
            var owner = current.GetAttributeValue<EntityReference>("ownerid");
            if (owner == null || owner.LogicalName != "systemuser" || owner.Id != caller) throw Invalid("You can only edit your own drafts.");
            if (current.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value != DraftStatus)
                throw Invalid("Only Draft records can be edited in this workflow.");
            if (string.IsNullOrWhiteSpace(expectedVersion) || expectedVersion.Any(character => character < '0' || character > '9'))
                throw Invalid("A valid expected row version is required.");
            if (current.RowVersion != expectedVersion) throw Invalid("This draft changed. Reopen it before saving again.");
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