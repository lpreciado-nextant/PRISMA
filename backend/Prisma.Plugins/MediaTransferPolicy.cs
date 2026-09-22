using System;
using System.Text.RegularExpressions;
using Microsoft.Xrm.Sdk;

namespace Prisma.Plugins
{
    public static class MediaTransferPolicy
    {
        public const int ReadBlockSize = 1024 * 1024;
        public static string Digest(string value)
        {
            if (value == null || !Regex.IsMatch(value, "\\A[0-9a-f]{64}\\z")) throw MediaPolicy.Invalid("A lowercase SHA-256 digest is required.");
            return value;
        }

        public static void Resume(Entity session, Guid parent, Guid caller, string digest, string name, int size, DateTime now)
        {
            if (session.GetAttributeValue<string>("nx_parentid") != parent.ToString("D") || session.GetAttributeValue<string>("nx_callerid") != caller.ToString("D")
                || session.GetAttributeValue<bool>("nx_complete") || session.GetAttributeValue<DateTime>("nx_expires") <= now)
                throw MediaPolicy.Invalid("Upload is unavailable, complete or expired.");
            if (session.GetAttributeValue<string>("nx_sha256") != Digest(digest) || session.GetAttributeValue<string>("nx_filename") != name || session.GetAttributeValue<int>("nx_bytes") != size)
                throw MediaPolicy.Invalid("Select the exact file originally uploaded.");
            var received = session.GetAttributeValue<int>("nx_received");
            var next = session.GetAttributeValue<int>("nx_nextblock");
            var blockSize = MediaPolicy.SessionBlockSize(session);
            if (size <= 0 || received < 0 || received > size || next < 0 || received != Math.Min((long)next * blockSize, size)
                || next != (received + (long)blockSize - 1) / blockSize) throw MediaPolicy.Invalid("Invalid upload checkpoint.");
        }

        public static void ReadAccess(Entity parent, Guid caller, bool librarian, string mode)
        {
            if (parent.GetAttributeValue<OptionSetValue>("statecode")?.Value != 0) throw MediaPolicy.Invalid("Video is unavailable.");
            var published = parent.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value == ReviewPolicy.Published;
            var owner = parent.GetAttributeValue<EntityReference>("ownerid");
            if (mode == "present")
            {
                if (!published || !parent.GetAttributeValue<bool>("nx_clientsafereviewed") || !parent.GetAttributeValue<bool>("nx_safetyacknowledged")) throw MediaPolicy.Invalid("Video is unavailable in present mode.");
            }
            else if (mode == "published")
            {
                if (!published) throw MediaPolicy.Invalid("Published video is unavailable.");
            }
            else if (mode != "submission" || (!librarian && (owner?.LogicalName != "systemuser" || owner.Id != caller))) throw MediaPolicy.Invalid("Submission video access denied.");
        }

        public static int ReadLength(int offset, int count, int size)
        {
            if (size <= 0 || offset < 0 || offset >= size || count <= 0 || count > ReadBlockSize) throw MediaPolicy.Invalid("Invalid video range.");
            return Math.Min(count, size - offset);
        }
    }
}