import assert from "node:assert/strict";
import { test } from "node:test";
import { fileDigest, transferVideo, readVideoRange, type TransferApi } from "./mediaTransfer.ts";
import type { MediaApi, MediaState } from "./media.ts";
import { bufferedAhead } from "./videoStream.ts";
import { captionsVtt, decodeCaption } from "./mp4Captions.ts";
const id = "11111111-1111-1111-1111-111111111111";
const asset = "22222222-2222-2222-2222-222222222222";
const wrap = (value: unknown) => ({ success: true, data: { ResultJson: JSON.stringify(value) } });
const signal = () => new AbortController().signal;
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