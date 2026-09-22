import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareVideo, shouldCompressVideo, VIDEO_COMPRESSION_THRESHOLD, VIDEO_SIZE_LIMIT, type VideoEncoder } from "./videoCompression.ts";

const large = { name: "recording.mp4", size: VIDEO_COMPRESSION_THRESHOLD } as File;
test("video compression starts at 200 MiB and preserves the existing 500 MiB cap", () => {
  assert.equal(shouldCompressVideo({ ...large, size: VIDEO_COMPRESSION_THRESHOLD - 1 }), false);
  assert.equal(shouldCompressVideo(large), true);
  assert.equal(shouldCompressVideo({ name: "recording.WEBM", size: VIDEO_SIZE_LIMIT }), true);
  assert.equal(shouldCompressVideo({ ...large, size: VIDEO_SIZE_LIMIT + 1 }), false);
  assert.equal(shouldCompressVideo({ ...large, name: "slides.pptx" }), false);
});
test("small videos and non-video attachments never invoke the encoder", async () => {
  const encode: VideoEncoder = async () => { throw new Error("Unexpected encoder"); };
  const file = new File(["small"], "recording.mp4", { type: "video/mp4" });
  const result = await prepareVideo(file, new AbortController().signal, () => {}, encode);
  assert.equal(result.file, file);
  assert.equal(result.outcome, "unchanged");
});
test("only smaller valid candidates replace the selected video", async () => {
  const candidate = new File(["encoded"], "recording.mp4", { type: "video/mp4" });
  const result = await prepareVideo(large, new AbortController().signal, () => {}, async () => candidate);
  assert.equal(result.file, candidate);
  assert.equal(result.outcome, "compressed");
  const unchanged = await prepareVideo(large, new AbortController().signal, () => {}, async () => ({ ...large, type: "video/mp4" }) as File);
  assert.equal(unchanged.file, large);
  assert.equal(unchanged.outcome, "not-smaller");
  await assert.rejects(prepareVideo(large, new AbortController().signal, () => {}, async () => new File([], "empty.mp4", { type: "video/mp4" })), /valid MP4/);
});
test("encoder failure and cancellation never silently continue to upload", async () => {
  await assert.rejects(prepareVideo(large, new AbortController().signal, () => {}, async () => { throw new Error("Encoder unavailable"); }), /unavailable/);
  const controller = new AbortController();
  await assert.rejects(prepareVideo(large, controller.signal, () => {}, async () => {
    controller.abort();
    return new File(["encoded"], "recording.mp4", { type: "video/mp4" });
  }), { name: "AbortError" });
});