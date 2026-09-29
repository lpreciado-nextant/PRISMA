import assert from "node:assert/strict";
import { test } from "node:test";
import { fileDigest, transferVideo, readVideoRange, readAttachment, parseVideoRange, type TransferApi } from "./mediaTransfer.ts";
import { parseMedia, type MediaApi, type MediaState } from "./media.ts";
import { bufferedAhead, FullVideoRequiredError, validateStreamingLayout } from "./videoStream.ts";
import { captionsVtt, decodeCaption } from "./mp4Captions.ts";
import { MediaContractError, mediaOperation, mediaProvider, rangeCount, type MediaProvider, type VideoFile } from "../../src/lib/mediaContract.ts";
import { createDataverseMediaAdapter } from "./dataverseMediaAdapter.ts";
import { createLocalMediaAdapter, localMediaSnapshot } from "../../local-media/adapter.ts";
const id = "11111111-1111-1111-1111-111111111111";
const asset = "22222222-2222-2222-2222-222222222222";
const wrap = (value: unknown) => ({ success: true, data: { ResultJson: JSON.stringify(value) } });
const signal = () => new AbortController().signal;
test("common media contract rejects unknown providers and requires reopen after an ambiguous write", async () => {
  assert.throws(() => mediaProvider("azure"), /Unsupported/);
  assert.throws(() => rangeCount({ id, assetId: asset, mode: "present", offset: -1, size: 24 }), /Invalid/);
  let calls = 0;
  await assert.rejects(mediaOperation(signal(), true, async () => { calls++; throw new Error("lost response"); }),
    error => !!error && typeof error === "object" && "recovery" in error && error.recovery === "reopen");
  assert.equal(calls, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(mediaOperation(controller.signal, true, async () => { calls++; }),
    error => !!error && typeof error === "object" && "recovery" in error && error.recovery === "none");
  assert.equal(calls, 1);
});
test("MP4 layout limitations require full playback without implying an access failure", () => {
  assert.doesNotThrow(() => validateStreamingLayout({ tracks: [{ type: "video" }, { type: "audio" }], isFragmented: false }));
  for (const type of ["subtitles", "metadata"]) {
    assert.throws(() => validateStreamingLayout({ tracks: [{ type: "video" }, { type }], isFragmented: false }), error => {
      assert.ok(error instanceof FullVideoRequiredError);
      assert.match(error.message, /additional tracks.*load in full/);
      assert.doesNotMatch(error.message, /access|unavailable/i);
      return true;
    });
  }
  assert.throws(() => validateStreamingLayout({ tracks: [{ type: "video" }], isFragmented: true }), FullVideoRequiredError);
  assert.equal(new Error("Access denied") instanceof FullVideoRequiredError, false);
});
test("MP4 caption decoding preserves timing and escapes WebVTT markup", () => {
  const text = new TextEncoder().encode("<b>Literal</b>");
  const data = new Uint8Array(text.length + 2); new DataView(data.buffer).setUint16(0, text.length); data.set(text, 2);
  const cue = decodeCaption(data, 100, 900, 1000)!;
  assert.equal(cue.start, 0.1); assert.equal(cue.end, 1); assert.equal(cue.text, "<b>Literal</b>");
  assert.match(captionsVtt({ language: "en", cues: [cue] }), /00:00:00\.100 --> 00:00:01\.000\n&lt;b&gt;Literal&lt;\/b&gt;/);
  assert.equal(decodeCaption(new Uint8Array([0, 0]), 0, 10, 1), null);
  assert.throws(() => decodeCaption(new Uint8Array([0, 10, 65]), 0, 10, 1));
});
test("disjoint future buffers do not block backward seek downloads", () => {
  const ranges = { length: 1, start: () => 116, end: () => 166 };
  assert.equal(bufferedAhead(ranges, 5), 0);
  assert.equal(bufferedAhead(ranges, 120), 46);
  assert.equal(bufferedAhead({ length: 1, start: () => 0.066, end: () => 30 }, 0), 30);
});
test("aborted video reads do not wait for an unresponsive SDK", async () => {
  const controller = new AbortController();
  const never = () => new Promise<never>(() => {});
  const pending = readVideoRange({ begin: never, checkpoint: never, range: never }, id, asset, "submission", 0, 3, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
test("incremental digest checks every byte and supports cancellation", async () => {
  assert.equal(await fileDigest(new File(["abc"], "file.mp4"), signal(), () => {}), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fileDigest(new File(["abc"], "file.mp4"), controller.signal, () => {}), { name: "AbortError" });
});
test("resume uses server counters without Begin or replay of confirmed bytes", async () => {
  const file = new File([new Uint8Array(4194307)], "file.mp4");
  const item = { id: asset, sessionId: asset, kind: "attachment" as const, name: file.name, mime: "video/mp4", size: file.size, received: 4194304, nextBlock: 1, complete: false };
  const state: MediaState = { id, rowVersion: "10", blockSize: 4194304, sessionId: asset, uploadProtocol: 2, media: [item] };
  const forbidden = async () => { throw new Error("Unexpected operation"); };
  const api: MediaApi = { read: forbidden, begin: forbidden, metadata: forbidden, remove: forbidden,
    block: async (_id, version, session, index, content) => {
      assert.equal(version, "10"); assert.equal(session, asset); assert.equal(index, 1); assert.equal(atob(content).length, 3);
      return wrap({ id, rowVersion: "11", sessionId: asset, blockSize: 4194304, uploadProgress: true, received: file.size, nextBlock: 2 });
    },
    finish: async (_id, version) => { assert.equal(version, "11"); return wrap({ ...state, rowVersion: "12", media: [{ ...item, received: file.size, nextBlock: 2, complete: true }] }); },
  };
  const transfer: TransferApi = { begin: forbidden, range: forbidden, checkpoint: async (_id, version, session, name, size, digest) => {
    assert.equal(version, "10"); assert.equal(session, asset); assert.equal(name, file.name); assert.equal(size, file.size); assert.match(digest, /^[a-f0-9]{64}$/);
    return wrap(state);
  } };
  const result = await transferVideo(api, transfer, state, file, signal(), () => {}, () => {}, asset);
  assert.equal(result.media[0].complete, true);
  let writes = 0;
  await assert.rejects(transferVideo(api, { ...transfer, checkpoint: async () => { throw new Error("Wrong digest"); } }, state, file, signal(), () => {}, () => {}, asset, () => { writes++; }), /Wrong digest/);
  assert.equal(writes, 0);
});
test("video ranges reject mismatched versions, sizes, offsets and canceled results", async () => {
  const version = "123:456:" + "a".repeat(32);
  const response = { id, assetId: asset, version, offset: 0, size: 3, mime: "video/mp4", content: btoa("abc") };
  const forbidden = async () => { throw new Error("Unexpected operation"); };
  const api: TransferApi = { begin: forbidden, checkpoint: forbidden, range: async () => wrap(response) };
  assert.deepEqual([...((await readVideoRange(api, id, asset, "present", 0, 3, signal())).bytes)], [97, 98, 99]);
  for (const patch of [{ id: asset }, { offset: 1 }, { size: 4 }, { content: btoa("ab") }, { version: "bad" }])
    await assert.rejects(readVideoRange({ ...api, range: async () => wrap({ ...response, ...patch }) }, id, asset, "present", 0, 3, signal(), version));
  const controller = new AbortController();
  await assert.rejects(readVideoRange({ ...api, range: async () => { controller.abort(); return wrap(response); } }, id, asset, "present", 0, 3, controller.signal), { name: "AbortError" });
});
test("Blob-backed attachments assemble bounded ranges pinned to the first version and exact type", async () => {
  const size = 1024 * 1024 + 5;
  const bytes = Uint8Array.from({ length: size }, (_value, index) => index % 251);
  const version = "123:456:" + "b".repeat(32);
  const calls: { offset: number; count: number; version?: string }[] = [];
  const forbidden = async () => { throw new Error("Unexpected operation"); };
  let served = version;
  const range = async (_id: string, _asset: string, mode: string, offset: number, count: number, expected?: string) => {
    assert.equal(mode, "published"); calls.push({ offset, count, version: expected });
    const chunk = bytes.subarray(offset, offset + count);
    return wrap({ id, assetId: asset, version: served, offset, size, mime: "application/pdf", content: Buffer.from(chunk).toString("base64") });
  };
  const api: TransferApi = { begin: forbidden, checkpoint: forbidden, range };
  const blob = await readAttachment(api, id, { id: asset, size, mime: "application/pdf" }, "published", signal());
  assert.equal(blob.type, "application/pdf");
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
  assert.deepEqual(calls, [{ offset: 0, count: 1024 * 1024, version: undefined }, { offset: 1024 * 1024, count: 5, version }]);
  await assert.rejects(readAttachment(api, id, { id: asset, size, mime: "text/html" }, "published", signal()), /Unconfirmed/);
  let first = true;
  const changing: TransferApi = { ...api, range: async (...args) => { served = first ? version : "123:457:" + "b".repeat(32); first = false; return range(...args); } };
  await assert.rejects(readAttachment(changing, id, { id: asset, size, mime: "application/pdf" }, "published", signal()), /Unconfirmed/);
});
test("advertised larger reads run concurrently, stay pinned and assemble in order", async () => {
  const maxRead = 4 * 1024 * 1024;
  const size = 1024 * 1024 + 3 * maxRead + 7;
  const bytes = Uint8Array.from({ length: size }, (_value, index) => index % 253);
  const version = "123:456:" + "c".repeat(32);
  const calls: { offset: number; count: number; version?: string }[] = [];
  let active = 0, peak = 0, failAt = -1;
  const forbidden = async () => { throw new Error("Unexpected operation"); };
  const range = async (_id: string, _asset: string, _mode: string, offset: number, count: number, expected?: string) => {
    calls.push({ offset, count, version: expected }); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, offset ? 20 - (offset / maxRead) * 4 : 0));
    active--;
    if (offset === failAt) throw new Error("Access revoked");
    return wrap({ id, assetId: asset, version, offset, size, mime: "video/mp4", maxRead, content: Buffer.from(bytes.subarray(offset, offset + count)).toString("base64") });
  };
  const api: TransferApi = { begin: forbidden, checkpoint: forbidden, range };
  const blob = await readAttachment(api, id, { id: asset, size, mime: "video/mp4" }, "submission", signal());
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
  assert.deepEqual(calls[0], { offset: 0, count: 1024 * 1024, version: undefined });
  assert.ok(calls.slice(1).every(call => call.version === version && call.count <= maxRead));
  assert.equal(calls.length, 5);
  assert.ok(peak > 1);
  calls.length = 0; failAt = 1024 * 1024 + maxRead;
  await assert.rejects(readAttachment(api, id, { id: asset, size, mime: "video/mp4" }, "submission", signal()), /revoked/);
  assert.throws(() => parseVideoRange(wrap({ id, assetId: asset, version, offset: 0, size: 3, mime: "video/mp4", maxRead: 3, content: btoa("abc") }), id, asset, 0, 3, 3), /Unconfirmed/);
});
test("storage marker is accepted only for uploaded attachments", () => {
  const item = { id: asset, sessionId: asset, kind: "attachment", name: "deck.pdf", mime: "application/pdf", size: 3, received: 3, nextBlock: 1, complete: true, storage: "blob" };
  const state = { id, rowVersion: "10", sessionId: null, blockSize: 524288, media: [item] };
  assert.equal(parseMedia(wrap(state)).media[0].storage, "blob");
  for (const patch of [{ storage: "dataverse" }, { kind: "image", mime: "image/png" }, { storage: "https://account.blob.core.windows.net/media" }])
    assert.throws(() => parseMedia(wrap({ ...state, media: [{ ...item, ...patch }] })), /storage/);
});

function adapterFixture(provider: MediaProvider) {
  const session = "33333333-3333-3333-3333-333333333333";
  const bytes = Uint8Array.from({ length: 24 }, (_value, index) => index);
  const file: VideoFile = { name: "contract.mp4", size: bytes.length, sha256: "a".repeat(64) };
  let version = 1;
  let exists = false;
  let received = 0;
  let complete = false;
  let released = false;
  let fault = "";
  const calls: string[] = [];
  const native = () => provider === "dataverse" ? wrap({ id, rowVersion: String(version), sessionId: exists ? session : null, blockSize: 4194304, uploadProtocol: 2,
    media: exists ? [{ id: asset, sessionId: session, kind: "attachment", name: file.name, mime: "video/mp4", size: file.size,
      received, nextBlock: received ? 1 : 0, complete, caption: "Preserved caption", sortOrder: 2 }] : [] })
    : { id, version: String(version), upload: exists ? { id: session, assetId: asset, ...file, received, nextBlock: received ? 1 : 0, blockSize: 4194304, complete, released,
      scan: complete ? { engine: "simulated", status: released ? "passed" : "pending", attempts: released ? 1 : 0, job: null } : null } : null };
  const invoke = async (action: string, input: Record<string, unknown>, content?: Uint8Array): Promise<unknown> => {
    calls.push(action);
    if (fault === "hang") return new Promise(() => {});
    if (fault === "deny") throw Object.assign(new Error("Denied"), { status: 403 });
    if (fault === "malformed") return { id: asset };
    if (action !== "read" && action !== "range" && input.version !== String(version)) throw Object.assign(new Error("Stale"), { status: 409 });
    if (["begin", "checkpoint"].includes(action)) {
      assert.equal(input.name, file.name); assert.equal(input.size, file.size);
      if (input.sha256 !== file.sha256) throw Object.assign(new Error("Wrong digest"), { status: 409 });
    }
    if (["checkpoint", "block", "finish", "remove"].includes(action)) assert.equal(input.session, session);
    if (action === "begin") { exists = true; version++; }
    if (action === "block") {
      assert.equal(input.index, 0); assert.deepEqual(content, bytes);
      received = bytes.length; version++;
      if (fault === "lost-block") throw new Error("Committed but response lost");
      if (provider === "dataverse") return wrap({ id, rowVersion: String(version), sessionId: session, blockSize: 4194304, uploadProgress: true, received, nextBlock: 1 });
    }
    if (action === "finish") { complete = true; released = provider === "dataverse"; version++; }
    if (action === "remove") { exists = false; version++; }
    if (action === "range") {
      if (!complete || !released) throw Object.assign(new Error("Quarantined"), { status: 403 });
      assert.equal(input.assetId, asset); assert.equal(input.mode, "present"); assert.equal(input.offset, 0); assert.equal(input.count, 24);
      const content = fault === "short-range" ? bytes.subarray(0, 23) : bytes;
      if (provider === "dataverse") return wrap({ id, assetId: asset, mime: "video/mp4", version: `${version}:1:${"a".repeat(32)}`, offset: 0, size: 24,
        content: btoa(String.fromCharCode(...content)) });
      return new Response(content, { headers: { "Content-Type": "application/octet-stream", "Content-Length": "24", "X-Media-Size": "24",
        "X-Media-Offset": "0", "X-Media-Version": `${version}:${asset}` } });
    }
    return native();
  };
  const forbidden = async () => { throw new Error("Unexpected legacy upload or metadata operation"); };
  const adapter = provider === "dataverse" ? createDataverseMediaAdapter({
    read: id => invoke("read", { id }), begin: forbidden, metadata: forbidden,
    block: (id, version, session, index, content) => invoke("block", { id, version, session, index }, Uint8Array.from(atob(content), char => char.charCodeAt(0))),
    finish: (id, version, session) => invoke("finish", { id, version, session }), remove: (id, version, session) => invoke("remove", { id, version, session }),
  }, {
    begin: (id, version, name, size, sha256) => invoke("begin", { id, version, name, size, sha256 }),
    checkpoint: (id, version, session, name, size, sha256) => invoke("checkpoint", { id, version, session, name, size, sha256 }),
    range: (id, assetId, mode, offset, count, version) => invoke("range", { id, assetId, mode, offset, count, version }),
  }) : createLocalMediaAdapter({ command: (action, input) => invoke(action, input), block: (input, bytes) => invoke("block", input, bytes),
    range: async input => await invoke("range", input) as Response });
  return { adapter, file, bytes, session, calls, native, fault: (value: string) => { fault = value; }, release: () => { released = true; version++; } };
}

for (const provider of ["dataverse", "local-blob"] as const) {
  test(`${provider} common contract: begin, resume, bytes, readiness, pinned reads and removal`, async () => {
    const fixture = adapterFixture(provider);
    const { adapter, file, bytes, session } = fixture;
    let state = await adapter.read(id, signal());
    assert.deepEqual(state.media, []);
    state = await adapter.begin(state, file, signal());
    assert.equal(state.provider, provider); assert.equal(state.media[0].readiness, "uploading");
    state = await adapter.checkpoint(state, session, file, signal());
    state = await adapter.block(state, session, 0, bytes, signal());
    const confirmed = state;
    state = await adapter.checkpoint(state, session, file, signal());
    assert.deepEqual(state, confirmed);
    assert.equal(fixture.calls.filter(call => call === "begin").length, 1);
    assert.equal(fixture.calls.filter(call => call === "block").length, 1);
    state = await adapter.finish(state, session, signal());
    assert.equal(state.media[0].complete, true);
    const range = { id, assetId: asset, mode: "present" as const, offset: 0, size: 24 };
    if (provider === "local-blob") {
      assert.equal(state.media[0].readiness, "quarantined");
      assert.equal(state.media[0].integrity, "sha256");
      await assert.rejects(adapter.range(range, signal()), { code: "denied" });
      fixture.release(); state = await adapter.read(id, signal());
      assert.equal(state.media[0].scanning, "simulated-passed");
    } else {
      assert.equal(state.media[0].scanning, "unreported");
      assert.equal(state.media[0].integrity, "unreported");
      assert.equal(state.media[0].caption, "Preserved caption");
      assert.equal(state.media[0].sortOrder, 2);
    }
    assert.equal(state.media[0].readiness, "ready");
    const first = await adapter.range(range, signal());
    assert.deepEqual(first.bytes, bytes);
    assert.deepEqual((await adapter.range({ ...range, version: first.version }, signal())).bytes, bytes);
    await assert.rejects(adapter.range({ ...range, version: "obsolete-version" }, signal()), { code: "invalid-response" });
    fixture.fault("short-range");
    await assert.rejects(adapter.range(range, signal()), { code: "invalid-response" });
    fixture.fault("");
    state = await adapter.remove(state, session, signal());
    assert.deepEqual(state.media, []);
  });

  test(`${provider} common contract: stale and ambiguous writes require reopen, never blind replay`, async () => {
    const fixture = adapterFixture(provider);
    const { adapter, file, bytes, session } = fixture;
    let state = await adapter.begin({ id, version: "1" }, file, signal());
    await assert.rejects(adapter.finish({ id, version: "1" }, session, signal()), { code: "conflict", recovery: "reopen" });
    await assert.rejects(adapter.checkpoint(state, session, { ...file, sha256: "b".repeat(64) }, signal()), { code: "conflict" });
    const calls = fixture.calls.length;
    await assert.rejects(adapter.block({ ...state, provider: provider === "dataverse" ? "local-blob" : "dataverse" }, session, 0, bytes, signal()), { code: "unsupported" });
    assert.equal(fixture.calls.length, calls);
    fixture.fault("lost-block");
    await assert.rejects(adapter.block(state, session, 0, bytes, signal()), { code: "unavailable", recovery: "reopen" });
    assert.equal(fixture.calls.filter(call => call === "block").length, 1);
    fixture.fault("");
    state = await adapter.read(id, signal());
    assert.equal(state.media[0].received, 24);
    assert.equal(state.media[0].nextBlock, 1);
  });

  test(`${provider} common contract: denial, malformed data and cancellation never fall back`, async () => {
    const fixture = adapterFixture(provider);
    fixture.fault("deny");
    await assert.rejects(fixture.adapter.read(id, signal()), { code: "denied", recovery: "none" });
    assert.deepEqual(fixture.calls, ["read"]);
    fixture.fault("malformed");
    await assert.rejects(fixture.adapter.read(id, signal()), { code: "invalid-response" });
    fixture.fault("hang");
    const controller = new AbortController();
    const pending = fixture.adapter.read(id, controller.signal); controller.abort();
    await assert.rejects(pending, { code: "aborted" });
    assert.equal(fixture.calls.length, 3);
    await assert.rejects(fixture.adapter.begin({ id, version: "1" }, fixture.file, controller.signal), { code: "aborted", recovery: "none" });
    assert.equal(fixture.calls.length, 3);
  });
}

test("local common contract rejects unconfirmed release and keeps rejected media distinct from incomplete uploads", async () => {
  const fixture = adapterFixture("local-blob");
  let state = await fixture.adapter.begin({ id, version: "1" }, fixture.file, signal());
  state = await fixture.adapter.block(state, fixture.session, 0, fixture.bytes, signal());
  await fixture.adapter.finish(state, fixture.session, signal());
  const raw = fixture.native() as { upload: { released: boolean; scan: { status: string; attempts: number } } };
  raw.upload.released = true;
  assert.throws(() => localMediaSnapshot(raw), MediaContractError);
  raw.upload.released = false; raw.upload.scan.status = "rejected"; raw.upload.scan.attempts = 1;
  const rejected = localMediaSnapshot(raw).media[0];
  assert.equal(rejected.complete, true); assert.equal(rejected.readiness, "rejected");
});

test("local attachment adapter binds document MIME, resumes counters and retains quarantine", async () => {
  for (const [extension, mime] of [["html", "text/html"], ["htm", "text/html"], ["pdf", "application/pdf"],
    ["ppt", "application/vnd.ms-powerpoint"], ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]]) {
    const fixture = adapterFixture("local-blob");
    fixture.file.name = `fixture.${extension}`;
    let version = "1";
    const session = fixture.session;
    let received = 0;
    let complete = false;
    const snapshot = () => ({ id, version, upload: { id: session, assetId: asset, ...fixture.file, mime, received,
      nextBlock: received ? 1 : 0, blockSize: 4194304, complete, released: false,
      scan: complete ? { engine: "simulated", status: "pending", attempts: 0 } : null } });
    const adapter = createLocalMediaAdapter({
      command: async action => {
        if (action === "begin" || action === "finish") version = String(Number(version) + 1);
        if (action === "finish") complete = true;
        return snapshot();
      },
      block: async (_input, bytes) => { received = bytes.length; version = String(Number(version) + 1); return snapshot(); },
      range: async () => new Response(null, { status: 403 }),
    });
    let state = await adapter.begin({ id, version }, fixture.file, signal());
    assert.equal(state.media[0].mime, mime);
    state = await adapter.checkpoint(state, session, fixture.file, signal());
    state = await adapter.block(state, session, 0, fixture.bytes, signal());
    state = await adapter.finish(state, session, signal());
    assert.equal(state.media[0].readiness, "quarantined");
    assert.throws(() => localMediaSnapshot({ ...snapshot(), upload: { ...snapshot().upload, mime: "video/mp4" } }), /MIME/);
    await assert.rejects(adapter.begin({ id, version }, { ...fixture.file, size: 25 * 1024 * 1024 + 1 }, signal()), { code: "invalid-request" });
  }
});