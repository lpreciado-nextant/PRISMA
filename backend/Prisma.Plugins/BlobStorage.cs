using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Prisma.Plugins
{
    public sealed class BlobProperties
    {
        public long Size { get; set; }
        public string ETag { get; set; }
    }

    public interface IBlobStore
    {
        void Stage(string name, string blockId, byte[] bytes);
        // Returns null when the blob already exists; nothing is overwritten.
        string Commit(string name, IList<string> blockIds, string contentType);
        BlobProperties Properties(string name);
        byte[] Read(string name, long offset, int count, string etag);
        void Delete(string name, string etag);
    }

    public sealed class BlobConfiguration
    {
        public const string ContainerVariable = "nx_MediaBlobContainerUrl";
        public const string UploadsVariable = "nx_MediaBlobUploads";
        private static readonly Regex ContainerUrl = new Regex("\\Ahttps://[a-z0-9]{3,24}\\.blob\\.core\\.windows\\.net/[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,62}\\z");

        public Uri Container { get; private set; }
        public bool Uploads { get; private set; }

        public static BlobConfiguration Parse(string container, string uploads)
        {
            container = string.IsNullOrWhiteSpace(container) ? null : container.Trim();
            if (container != null && !ContainerUrl.IsMatch(container)) throw MediaPolicy.Invalid("Media storage configuration is invalid.");
            var enabled = string.Equals(uploads?.Trim(), "yes", StringComparison.Ordinal);
            if (enabled && container == null) throw MediaPolicy.Invalid("Blob uploads are enabled without a media container.");
            return new BlobConfiguration { Container = container == null ? null : new Uri(container), Uploads = enabled };
        }

        public static BlobConfiguration Read(IOrganizationService server) { return Cached(() => Load(server), DateTime.UtcNow); }

        private static readonly object Gate = new object();
        private static BlobConfiguration cached;
        private static DateTime cachedUntil;

        // Every upload block and range read needs this; a setting change (including rollback) applies within a minute.
        public static BlobConfiguration Cached(Func<BlobConfiguration> load, DateTime now)
        {
            lock (Gate)
            {
                if (cached != null && now < cachedUntil) return cached;
                cached = load();
                cachedUntil = now.AddSeconds(60);
                return cached;
            }
        }

        public static void ClearCache() { lock (Gate) cached = null; }

        private static BlobConfiguration Load(IOrganizationService server)
        {
            var query = new QueryExpression("environmentvariabledefinition") { ColumnSet = new ColumnSet("schemaname", "defaultvalue") };
            query.Criteria.AddCondition("schemaname", ConditionOperator.In, ContainerVariable, UploadsVariable);
            var current = query.AddLink("environmentvariablevalue", "environmentvariabledefinitionid", "environmentvariabledefinitionid", JoinOperator.LeftOuter);
            current.Columns = new ColumnSet("value");
            current.EntityAlias = "current";
            var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in server.RetrieveMultiple(query).Entities)
            {
                var name = row.GetAttributeValue<string>("schemaname");
                if (values.ContainsKey(name)) throw MediaPolicy.Invalid("Media storage configuration is ambiguous.");
                values[name] = row.GetAttributeValue<AliasedValue>("current.value")?.Value as string ?? row.GetAttributeValue<string>("defaultvalue");
            }
            string container, uploads;
            values.TryGetValue(ContainerVariable, out container);
            values.TryGetValue(UploadsVariable, out uploads);
            return Parse(container, uploads);
        }
    }

    public sealed class MediaStorage
    {
        private const string Scope = "https://storage.azure.com/.default";
        private readonly IServiceProvider services;
        private readonly IOrganizationService server;
        private BlobConfiguration configuration;
        private IBlobStore store;

        public MediaStorage(IServiceProvider services, IOrganizationService server) { this.services = services; this.server = server; }
        public MediaStorage(BlobConfiguration configuration, IBlobStore store) { this.configuration = configuration; this.store = store; }

        public BlobConfiguration Configuration { get { return configuration ?? (configuration = BlobConfiguration.Read(server)); } }
        public bool UploadsToBlob { get { return Configuration.Uploads; } }

        public IBlobStore Store
        {
            get
            {
                if (store != null) return store;
                if (Configuration.Container == null) throw MediaPolicy.Invalid("Media storage is not configured.");
                var identity = (IManagedIdentityService)services.GetService(typeof(IManagedIdentityService));
                if (identity == null) throw MediaPolicy.Invalid("Media storage identity is unavailable.");
                return store = new BlobRestClient(Configuration.Container, () => StorageToken.Get(() =>
                {
                    try { return identity.AcquireToken(new[] { Scope }); }
                    catch (Exception error) { throw new InvalidPluginExecutionException("Media storage identity is unavailable.", error); }
                }, DateTime.UtcNow));
            }
        }
    }

    // Sandbox workers reuse the assembly across executions; acquiring a token for every upload block cost about a second.
    public static class StorageToken
    {
        private static readonly object Gate = new object();
        private static string cached;
        private static DateTime refreshAt;

        public static string Get(Func<string> acquire, DateTime now)
        {
            lock (Gate)
            {
                if (cached != null && now < refreshAt) return cached;
                var token = acquire();
                var expires = Expiry(token);
                cached = expires.HasValue ? token : null;
                if (expires.HasValue) refreshAt = new[] { expires.Value.AddMinutes(-5), now.AddMinutes(30) }.Min();
                return token;
            }
        }

        public static void Clear() { lock (Gate) cached = null; }

        public static DateTime? Expiry(string token)
        {
            var parts = (token ?? "").Split('.');
            if (parts.Length != 3) return null;
            try
            {
                var payload = parts[1].Replace('-', '+').Replace('_', '/');
                payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
                var match = Regex.Match(Encoding.UTF8.GetString(Convert.FromBase64String(payload)), "\"exp\"\\s*:\\s*(\\d{9,11})");
                return match.Success ? new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddSeconds(long.Parse(match.Groups[1].Value)) : (DateTime?)null;
            }
            catch (FormatException) { return null; }
        }
    }

    public static class BlobMedia
    {
        public const string Storage = "blob";
        private static readonly Regex Digest = new Regex("\\A[0-9a-f]{64}\\z");

        public static bool IsBlob(Entity session) { return session.GetAttributeValue<string>("nx_storage") == Storage; }
        public static bool Eligible(string kind, string mime) { return kind == "attachment" && mime != LinkedAssetPolicy.Mime && !mime.StartsWith("image/", StringComparison.Ordinal); }
        public static string Name(Guid parent, Guid target, Guid session) { return parent.ToString("N") + "/" + target.ToString("N") + "/" + session.ToString("N"); }

        public static string Name(Entity session)
        {
            Guid parent, target;
            var name = session.GetAttributeValue<string>("nx_blobname");
            if (!Guid.TryParse(session.GetAttributeValue<string>("nx_parentid"), out parent) || !Guid.TryParse(session.GetAttributeValue<string>("nx_targetid"), out target)
                || session.Id == Guid.Empty || name != Name(parent, target, session.Id)) throw MediaPolicy.Invalid("Invalid stored media reference.");
            return name;
        }

        public static Entity Stage(IBlobStore store, Entity session, int index, byte[] bytes, Stopwatch hashing = null, Stopwatch storing = null)
        {
            var total = session.GetAttributeValue<int>("nx_bytes");
            var received = session.GetAttributeValue<int>("nx_received");
            hashing?.Start();
            var state = Sha256State.Parse(session.GetAttributeValue<string>("nx_hashstate"));
            if (state.Length != received) throw MediaPolicy.Invalid("Upload integrity state does not match the checkpoint. Reopen the draft.");
            string hash;
            if (received + bytes.Length == total) hash = state.Finish(bytes);
            else { state.Append(bytes); hash = state.Serialize(); }
            hashing?.Stop();
            // Re-staging an unacknowledged index replaces the same block ID, so a rolled-back checkpoint is safe to retry.
            storing?.Start();
            store.Stage(Name(session), MediaPolicy.BlockId(session.Id, index), bytes);
            storing?.Stop();
            return new Entity("nx_uploadsession", session.Id) { ["nx_received"] = received + bytes.Length, ["nx_nextblock"] = index + 1, ["nx_hashstate"] = hash };
        }

        public static Entity Commit(IBlobStore store, Entity session)
        {
            var digest = session.GetAttributeValue<string>("nx_hashstate");
            if (digest == null || !Digest.IsMatch(digest)) throw MediaPolicy.Invalid("Upload integrity is incomplete. Reopen the draft.");
            var declared = session.GetAttributeValue<string>("nx_sha256");
            if (declared != null && declared != digest) throw MediaPolicy.Invalid("SHA-256 verification failed. Remove and restart the upload.");
            var name = Name(session);
            var size = session.GetAttributeValue<int>("nx_bytes");
            var blocks = Enumerable.Range(0, session.GetAttributeValue<int>("nx_nextblock")).Select(index => MediaPolicy.BlockId(session.Id, index)).ToList();
            var etag = store.Commit(name, blocks, session.GetAttributeValue<string>("nx_mime"));
            // Only this session's plug-in commits this unique name; an existing blob means an earlier commit whose Dataverse transaction rolled back.
            var stored = store.Properties(name);
            if (stored == null || stored.Size != size || (etag != null && stored.ETag != etag)) throw MediaPolicy.Invalid("Stored media differs from the upload. Remove and restart it.");
            return new Entity("nx_uploadsession", session.Id) { ["nx_complete"] = true, ["nx_blobetag"] = stored.ETag, ["nx_sha256"] = digest, ["nx_hashstate"] = null };
        }

        public static void Verify(IBlobStore store, Entity session)
        {
            var stored = session.GetAttributeValue<bool>("nx_complete") ? store.Properties(Name(session)) : null;
            if (stored == null || stored.Size != session.GetAttributeValue<int>("nx_bytes") || stored.ETag != session.GetAttributeValue<string>("nx_blobetag"))
                throw MediaPolicy.Invalid("Stored media changed or is unavailable.");
        }

        public static byte[] Read(IBlobStore store, Entity session, int offset, int count)
        {
            var etag = session.GetAttributeValue<string>("nx_blobetag");
            if (!session.GetAttributeValue<bool>("nx_complete") || string.IsNullOrEmpty(etag)) throw MediaPolicy.Invalid("Completed media is unavailable.");
            var bytes = store.Read(Name(session), offset, count, etag);
            if (bytes.Length != count) throw MediaPolicy.Invalid("Incomplete media range.");
            return bytes;
        }

        public static void Delete(IBlobStore store, Entity session)
        {
            store.Delete(Name(session), session.GetAttributeValue<bool>("nx_complete") ? session.GetAttributeValue<string>("nx_blobetag") : null);
        }
    }

    public sealed class BlobRestClient : IBlobStore
    {
        private const string ApiVersion = "2023-11-03";
        private static readonly Regex BlobName = new Regex("\\A[0-9a-f]{32}/[0-9a-f]{32}/[0-9a-f]{32}\\z");
        private static readonly HttpClient Shared = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        private readonly string container;
        private readonly Lazy<string> token;
        private readonly HttpClient http;

        public BlobRestClient(Uri container, Func<string> token, HttpMessageHandler handler = null)
        {
            this.container = container.AbsoluteUri.TrimEnd('/');
            this.token = new Lazy<string>(token);
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            if (handler != null) { http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) }; return; }
            // Kept-alive connections close after 15 s idle, before network devices silently drop them (Microsoft's KeepAlive caveat for plug-ins).
            var point = ServicePointManager.FindServicePoint(container);
            point.MaxIdleTime = 15000;
            point.ConnectionLeaseTimeout = 60000;
            http = Shared;
        }

        public void Stage(string name, string blockId, byte[] bytes)
        {
            using (var response = Send(HttpMethod.Put, name, "?comp=block&blockid=" + Uri.EscapeDataString(blockId), new ByteArrayContent(bytes), null))
                Expect(response, HttpStatusCode.Created);
        }

        public string Commit(string name, IList<string> blockIds, string contentType)
        {
            var body = new StringBuilder("<?xml version=\"1.0\" encoding=\"utf-8\"?><BlockList>");
            foreach (var id in blockIds) body.Append("<Latest>").Append(SecurityElement.Escape(id)).Append("</Latest>");
            body.Append("</BlockList>");
            using (var response = Send(HttpMethod.Put, name, "?comp=blocklist", new StringContent(body.ToString(), Encoding.UTF8, "application/xml"), request =>
            {
                request.Headers.IfNoneMatch.Add(EntityTagHeaderValue.Any);
                request.Headers.Add("x-ms-blob-content-type", contentType);
                request.Headers.Add("x-ms-blob-cache-control", "no-store");
            }))
            {
                var code = ErrorCode(response);
                if ((response.StatusCode == HttpStatusCode.Conflict && code == "BlobAlreadyExists") || response.StatusCode == HttpStatusCode.PreconditionFailed) return null;
                Expect(response, HttpStatusCode.Created);
                return response.Headers.ETag?.ToString() ?? throw MediaPolicy.Invalid("Media storage returned no version.");
            }
        }

        public BlobProperties Properties(string name)
        {
            using (var response = Send(HttpMethod.Head, name, "", null, null))
            {
                if (response.StatusCode == HttpStatusCode.NotFound) return null;
                Expect(response, HttpStatusCode.OK);
                var size = response.Content.Headers.ContentLength;
                var etag = response.Headers.ETag?.ToString();
                if (!size.HasValue || etag == null) throw MediaPolicy.Invalid("Media storage returned incomplete properties.");
                return new BlobProperties { Size = size.Value, ETag = etag };
            }
        }

        public byte[] Read(string name, long offset, int count, string etag)
        {
            if (offset < 0 || count <= 0 || count > MediaTransferPolicy.BlobReadBlockSize) throw MediaPolicy.Invalid("Invalid media range.");
            using (var response = Send(HttpMethod.Get, name, "", null, request =>
            {
                request.Headers.IfMatch.Add(EntityTagHeaderValue.Parse(etag));
                request.Headers.Add("x-ms-range", "bytes=" + offset + "-" + (offset + count - 1));
            }))
            {
                if (response.StatusCode == HttpStatusCode.PreconditionFailed) throw MediaPolicy.Invalid("Stored media changed. Reopen the viewer.");
                Expect(response, HttpStatusCode.PartialContent);
                var bytes = response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult();
                if (bytes.Length != count) throw MediaPolicy.Invalid("Incomplete media range.");
                return bytes;
            }
        }

        public void Delete(string name, string etag)
        {
            using (var response = Send(HttpMethod.Delete, name, "", null, request => { if (etag != null) request.Headers.IfMatch.Add(EntityTagHeaderValue.Parse(etag)); }))
            {
                if (response.StatusCode == HttpStatusCode.NotFound) return;
                Expect(response, HttpStatusCode.Accepted);
            }
        }

        private HttpResponseMessage Send(HttpMethod method, string name, string query, HttpContent content, Action<HttpRequestMessage> configure)
        {
            if (name == null || !BlobName.IsMatch(name)) throw MediaPolicy.Invalid("Invalid stored media reference.");
            var request = new HttpRequestMessage(method, container + "/" + name + query) { Content = content };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Value);
            request.Headers.Add("x-ms-version", ApiVersion);
            request.Headers.Add("x-ms-date", DateTime.UtcNow.ToString("R"));
            configure?.Invoke(request);
            try
            {
                var response = http.SendAsync(request).GetAwaiter().GetResult();
                if (response.StatusCode == HttpStatusCode.Unauthorized) StorageToken.Clear();
                return response;
            }
            catch (Exception error) when (error is HttpRequestException || error is TaskCanceledException) { throw MediaPolicy.Invalid("Media storage is unreachable. Reopen before retrying."); }
            finally { request.Dispose(); }
        }

        private static string ErrorCode(HttpResponseMessage response)
        {
            IEnumerable<string> values;
            return response.Headers.TryGetValues("x-ms-error-code", out values) ? values.FirstOrDefault() : null;
        }

        private static void Expect(HttpResponseMessage response, HttpStatusCode status)
        {
            if (response.StatusCode != status)
                throw MediaPolicy.Invalid("Media storage request failed (" + (int)response.StatusCode + (ErrorCode(response) is string code ? " " + code : "") + "). Reopen before retrying.");
        }
    }

    public sealed class BlobDeletion : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            // Runs asynchronously after commit, so a rolled-back removal never deletes bytes that Dataverse still references.
            if (context.MessageName != "Delete" || context.PrimaryEntityName != "nx_uploadsession" || context.Stage != 40 || context.Mode != 1)
                throw MediaPolicy.Invalid("Blob deletion must run asynchronously after an upload session is deleted.");
            Entity session;
            if (!context.PreEntityImages.TryGetValue("session", out session)) throw MediaPolicy.Invalid("Blob deletion requires the session pre-image.");
            if (!BlobMedia.IsBlob(session)) return;
            ((ITracingService)serviceProvider.GetService(typeof(ITracingService)))?.Trace("Deleting stored media for upload session {0}.", session.Id);
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            BlobMedia.Delete(new MediaStorage(serviceProvider, factory.CreateOrganizationService(null)).Store, session);
        }
    }
}
