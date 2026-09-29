using System;
using System.Linq;
using System.IO;
using System.Text;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Microsoft.Xrm.Sdk.Messages;

namespace Prisma.Plugins
{
    [DataContract]
    public sealed class VideoRange
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "assetId")] public string AssetId { get; set; }
        [DataMember(Name = "version")] public string Version { get; set; }
        [DataMember(Name = "size")] public int Size { get; set; }
        [DataMember(Name = "offset")] public int Offset { get; set; }
        [DataMember(Name = "content")] public string Content { get; set; }
        [DataMember(Name = "mime")] public string Mime { get; set; }
        [DataMember(Name = "maxRead")] public int MaxRead { get; set; }
        [DataMember(Name = "serverMs")] public long ServerMs { get; set; }
    }

    public sealed class MediaTransferApi : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var clock = System.Diagnostics.Stopwatch.StartNew();
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            var server = factory.CreateOrganizationService(null);
            var id = (Guid)context.InputParameters["SolutionId"];
            var storage = new MediaStorage(serviceProvider, server);
            if (context.MessageName == "nx_ReadVideoRange")
            {
                var mode = context.InputParameters["Mode"] as string;
                var columns = new ColumnSet("ownerid", "statecode", "nx_publicationstatus", "nx_clientsafereviewed", "nx_safetyacknowledged");
                var parent = caller.Retrieve("nx_solution", id, columns);
                var owner = parent.GetAttributeValue<EntityReference>("ownerid");
                var librarian = mode == "submission" && (owner?.LogicalName != "systemuser" || owner.Id != context.InitiatingUserId) && ReviewApi.IsLibrarian(server, context.InitiatingUserId);
                MediaTransferPolicy.ReadAccess(parent, context.InitiatingUserId, librarian, mode);
                var assetId = (Guid)context.InputParameters["AssetId"];
                var session = MediaApi.Session(server, id, assetId);
                if (session == null || !session.GetAttributeValue<bool>("nx_complete") || session.GetAttributeValue<string>("nx_kind") != "attachment"
                    || !BlobMedia.Eligible("attachment", session.GetAttributeValue<string>("nx_mime") ?? LinkedAssetPolicy.Mime)) throw MediaPolicy.Invalid("Completed attachment is unavailable.");
                var target = caller.Retrieve("nx_demoasset", assetId, new ColumnSet("nx_solution"));
                if (target.GetAttributeValue<EntityReference>("nx_solution")?.Id != id) throw MediaPolicy.Invalid("Video does not belong to this solution.");
                var version = parent.RowVersion + ":" + target.RowVersion + ":" + session.Id.ToString("N");
                var expected = context.InputParameters.Contains("Version") ? context.InputParameters["Version"] as string : null;
                if (!string.IsNullOrEmpty(expected) && expected != version) throw MediaPolicy.Invalid("Video access or version changed. Reopen the viewer.");
                var size = session.GetAttributeValue<int>("nx_bytes");
                var offset = (int)context.InputParameters["Offset"];
                var blob = BlobMedia.IsBlob(session);
                var maxRead = blob ? MediaTransferPolicy.BlobReadBlockSize : MediaTransferPolicy.FileReadBlockSize;
                var count = MediaTransferPolicy.ReadLength(offset, (int)context.InputParameters["Count"], size, maxRead);
                byte[] data;
                if (blob) data = BlobMedia.Read(storage.Store, session, offset, count);
                else
                {
                    var download = (InitializeFileBlocksDownloadResponse)caller.Execute(new InitializeFileBlocksDownloadRequest { Target = target.ToEntityReference(), FileAttributeName = "nx_filemedia" });
                    if (!download.IsChunkingSupported || download.FileSizeInBytes != size) throw MediaPolicy.Invalid("Bounded video reads are unavailable.");
                    data = ((DownloadBlockResponse)caller.Execute(new DownloadBlockRequest { FileContinuationToken = download.FileContinuationToken, Offset = offset, BlockLength = count })).Data;
                    if (data.Length != count) throw MediaPolicy.Invalid("Incomplete video range.");
                }
                var latest = caller.Retrieve("nx_solution", id, columns);
                MediaTransferPolicy.ReadAccess(latest, context.InitiatingUserId, librarian, mode);
                var latestTarget = caller.Retrieve("nx_demoasset", assetId, new ColumnSet(false));
                if (latest.RowVersion != parent.RowVersion || latestTarget.RowVersion != target.RowVersion) throw MediaPolicy.Invalid("Video changed during read.");
                context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new VideoRange { Id = id.ToString("D"), AssetId = assetId.ToString("D"), Version = version,
                    Offset = offset, Size = size, Mime = session.GetAttributeValue<string>("nx_mime"), Content = Convert.ToBase64String(data), MaxRead = maxRead, ServerMs = clock.ElapsedMilliseconds });
                return;
            }
            if (!context.IsInTransaction) throw MediaPolicy.Invalid("A media transaction is required.");
            var draft = caller.Retrieve("nx_solution", id, new ColumnSet("ownerid", "nx_publicationstatus", "nx_status"));
            DraftPolicy.AssertEditable(draft, context.InitiatingUserId, context.InputParameters["ExpectedRowVersion"] as string);
            var digest = MediaTransferPolicy.Digest(context.InputParameters["Sha256"] as string);
            var name = context.InputParameters["FileName"] as string;
            var sizeInput = (int)context.InputParameters["Size"];
            if (context.MessageName == "nx_BeginResumableUpload")
            {
                var requested = context.InputParameters.Contains("BlockSize") ? context.InputParameters["BlockSize"] as int? ?? 0 : 0;
                if (requested != 0 && requested != MediaPolicy.LargeBlockSize && requested != MediaPolicy.BlobBlockSize) throw MediaPolicy.Invalid("Unsupported upload block size.");
                server.Execute(new UpdateRequest { Target = new Entity("nx_solution", id) { RowVersion = draft.RowVersion,
                    ["nx_clientsafereviewed"] = false, ["nx_safetyacknowledged"] = false }, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
                int blockSize;
                var createdSession = MediaApi.Begin(server, draft, context, storage, out blockSize, requested == MediaPolicy.BlobBlockSize ? "attachment:v4" : "attachment:v3");
                server.Update(new Entity("nx_uploadsession", createdSession) { ["nx_sha256"] = digest });
                context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new MediaResult { Id = id.ToString("D"),
                    RowVersion = caller.Retrieve("nx_solution", id, new ColumnSet(false)).RowVersion, SessionId = createdSession.ToString("D"),
                    BlockSize = blockSize, Media = MediaApi.Snapshots(server, id) });
                return;
            }
            if (context.MessageName != "nx_GetUploadCheckpoint") throw MediaPolicy.Invalid("Unknown media transfer operation.");
            var sessionId = (Guid)context.InputParameters["SessionId"];
            var upload = server.Retrieve("nx_uploadsession", sessionId, new ColumnSet("nx_name", "nx_parentid", "nx_callerid", "nx_sha256", "nx_filename", "nx_bytes", "nx_received", "nx_nextblock", "nx_complete", "nx_expires"));
            MediaTransferPolicy.Resume(upload, id, context.InitiatingUserId, digest, name, sizeInput, DateTime.UtcNow);
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new MediaResult { Id = id.ToString("D"), RowVersion = draft.RowVersion,
                SessionId = sessionId.ToString("D"), BlockSize = MediaPolicy.SessionBlockSize(upload), Media = MediaApi.Snapshots(server, id) });
        }
    }
}