using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Xrm.Sdk;
using Xunit;

namespace Prisma.Plugins.Tests
{
    public class BlobMediaTests
    {
        private static string Hex(byte[] bytes) { return string.Concat(bytes.Select(value => value.ToString("x2"))); }
        private static string Sha(byte[] bytes) { using (var sha = SHA256.Create()) return Hex(sha.ComputeHash(bytes)); }

        [Fact]
        public void IncrementalShaMatchesFrameworkAcrossSerializedBlocks()
        {
            var random = new Random(7);
            foreach (var size in new[] { 1, 55, 56, 63, 64, 65, 119, 128, 1000, 4096 + 17 })
                foreach (var block in new[] { 64, 128, 1024 })
                {
                    var bytes = new byte[size];
                    random.NextBytes(bytes);
                    var state = Sha256State.Start().Serialize();
                    var offset = 0;
                    while (size - offset > block)
                    {
                        var next = Sha256State.Parse(state);
                        next.Append(bytes.Skip(offset).Take(block).ToArray());
                        state = next.Serialize();
                        offset += block;
                    }
                    Assert.Equal(Sha(bytes), Sha256State.Parse(state).Finish(bytes.Skip(offset).ToArray()));
                }
            Assert.Throws<InvalidPluginExecutionException>(() => Sha256State.Start().Append(new byte[63]));
            foreach (var bad in new[] { "", "x", new string('A', 64) + ":0", new string('a', 64) + ":1", new string('a', 63) + ":0", new string('a', 64) + ":-64" })
                Assert.Throws<InvalidPluginExecutionException>(() => Sha256State.Parse(bad));
        }

        [Fact]
        public void ConfigurationAcceptsOnlyPlainContainerUrlsAndExplicitUploads()
        {
            var configuration = BlobConfiguration.Parse("https://stprismamedia01.blob.core.windows.net/media", "yes");
            Assert.True(configuration.Uploads);
            Assert.Equal("https://stprismamedia01.blob.core.windows.net/media", configuration.Container.AbsoluteUri);
            Assert.False(BlobConfiguration.Parse("https://stprismamedia01.blob.core.windows.net/media", "no").Uploads);
            Assert.False(BlobConfiguration.Parse(null, null).Uploads);
            Assert.Throws<InvalidPluginExecutionException>(() => BlobConfiguration.Parse(null, "yes"));
            foreach (var bad in new[] { "http://stprismamedia01.blob.core.windows.net/media", "https://stprismamedia01.blob.core.windows.net/media?sv=1",
                "https://stprismamedia01.blob.core.windows.net/media/", "https://stprismamedia01.blob.core.windows.net.evil.test/media", "https://x.blob.core.windows.net/media",
                "https://stprismamedia01.blob.core.windows.net/Media", "https://stprismamedia01.blob.core.windows.net/a--b" })
                Assert.Throws<InvalidPluginExecutionException>(() => BlobConfiguration.Parse(bad, "no"));
        }

        [Fact]
        public void EligibilityKeepsImagesThumbnailsAndLinksInDataverse()
        {
            Assert.True(BlobMedia.Eligible("attachment", "video/mp4"));
            Assert.True(BlobMedia.Eligible("attachment", "text/html"));
            Assert.True(BlobMedia.Eligible("attachment", "application/pdf"));
            Assert.False(BlobMedia.Eligible("attachment", LinkedAssetPolicy.Mime));
            Assert.False(BlobMedia.Eligible("image", "image/png"));
            Assert.False(BlobMedia.Eligible("thumbnail", "image/jpeg"));
        }

        private static Entity Session(byte[] bytes, int blockSize, string declared = null)
        {
            var parent = Guid.NewGuid(); var target = Guid.NewGuid(); var id = Guid.NewGuid();
            var session = new Entity("nx_uploadsession", id) {
                ["nx_parentid"] = parent.ToString("D"), ["nx_targetid"] = target.ToString("D"), ["nx_storage"] = BlobMedia.Storage,
                ["nx_blobname"] = BlobMedia.Name(parent, target, id), ["nx_hashstate"] = Sha256State.Start().Serialize(), ["nx_mime"] = "video/mp4",
                ["nx_name"] = MediaPolicy.LargeSessionPrefix, ["nx_bytes"] = bytes.Length, ["nx_received"] = 0, ["nx_nextblock"] = 0, ["nx_complete"] = false
            };
            if (declared != null) session["nx_sha256"] = declared;
            return session;
        }

        private static void Apply(Entity session, Entity update) { foreach (var attribute in update.Attributes) session[attribute.Key] = attribute.Value; }

        private static void UploadAll(FakeBlobStore store, Entity session, byte[] bytes, int blockSize)
        {
            for (var index = 0; index * blockSize < bytes.Length; index++)
                Apply(session, BlobMedia.Stage(store, session, index, bytes.Skip(index * blockSize).Take(blockSize).ToArray()));
        }

        [Fact]
        public void BlobLifecycleVerifiesDigestAndPinsReadsToCommittedVersion()
        {
            var bytes = new byte[300];
            new Random(3).NextBytes(bytes);
            var store = new FakeBlobStore();
            var session = Session(bytes, 128, Sha(bytes));
            var first = BlobMedia.Stage(store, session, 0, bytes.Take(128).ToArray());
            // A rolled-back checkpoint leaves the session unchanged; retrying the same index replaces the staged block.
            Apply(session, BlobMedia.Stage(store, session, 0, bytes.Take(128).ToArray()));
            Assert.Equal(first.GetAttributeValue<string>("nx_hashstate"), session.GetAttributeValue<string>("nx_hashstate"));
            Apply(session, BlobMedia.Stage(store, session, 1, bytes.Skip(128).Take(128).ToArray()));
            Assert.Throws<InvalidPluginExecutionException>(() => BlobMedia.Commit(store, session));
            var hashing = new System.Diagnostics.Stopwatch();
            var storing = new System.Diagnostics.Stopwatch();
            Apply(session, BlobMedia.Stage(store, session, 2, bytes.Skip(256).ToArray(), hashing, storing));
            Assert.False(hashing.IsRunning || storing.IsRunning);
            Assert.Equal(Sha(bytes), session.GetAttributeValue<string>("nx_hashstate"));
            var commit = BlobMedia.Commit(store, session);
            Assert.True(commit.GetAttributeValue<bool>("nx_complete"));
            Assert.Equal(Sha(bytes), commit.GetAttributeValue<string>("nx_sha256"));
            Assert.Null(commit.GetAttributeValue<string>("nx_hashstate"));
            var retry = BlobMedia.Commit(store, session);
            Assert.Equal(commit.GetAttributeValue<string>("nx_blobetag"), retry.GetAttributeValue<string>("nx_blobetag"));
            Assert.Equal(1, store.Commits);
            Apply(session, commit);
            BlobMedia.Verify(store, session);
            Assert.Equal(bytes.Skip(250).Take(50), BlobMedia.Read(store, session, 250, 50));
            store.Replace(BlobMedia.Name(session), new byte[300]);
            Assert.Throws<InvalidPluginExecutionException>(() => BlobMedia.Verify(store, session));
            Assert.Throws<InvalidPluginExecutionException>(() => BlobMedia.Read(store, session, 0, 10));
            BlobMedia.Delete(store, session);
            Assert.Equal(commit.GetAttributeValue<string>("nx_blobetag"), store.DeletedWith);
        }

        [Fact]
        public void DeclaredDigestTamperedReferencesAndCheckpointDriftFailClosed()
        {
            var bytes = Enumerable.Range(0, 200).Select(value => (byte)value).ToArray();
            var store = new FakeBlobStore();
            var session = Session(bytes, 128, new string('0', 64));
            UploadAll(store, session, bytes, 128);
            Assert.Contains("SHA-256", Assert.Throws<InvalidPluginExecutionException>(() => BlobMedia.Commit(store, session)).Message);
            Assert.Equal(0, store.Commits);

            var drift = Session(bytes, 128);
            drift["nx_received"] = 128;
            Assert.Throws<InvalidPluginExecutionException>(() => BlobMedia.Stage(store, drift, 1, bytes.Skip(128).ToArray()));

            var tampered = Session(bytes, 128);
            tampered["nx_blobname"] = BlobMedia.Name(Guid.NewGuid(), Guid.NewGuid(), tampered.Id);
            var untouched = new FakeBlobStore();
            Assert.Throws<InvalidPluginExecutionException>(() => BlobMedia.Stage(untouched, tampered, 0, bytes.Take(128).ToArray()));
            Assert.Empty(untouched.Staged);

            var incomplete = Session(bytes, 128);
            Assert.Throws<InvalidPluginExecutionException>(() => BlobMedia.Verify(store, incomplete));
            BlobMedia.Delete(store, incomplete);
            Assert.Null(store.DeletedWith);
        }

        [Fact]
        public void CommitRejectsExistingBlobOfDifferentSize()
        {
            var bytes = new byte[100];
            var store = new FakeBlobStore();
            var session = Session(bytes, 128);
            UploadAll(store, session, bytes, 128);
            store.Replace(BlobMedia.Name(session), new byte[99]);
            Assert.Throws<InvalidPluginExecutionException>(() => BlobMedia.Commit(store, session));
        }

        [Fact]
        public void RestClientSendsConditionalAuthenticatedRequestsAndMapsResponses()
        {
            var name = BlobMedia.Name(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
            var handler = new RecordingHandler();
            var tokens = 0;
            var client = new BlobRestClient(new Uri("https://stprismamedia01.blob.core.windows.net/media"), () => { tokens++; return "secret-token"; }, handler);

            handler.Next = _ => new HttpResponseMessage(HttpStatusCode.Created);
            client.Stage(name, "YmxvY2s=", new byte[] { 1, 2 });
            var stage = handler.Requests.Last();
            Assert.Equal(HttpMethod.Put, stage.Method);
            Assert.Equal("https://stprismamedia01.blob.core.windows.net/media/" + name + "?comp=block&blockid=YmxvY2s%3D", stage.RequestUri.AbsoluteUri);
            Assert.Equal("Bearer secret-token", stage.Headers.Authorization.ToString());
            Assert.True(stage.Headers.Contains("x-ms-version"));

            handler.Next = _ => { var response = new HttpResponseMessage(HttpStatusCode.Created); response.Headers.ETag = new System.Net.Http.Headers.EntityTagHeaderValue("\"0x1\""); return response; };
            Assert.Equal("\"0x1\"", client.Commit(name, new[] { "a", "b" }, "video/mp4"));
            var commit = handler.Requests.Last();
            Assert.Equal("*", commit.Headers.IfNoneMatch.Single().Tag);
            Assert.Contains("<Latest>a</Latest><Latest>b</Latest>", handler.Bodies.Last());
            Assert.Equal("video/mp4", commit.Headers.GetValues("x-ms-blob-content-type").Single());

            handler.Next = _ => Error(HttpStatusCode.Conflict, "BlobAlreadyExists");
            Assert.Null(client.Commit(name, new[] { "a" }, "video/mp4"));

            handler.Next = _ => new HttpResponseMessage(HttpStatusCode.PartialContent) { Content = new ByteArrayContent(new byte[] { 9, 8, 7 }) };
            Assert.Equal(new byte[] { 9, 8, 7 }, client.Read(name, 10, 3, "\"0x1\""));
            var read = handler.Requests.Last();
            Assert.Equal("bytes=10-12", read.Headers.GetValues("x-ms-range").Single());
            Assert.Equal("\"0x1\"", read.Headers.IfMatch.Single().Tag);

            handler.Next = _ => Error(HttpStatusCode.PreconditionFailed, "ConditionNotMet");
            Assert.Contains("changed", Assert.Throws<InvalidPluginExecutionException>(() => client.Read(name, 0, 3, "\"0x1\"")).Message);

            handler.Next = _ => new HttpResponseMessage(HttpStatusCode.NotFound);
            Assert.Null(client.Properties(name));
            client.Delete(name, "\"0x1\"");
            Assert.Equal("\"0x1\"", handler.Requests.Last().Headers.IfMatch.Single().Tag);

            handler.Next = _ => Error(HttpStatusCode.Forbidden, "AuthorizationPermissionMismatch");
            var denied = Assert.Throws<InvalidPluginExecutionException>(() => client.Stage(name, "YQ==", new byte[] { 1 }));
            Assert.Contains("403 AuthorizationPermissionMismatch", denied.Message);
            Assert.DoesNotContain("secret-token", denied.Message);

            var count = handler.Requests.Count;
            foreach (var bad in new[] { "../x", name + "?comp=list", name.ToUpperInvariant(), "a/b/c" })
                Assert.Throws<InvalidPluginExecutionException>(() => client.Properties(bad));
            Assert.Equal(count, handler.Requests.Count);
            Assert.Equal(1, tokens);
        }

        [Fact]
        public void StorageConfigurationIsReusedForAMinuteAndFailuresAreNotCached()
        {
            var now = new DateTime(2026, 9, 29, 12, 0, 0, DateTimeKind.Utc);
            var loads = 0;
            BlobConfiguration.ClearCache();
            Assert.Throws<InvalidPluginExecutionException>(() => BlobConfiguration.Cached(() => { loads++; return BlobConfiguration.Parse(null, "yes"); }, now));
            var first = BlobConfiguration.Cached(() => { loads++; return BlobConfiguration.Parse("https://stprismamedia01.blob.core.windows.net/media", "yes"); }, now);
            Assert.Same(first, BlobConfiguration.Cached(() => { loads++; return BlobConfiguration.Parse(null, "no"); }, now.AddSeconds(59)));
            Assert.False(BlobConfiguration.Cached(() => { loads++; return BlobConfiguration.Parse(null, "no"); }, now.AddSeconds(60)).Uploads);
            Assert.Equal(3, loads);
            BlobConfiguration.ClearCache();
        }

        [Fact]
        public void StorageTokenIsReusedUntilShortlyBeforeExpiryAndNeverCachedWithoutOne()
        {
            string Jwt(DateTime expires) => "e30." + Convert.ToBase64String(Encoding.UTF8.GetBytes("{\"aud\":\"https://storage.azure.com\",\"exp\":" + (long)(expires - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds + "}")).TrimEnd('=').Replace('+', '-').Replace('/', '_') + ".sig";
            var now = new DateTime(2026, 9, 29, 12, 0, 0, DateTimeKind.Utc);
            Assert.Equal(now.AddHours(1), StorageToken.Expiry(Jwt(now.AddHours(1))));
            Assert.Null(StorageToken.Expiry("opaque"));
            var calls = 0;
            StorageToken.Clear();
            var first = StorageToken.Get(() => { calls++; return Jwt(now.AddHours(1)); }, now);
            Assert.Equal(first, StorageToken.Get(() => { calls++; return "other"; }, now.AddMinutes(29)));
            Assert.Equal(1, calls);
            StorageToken.Get(() => { calls++; return Jwt(now.AddMinutes(50)); }, now.AddMinutes(30));
            Assert.Equal(2, calls);
            StorageToken.Get(() => { calls++; return "opaque"; }, now.AddMinutes(46));
            StorageToken.Get(() => { calls++; return "opaque"; }, now.AddMinutes(46));
            Assert.Equal(4, calls);
            StorageToken.Clear();
        }

        private static HttpResponseMessage Error(HttpStatusCode status, string code)
        {
            var response = new HttpResponseMessage(status);
            response.Headers.Add("x-ms-error-code", code);
            return response;
        }

        private sealed class RecordingHandler : HttpMessageHandler
        {
            public List<HttpRequestMessage> Requests { get; } = new List<HttpRequestMessage>();
            public List<string> Bodies { get; } = new List<string>();
            public Func<HttpRequestMessage, HttpResponseMessage> Next { get; set; }
            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                var copy = new HttpRequestMessage(request.Method, request.RequestUri);
                foreach (var header in request.Headers) copy.Headers.TryAddWithoutValidation(header.Key, header.Value);
                Requests.Add(copy);
                Bodies.Add(request.Content == null ? null : await request.Content.ReadAsStringAsync());
                return Next(request);
            }
        }

        private sealed class FakeBlobStore : IBlobStore
        {
            private readonly Dictionary<string, byte[]> blobs = new Dictionary<string, byte[]>();
            private readonly Dictionary<string, string> etags = new Dictionary<string, string>();
            private int version;
            public Dictionary<string, byte[]> Staged { get; } = new Dictionary<string, byte[]>();
            public int Commits { get; private set; }
            public string DeletedWith { get; private set; }

            public void Stage(string name, string blockId, byte[] bytes) { Staged[name + "|" + blockId] = bytes; }
            public string Commit(string name, IList<string> blockIds, string contentType)
            {
                if (blobs.ContainsKey(name)) return null;
                Commits++;
                return Replace(name, blockIds.SelectMany(id => Staged[name + "|" + id]).ToArray());
            }
            public string Replace(string name, byte[] bytes) { blobs[name] = bytes; return etags[name] = "\"v" + ++version + "\""; }
            public BlobProperties Properties(string name) { return blobs.ContainsKey(name) ? new BlobProperties { Size = blobs[name].Length, ETag = etags[name] } : null; }
            public byte[] Read(string name, long offset, int count, string etag)
            {
                if (etags[name] != etag) throw MediaPolicy.Invalid("Stored media changed. Reopen the viewer.");
                return blobs[name].Skip((int)offset).Take(count).ToArray();
            }
            public void Delete(string name, string etag) { DeletedWith = etag; blobs.Remove(name); }
        }
    }
}
