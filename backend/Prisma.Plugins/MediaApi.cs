using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;

namespace Prisma.Plugins
{
    [DataContract]
    public sealed class MediaSnapshot
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "sessionId")] public string SessionId { get; set; }
        [DataMember(Name = "kind")] public string Kind { get; set; }
        [DataMember(Name = "name")] public string Name { get; set; }
        [DataMember(Name = "mime")] public string Mime { get; set; }
        [DataMember(Name = "size")] public int Size { get; set; }
        [DataMember(Name = "received")] public int Received { get; set; }
        [DataMember(Name = "nextBlock")] public int NextBlock { get; set; }
        [DataMember(Name = "complete")] public bool Complete { get; set; }
        [DataMember(Name = "caption")] public string Caption { get; set; }
        [DataMember(Name = "sortOrder")] public int SortOrder { get; set; }
        [DataMember(Name = "linkedAsset", EmitDefaultValue = false)] public LinkedAssetInput LinkedAsset { get; set; }
    }

    [DataContract]
    public sealed class LinkedAssetInput
    {
        [DataMember(Name = "id", EmitDefaultValue = false)] public string Id { get; set; }
        [DataMember(Name = "name", IsRequired = true)] public string Name { get; set; }
        [DataMember(Name = "assetType", IsRequired = true)] public string AssetType { get; set; }
        [DataMember(Name = "externalUrl", IsRequired = true)] public string ExternalUrl { get; set; }
        [DataMember(Name = "allowsEmbedding", IsRequired = true)] public bool AllowsEmbedding { get; set; }
        [DataMember(Name = "embedHint", IsRequired = true)] public string EmbedHint { get; set; }
    }

    public static class LinkedAssetPolicy
    {
        public const string Mime = "application/vnd.prisma.link";
        public static int Choice(string type)
        {
            switch (type)
            {
                case "Hosted web app (URL)": return 125060007;
                case "Power Apps": return 125060008;
                case "Power BI": return 125060003;
                case "Desktop app or script": return 125060004;
                default: throw MediaPolicy.Invalid("Unsupported linked asset type.");
            }
        }
        public static string Type(int choice)
        {
            switch (choice)
            {
                case 125060007: return "Hosted web app (URL)";
                case 125060008: return "Power Apps";
                case 125060003: return "Power BI";
                case 125060004: return "Desktop app or script";
                default: throw MediaPolicy.Invalid("Unsupported linked asset type.");
            }
        }
        public static LinkedAssetInput Validate(LinkedAssetInput value)
        {
            if (value == null || value.Name == null || value.EmbedHint == null || value.ExternalUrl == null) throw MediaPolicy.Invalid("Missing linked asset fields.");
            Choice(value.AssetType);
            if (value.Id != null) ContributorPolicy.Identifier(value.Id);
            value.Name = value.Name.Trim(); value.EmbedHint = value.EmbedHint.Trim(); value.ExternalUrl = value.ExternalUrl.Trim();
            if (value.Name.Length == 0 || value.Name.Length > 100 || value.Name.Any(char.IsControl) || value.EmbedHint.Length > 200) throw MediaPolicy.Invalid("Asset name or note exceeds its limit.");
            if (value.AssetType == "Desktop app or script")
            {
                if (value.ExternalUrl.Length != 0 || value.AllowsEmbedding || value.EmbedHint.Length == 0) throw MediaPolicy.Invalid("Desktop assets require demonstration guidance, not a URL or embedding.");
            }
            else
            {
                Uri uri;
                if (value.ExternalUrl.Length > 2000 || value.ExternalUrl.Any(character => char.IsControl(character) || char.IsWhiteSpace(character) || character == '\\')
                    || !Uri.TryCreate(value.ExternalUrl, UriKind.Absolute, out uri) || uri.Scheme != Uri.UriSchemeHttps || uri.UserInfo.Length != 0 || uri.Host.Length == 0)
                    throw MediaPolicy.Invalid("Use an HTTPS URL without credentials or spaces.");
                if (value.AssetType != "Hosted web app (URL)" && value.AllowsEmbedding) throw MediaPolicy.Invalid("Power Apps and Power BI must open in a new tab.");
            }
            return value;
        }
        public static LinkedAssetInput Parse(string json)
        {
            if (string.IsNullOrWhiteSpace(json) || json.Length > 4000) throw MediaPolicy.Invalid("Invalid linked asset payload.");
            try
            {
                var bytes = Encoding.UTF8.GetBytes(json);
                using (var reader = JsonReaderWriterFactory.CreateJsonReader(bytes, new XmlDictionaryReaderQuotas { MaxDepth = 8, MaxStringContentLength = 4000 }))
                    DraftGraph.CheckFields(XElement.Load(reader), "id", "name", "assetType", "externalUrl", "allowsEmbedding", "embedHint");
                using (var stream = new MemoryStream(bytes)) return Validate((LinkedAssetInput)new DataContractJsonSerializer(typeof(LinkedAssetInput)).ReadObject(stream));
            }
            catch (Exception error) when (error is SerializationException || error is XmlException || error is ArgumentException) { throw MediaPolicy.Invalid("Invalid linked asset payload."); }
        }
    }

    [DataContract]
    public sealed class MediaMetadata
    {
        [DataMember(Name = "id", IsRequired = true)] public string Id { get; set; }
        [DataMember(Name = "caption", IsRequired = true)] public string Caption { get; set; }
        [DataMember(Name = "sortOrder", IsRequired = true)] public int SortOrder { get; set; }
    }

    [DataContract]
    public sealed class MediaResult
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "rowVersion")] public string RowVersion { get; set; }
        [DataMember(Name = "sessionId")] public string SessionId { get; set; }
        [DataMember(Name = "blockSize")] public int BlockSize { get; set; }
        [DataMember(Name = "media")] public MediaSnapshot[] Media { get; set; }
        [DataMember(Name = "uploadProtocol")] public int UploadProtocol { get; set; } = 2;
        [DataMember(Name = "maxBlockSize")] public int MaxBlockSize { get; set; } = MediaPolicy.LargeBlockSize;
    }

    [DataContract]
    public sealed class MediaProgress
    {
        [DataMember(Name = "uploadProgress")] public bool UploadProgress { get; set; } = true;
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "rowVersion")] public string RowVersion { get; set; }
        [DataMember(Name = "sessionId")] public string SessionId { get; set; }
        [DataMember(Name = "blockSize")] public int BlockSize { get; set; }
        [DataMember(Name = "received")] public int Received { get; set; }
        [DataMember(Name = "nextBlock")] public int NextBlock { get; set; }
    }

    public static class MediaPolicy
    {
        public const int BlockSize = 524288;
        public const int OptimizedBlockSize = 2097152;
        public const string OptimizedSessionPrefix = "PRISMA upload v2 ";
        public const int LargeBlockSize = 4194304;
        public const string LargeSessionPrefix = "PRISMA upload v3 ";
        public static int SessionBlockSize(Entity session)
        {
            var name = session.GetAttributeValue<string>("nx_name") ?? "";
            return name.StartsWith(LargeSessionPrefix, StringComparison.Ordinal) ? LargeBlockSize : name.StartsWith(OptimizedSessionPrefix, StringComparison.Ordinal) ? OptimizedBlockSize : BlockSize;
        }
        public static int RequestedBlockSize(string kind) { return (kind ?? "").EndsWith(":v3", StringComparison.Ordinal) ? LargeBlockSize : (kind ?? "").EndsWith(":v2", StringComparison.Ordinal) ? OptimizedBlockSize : BlockSize; }
        public static readonly string[] Writes = { "nx_BeginMediaUpload", "nx_UploadMediaBlock", "nx_FinishMediaUpload", "nx_RemoveDraftMedia" };
        public static string Table(string kind) { return kind == "attachment" ? "nx_demoasset" : "nx_solutionimage"; }
        public static string Column(string kind) { return kind == "attachment" ? "nx_filemedia" : "nx_imagefile"; }

        public static MediaMetadata[] ParseMetadata(string json)
        {
            if (string.IsNullOrWhiteSpace(json) || json.Length > 4000) throw Invalid("Invalid or oversized media metadata.");
            MediaMetadata[] items;
            try
            {
                var bytes = Encoding.UTF8.GetBytes(json);
                using (var reader = JsonReaderWriterFactory.CreateJsonReader(bytes, new XmlDictionaryReaderQuotas { MaxDepth = 8, MaxStringContentLength = 4000 }))
                {
                    var root = XElement.Load(reader);
                    if ((string)root.Attribute("type") != "array") throw Invalid("Media metadata must be an array.");
                    foreach (var item in root.Elements()) DraftGraph.CheckFields(item, "id", "caption", "sortOrder");
                }
                using (var stream = new MemoryStream(bytes)) items = (MediaMetadata[])new DataContractJsonSerializer(typeof(MediaMetadata[])).ReadObject(stream);
            }
            catch (Exception error) when (error is SerializationException || error is XmlException || error is ArgumentException) { throw Invalid("Invalid media metadata."); }
            if (items == null || items.Length > 13) throw Invalid("Too many media records.");
            var identifiers = new HashSet<Guid>();
            foreach (var item in items)
                if (item == null || !identifiers.Add(ContributorPolicy.Identifier(item.Id)) || item.Caption == null || item.Caption.Length > 200 || item.SortOrder < 0 || item.SortOrder > 12)
                    throw Invalid("Invalid caption, order or duplicate media identifier.");
            return items;
        }

        public static string Mime(string kind, string name, int bytes)
        {
            if (string.IsNullOrWhiteSpace(name) || name.Length > 200 || name.Any(character => char.IsControl(character) || "\\/:*?\"<>|".Contains(character)))
                throw Invalid("Invalid file name.");
            var extension = System.IO.Path.GetExtension(name).ToLowerInvariant();
            var formats = new Dictionary<string, string> {
                { ".png", "image/png" }, { ".jpg", "image/jpeg" }, { ".jpeg", "image/jpeg" }, { ".webp", "image/webp" },
                { ".html", "text/html" }, { ".htm", "text/html" }, { ".pdf", "application/pdf" },
                { ".ppt", "application/vnd.ms-powerpoint" }, { ".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
                { ".mp4", "video/mp4" }, { ".webm", "video/webm" }
            };
            string mime;
            if (!formats.TryGetValue(extension, out mime) || (kind != "image" && kind != "attachment" && kind != "thumbnail") || (kind != "attachment") != mime.StartsWith("image/", StringComparison.Ordinal))
                throw Invalid("Unsupported media type.");
            var limit = kind != "attachment" ? 5 * 1024 * 1024 : mime.StartsWith("video/", StringComparison.Ordinal) ? 500 * 1024 * 1024 : 25 * 1024 * 1024;
            if (bytes <= 0 || bytes > limit) throw Invalid("File is empty or exceeds the media size limit.");
            return mime;
        }

        public static byte[] Block(string content, int index, int next, int total, int received, int blockSize = BlockSize)
        {
            if ((blockSize != BlockSize && blockSize != OptimizedBlockSize && blockSize != LargeBlockSize) || index < 0 || received < 0 || received >= total || (long)index * blockSize != received
                || index != next || content == null || content.Length > ((blockSize + 2) / 3) * 4) throw Invalid("Invalid or out-of-order upload block.");
            byte[] bytes;
            try { bytes = Convert.FromBase64String(content); }
            catch (FormatException) { throw Invalid("Invalid block encoding."); }
            if (bytes.Length != Math.Min(blockSize, total - received) || bytes.Length == 0) throw Invalid("Incorrect upload block length.");
            return bytes;
        }

        public static string BlockId(Guid session, int index) { return Convert.ToBase64String(Encoding.ASCII.GetBytes(session.ToString("N") + index.ToString("D8", CultureInfo.InvariantCulture))); }
        public static InvalidPluginExecutionException Invalid(string message) { return new InvalidPluginExecutionException(message); }
    }

    public sealed class MediaApi : IPlugin
    {
        private static readonly ColumnSet SessionColumns = new ColumnSet("nx_name", "nx_parentid", "nx_callerid", "nx_targetid", "nx_kind", "nx_filename", "nx_mime", "nx_token", "nx_bytes", "nx_received", "nx_nextblock", "nx_expires", "nx_complete");

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var read = context.MessageName == "nx_GetDraftMedia";
            if (!read && !MediaPolicy.Writes.Contains(context.MessageName)) throw MediaPolicy.Invalid("Unknown or retired media operation.");
            if (!context.IsInTransaction) throw MediaPolicy.Invalid("A media transaction is required.");
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            var server = factory.CreateOrganizationService(null);
            var identifier = (Guid)context.InputParameters["SolutionId"];
            var parent = caller.Retrieve("nx_solution", identifier, new ColumnSet("ownerid", "nx_publicationstatus", "nx_status"));
            var expected = read ? parent.RowVersion : context.InputParameters["ExpectedRowVersion"] as string;
            DraftPolicy.AssertEditable(parent, context.InitiatingUserId, expected);
            if (!read)
                server.Execute(new UpdateRequest {
                    Target = new Entity("nx_solution", identifier) { RowVersion = expected, ["nx_clientsafereviewed"] = false, ["nx_safetyacknowledged"] = false },
                    ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches
                });
            Guid? sessionId = null;
            var blockSize = MediaPolicy.BlockSize;
            Entity progressed = null;
            if (context.MessageName == "nx_BeginMediaUpload")
            {
                blockSize = MediaPolicy.RequestedBlockSize(context.InputParameters["Kind"] as string);
                sessionId = Begin(server, parent, context);
            }
            else if (!read)
            {
                sessionId = (Guid)context.InputParameters["SessionId"];
                var session = server.Retrieve("nx_uploadsession", sessionId.Value, SessionColumns);
                blockSize = MediaPolicy.SessionBlockSize(session);
                if (session.GetAttributeValue<string>("nx_parentid") != identifier.ToString("D") || session.GetAttributeValue<string>("nx_callerid") != context.InitiatingUserId.ToString("D"))
                    throw MediaPolicy.Invalid("Upload does not belong to this caller and draft.");
                if (context.MessageName == "nx_RemoveDraftMedia")
                {
                    server.Delete(MediaPolicy.Table(session.GetAttributeValue<string>("nx_kind")), Guid.Parse(session.GetAttributeValue<string>("nx_targetid")));
                    server.Delete("nx_uploadsession", session.Id);
                    sessionId = null;
                }
                else
                {
                    if (session.GetAttributeValue<bool>("nx_complete") || session.GetAttributeValue<DateTime>("nx_expires") <= DateTime.UtcNow) throw MediaPolicy.Invalid("Upload is complete or expired. Reopen the draft.");
                    if (context.MessageName == "nx_UploadMediaBlock") { Upload(server, session, context); progressed = session; }
                    else Finish(server, session, context.InitiatingUserId);
                }
            }
            var latest = caller.Retrieve("nx_solution", identifier, new ColumnSet(false));
            if (progressed != null && blockSize != MediaPolicy.BlockSize)
            {
                context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new MediaProgress { Id = identifier.ToString(), RowVersion = latest.RowVersion, SessionId = sessionId.ToString(), BlockSize = blockSize, Received = progressed.GetAttributeValue<int>("nx_received"), NextBlock = progressed.GetAttributeValue<int>("nx_nextblock") });
                return;
            }
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new MediaResult {
                Id = identifier.ToString(), RowVersion = latest.RowVersion, SessionId = sessionId?.ToString(),
                BlockSize = blockSize, Media = Snapshots(server, identifier)
            });
        }

        internal static Guid Begin(IOrganizationService server, Entity parent, IPluginExecutionContext context, string suppliedKind = null)
        {
            var kind = suppliedKind ?? context.InputParameters["Kind"] as string;
            var blockSize = MediaPolicy.RequestedBlockSize(kind);
            if (blockSize != MediaPolicy.BlockSize) kind = kind.Substring(0, kind.Length - 3);
            var name = context.InputParameters["FileName"] as string;
            var size = (int)context.InputParameters["Size"];
            var mime = MediaPolicy.Mime(kind, name, size);
            var sessions = Sessions(server, parent.Id);
            if (sessions.Count(row => row.GetAttributeValue<string>("nx_kind") == kind && row.GetAttributeValue<bool>("nx_complete")) >= (kind == "thumbnail" ? 1 : 6))
                throw MediaPolicy.Invalid("At most one thumbnail, six images and six attachments are allowed.");
            if (sessions.Any(row => !row.GetAttributeValue<bool>("nx_complete"))) throw MediaPolicy.Invalid("Remove the unfinished upload before starting another.");
            var column = ((RetrieveAttributeResponse)server.Execute(new RetrieveAttributeRequest { EntityLogicalName = MediaPolicy.Table(kind), LogicalName = MediaPolicy.Column(kind) })).AttributeMetadata;
            var limit = column is FileAttributeMetadata file ? file.MaxSizeInKB : ((ImageAttributeMetadata)column).MaxSizeInKB;
            if (!limit.HasValue || size > (long)limit.Value * 1024) throw MediaPolicy.Invalid("File exceeds the Dataverse column limit.");
            var team = Custodian(server);
            var target = new Entity(MediaPolicy.Table(kind)) {
                ["ownerid"] = team, ["nx_solution"] = parent.ToEntityReference(),
                [kind != "attachment" ? "nx_solutionimagename" : "nx_demoassetid1"] = name,
                ["nx_sortorder"] = sessions.Count == 0 ? 1 : sessions.Count + 1
            };
            if (kind == "attachment") target["nx_assettype"] = new OptionSetValue(mime == "text/html" ? 125060000 : mime.StartsWith("video/", StringComparison.Ordinal) ? 125060001 : 125060002);
            target.Id = server.Create(target);
            var upload = (InitializeFileBlocksUploadResponse)server.Execute(new InitializeFileBlocksUploadRequest { Target = target.ToEntityReference(), FileAttributeName = MediaPolicy.Column(kind), FileName = name });
            return server.Create(new Entity("nx_uploadsession") {
                ["nx_name"] = (blockSize == MediaPolicy.LargeBlockSize ? MediaPolicy.LargeSessionPrefix : blockSize == MediaPolicy.OptimizedBlockSize ? MediaPolicy.OptimizedSessionPrefix : "PRISMA upload ") + target.Id.ToString("N"), ["nx_parentid"] = parent.Id.ToString("D"),
                ["nx_callerid"] = context.InitiatingUserId.ToString("D"), ["nx_targetid"] = target.Id.ToString("D"),
                ["nx_kind"] = kind, ["nx_filename"] = name, ["nx_mime"] = mime, ["nx_token"] = upload.FileContinuationToken,
                ["nx_bytes"] = size, ["nx_received"] = 0, ["nx_nextblock"] = 0, ["nx_expires"] = DateTime.UtcNow.AddHours(2), ["nx_complete"] = false
            });
        }

        private static EntityReference Custodian(IOrganizationService server)
        {
            var teams = new QueryExpression("team") { ColumnSet = new ColumnSet(false) };
            teams.Criteria.AddCondition("name", ConditionOperator.Equal, "PRISMA Media Custodian");
            var team = server.RetrieveMultiple(teams).Entities.Single();
            var members = new QueryExpression("teammembership") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            members.Criteria.AddCondition("teamid", ConditionOperator.Equal, team.Id);
            if (server.RetrieveMultiple(members).Entities.Count != 0) throw MediaPolicy.Invalid("Media custodian must have no members.");
            return team.ToEntityReference();
        }

        public static void SaveLinkedAsset(IOrganizationService server, Entity parent, Guid caller, LinkedAssetInput value)
        {
            LinkedAssetPolicy.Validate(value);
            var sessions = Sessions(server, parent.Id);
            var existing = value.Id == null ? null : sessions.SingleOrDefault(row => row.GetAttributeValue<string>("nx_targetid") == value.Id);
            if (value.Id != null && (existing == null || existing.GetAttributeValue<string>("nx_mime") != LinkedAssetPolicy.Mime || !existing.GetAttributeValue<bool>("nx_complete"))) throw MediaPolicy.Invalid("Linked asset does not belong to this draft.");
            if (existing == null && sessions.Count(row => row.GetAttributeValue<string>("nx_kind") == "attachment") >= 6) throw MediaPolicy.Invalid("At most six attachments or linked assets are allowed.");
            if (sessions.Any(row => !row.GetAttributeValue<bool>("nx_complete"))) throw MediaPolicy.Invalid("Remove or finish the unfinished upload first.");
            var target = new Entity("nx_demoasset") {
                ["nx_demoassetid1"] = value.Name, ["nx_assettype"] = new OptionSetValue(LinkedAssetPolicy.Choice(value.AssetType)),
                ["nx_externalurl"] = value.ExternalUrl.Length == 0 ? null : value.ExternalUrl, ["nx_allowsembedding"] = value.AllowsEmbedding, ["nx_embedhint"] = value.EmbedHint
            };
            if (existing != null)
            {
                target.Id = Guid.Parse(value.Id); server.Update(target);
                server.Update(new Entity("nx_uploadsession", existing.Id) { ["nx_filename"] = value.Name });
                return;
            }
            target["ownerid"] = Custodian(server); target["nx_solution"] = parent.ToEntityReference(); target["nx_sortorder"] = Math.Min(12, sessions.Count + 1);
            target.Id = server.Create(target);
            server.Create(new Entity("nx_uploadsession") {
                ["nx_name"] = "PRISMA upload " + target.Id.ToString("N"), ["nx_parentid"] = parent.Id.ToString("D"),
                ["nx_callerid"] = caller.ToString("D"), ["nx_targetid"] = target.Id.ToString("D"),
                ["nx_kind"] = "attachment", ["nx_filename"] = value.Name, ["nx_mime"] = LinkedAssetPolicy.Mime,
                ["nx_bytes"] = 0, ["nx_received"] = 0, ["nx_nextblock"] = 0, ["nx_expires"] = DateTime.UtcNow, ["nx_complete"] = true
            });
            server.Execute(new GrantAccessRequest { Target = target.ToEntityReference(), PrincipalAccess = new PrincipalAccess { Principal = new EntityReference("systemuser", caller), AccessMask = AccessRights.ReadAccess } });
        }

        private static void Upload(IOrganizationService server, Entity session, IPluginExecutionContext context)
        {
            var index = (int)context.InputParameters["BlockIndex"];
            var received = session.GetAttributeValue<int>("nx_received");
            var bytes = MediaPolicy.Block(context.InputParameters["Content"] as string, index, session.GetAttributeValue<int>("nx_nextblock"), session.GetAttributeValue<int>("nx_bytes"), received, MediaPolicy.SessionBlockSize(session));
            server.Execute(new UploadBlockRequest { FileContinuationToken = session.GetAttributeValue<string>("nx_token"), BlockId = MediaPolicy.BlockId(session.Id, index), BlockData = bytes });
            server.Update(new Entity("nx_uploadsession", session.Id) { ["nx_received"] = received + bytes.Length, ["nx_nextblock"] = index + 1 });
            session["nx_received"] = received + bytes.Length;
            session["nx_nextblock"] = index + 1;
        }

        private static void Finish(IOrganizationService server, Entity session, Guid caller)
        {
            if (session.GetAttributeValue<int>("nx_received") != session.GetAttributeValue<int>("nx_bytes")) throw MediaPolicy.Invalid("Upload is incomplete.");
            var kind = session.GetAttributeValue<string>("nx_kind");
            var target = new EntityReference(MediaPolicy.Table(kind), Guid.Parse(session.GetAttributeValue<string>("nx_targetid")));
            var commit = (CommitFileBlocksUploadResponse)server.Execute(new CommitFileBlocksUploadRequest {
                FileContinuationToken = session.GetAttributeValue<string>("nx_token"), FileName = session.GetAttributeValue<string>("nx_filename"), MimeType = session.GetAttributeValue<string>("nx_mime"),
                BlockList = Enumerable.Range(0, session.GetAttributeValue<int>("nx_nextblock")).Select(index => MediaPolicy.BlockId(session.Id, index)).ToArray()
            });
            if (commit.FileSizeInBytes != session.GetAttributeValue<int>("nx_bytes")) throw MediaPolicy.Invalid("Committed file size differs from declared size.");
            server.Update(new Entity("nx_uploadsession", session.Id) { ["nx_complete"] = true, ["nx_token"] = null });
            server.Execute(new GrantAccessRequest { Target = target, PrincipalAccess = new PrincipalAccess { Principal = new EntityReference("systemuser", caller), AccessMask = AccessRights.ReadAccess } });
        }

        public static List<Entity> Sessions(IOrganizationService server, Guid parent)
        {
            var query = new QueryExpression("nx_uploadsession") { ColumnSet = SessionColumns, TopCount = 14 };
            query.Criteria.AddCondition("nx_parentid", ConditionOperator.Equal, parent.ToString("D"));
            query.Orders.Add(new OrderExpression("createdon", OrderType.Ascending));
            var rows = server.RetrieveMultiple(query).Entities.ToList();
            if (rows.Count > 13) throw MediaPolicy.Invalid("Unexpected media count.");
            return rows;
        }

        public static MediaSnapshot[] Snapshots(IOrganizationService service, Guid parent)
        {
            return Sessions(service, parent).Select(row => Snapshot(service, row)).OrderBy(item => item.SortOrder).ThenBy(item => item.Id).ToArray();
        }

        public static void VerifyStoredMedia(IOrganizationService service, Entity session)
        {
            var kind = session.GetAttributeValue<string>("nx_kind");
            if (session.GetAttributeValue<string>("nx_mime") == LinkedAssetPolicy.Mime)
            {
                if (kind != "attachment" || !session.GetAttributeValue<bool>("nx_complete") || session.GetAttributeValue<int>("nx_bytes") != 0
                    || session.GetAttributeValue<int>("nx_received") != 0 || session.GetAttributeValue<int>("nx_nextblock") != 0)
                    throw MediaPolicy.Invalid("Invalid linked asset lifecycle record.");
                Snapshot(service, session);
                return;
            }
            var target = new EntityReference(MediaPolicy.Table(kind), Guid.Parse(session.GetAttributeValue<string>("nx_targetid")));
            var download = (InitializeFileBlocksDownloadResponse)service.Execute(new InitializeFileBlocksDownloadRequest { Target = target, FileAttributeName = MediaPolicy.Column(kind) });
            if (download.FileSizeInBytes != session.GetAttributeValue<int>("nx_bytes")) throw MediaPolicy.Invalid("Stored media changed or is unavailable.");
        }

        public static MediaSnapshot Snapshot(IOrganizationService service, Entity row)
        {
            var kind = row.GetAttributeValue<string>("nx_kind");
            var linked = row.GetAttributeValue<string>("nx_mime") == LinkedAssetPolicy.Mime;
            var target = service.Retrieve(MediaPolicy.Table(kind), Guid.Parse(row.GetAttributeValue<string>("nx_targetid")), kind == "attachment" ? new ColumnSet("nx_sortorder", "nx_assettype", "nx_externalurl", "nx_allowsembedding", "nx_embedhint") : new ColumnSet("nx_sortorder", "nx_caption"));
            return new MediaSnapshot {
                SessionId = row.Id.ToString(), Id = row.GetAttributeValue<string>("nx_targetid"), Kind = row.GetAttributeValue<string>("nx_kind"),
                Name = row.GetAttributeValue<string>("nx_filename"), Mime = row.GetAttributeValue<string>("nx_mime"),
                Size = row.GetAttributeValue<int>("nx_bytes"), Received = row.GetAttributeValue<int>("nx_received"),
                NextBlock = row.GetAttributeValue<int>("nx_nextblock"), Complete = row.GetAttributeValue<bool>("nx_complete"),
                Caption = target.GetAttributeValue<string>("nx_caption") ?? "", SortOrder = Math.Min(12, target.GetAttributeValue<int>("nx_sortorder")),
                LinkedAsset = linked ? LinkedAssetPolicy.Validate(new LinkedAssetInput { Name = row.GetAttributeValue<string>("nx_filename"), AssetType = LinkedAssetPolicy.Type(target.GetAttributeValue<OptionSetValue>("nx_assettype").Value), ExternalUrl = target.GetAttributeValue<string>("nx_externalurl") ?? "", AllowsEmbedding = target.GetAttributeValue<bool>("nx_allowsembedding"), EmbedHint = target.GetAttributeValue<string>("nx_embedhint") ?? "" }) : null
            };
        }
    }

    public sealed class MediaWriteGuard : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (DraftPolicy.IsOperationContext(context, "nx_BeginResumableUpload") && (context.MessageName == "Create" || context.MessageName == "Update")) return;
            if (MediaPolicy.Writes.Any(message => DraftPolicy.IsOperationContext(context, message)) || (context.MessageName == "Delete" && DraftPolicy.IsDeleteContext(context))
                || ((context.MessageName == "Create" || context.MessageName == "Update") && (context.PrimaryEntityName == "nx_demoasset" || context.PrimaryEntityName == "nx_uploadsession") && DraftPolicy.IsTransitionContext(context, "asset"))
                || (context.MessageName == "Update" && context.PrimaryEntityName != "nx_uploadsession" && DraftPolicy.IsTransitionContext(context, "media"))) return;
            throw MediaPolicy.Invalid("Use the PRISMA mediated media API. Direct media/session changes are disabled.");
        }
    }
}
