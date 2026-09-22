import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const [toolsPath, browserPath, largeVideoPath] = process.argv.slice(2);
if (!toolsPath || !browserPath) throw new Error("Usage: node scripts/verify-video-browser.mjs <temporary-tools-directory> <browser-executable>");
const { chromium } = createRequire(join(resolve(toolsPath), "package.json"))("playwright-core");
const browser = await chromium.launch({ executablePath: resolve(browserPath), headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const results = [];
try {
  await page.goto("http://localhost:5174");
  for (const name of ["prisma-browser-compression-probe.mp4", "prisma-video-acceptance.webm"]) {
    await page.evaluate(() => {
      const host = document.createElement("section"); host.id = "codec-test";
      host.style.cssText = "position:fixed;inset:0;background:white;z-index:99999";
      const input = document.createElement("input"); input.type = "file";
      const video = document.createElement("video"); video.controls = true; video.muted = true; video.style.width = "640px";
      host.append(input, video); document.body.append(host);
    });
    await page.locator("#codec-test input").setInputFiles(join(tmpdir(), name));
    await page.locator("#codec-test").evaluate(host => { host.querySelector("video").src = URL.createObjectURL(host.querySelector("input").files[0]); });
    await page.waitForFunction(() => document.querySelector("#codec-test video").readyState >= 2 || document.querySelector("#codec-test video").error, null, { timeout: 15000 });
    const metadata = await page.locator("#codec-test video").evaluate(video => ({ ready: video.readyState, width: video.videoWidth, error: video.error?.message }));
    assert.equal(metadata.error, undefined, name);
    await page.locator("#codec-test video").evaluate(video => video.play());
    await page.waitForFunction(() => document.querySelector("#codec-test video").ended, null, { timeout: 10000 });
    const downloaded = page.waitForEvent("download");
    await page.locator("#codec-test").evaluate(host => {
      const anchor = document.createElement("a"); anchor.href = host.querySelector("video").src; anchor.download = host.querySelector("input").files[0].name;
      host.append(anchor); anchor.click(); anchor.remove();
    });
    const download = await downloaded;
    const hash = bytes => createHash("sha256").update(bytes).digest("hex");
    assert.equal(hash(await readFile(await download.path())), hash(await readFile(join(tmpdir(), name))));
    results.push({ name, native: metadata, ended: true, downloadChecksum: true });
    await page.locator("#codec-test").evaluate(host => { const video = host.querySelector("video"); URL.revokeObjectURL(video.src); video.pause(); video.removeAttribute("src"); video.load(); host.remove(); });
  }
  await page.evaluate(() => { const input = document.createElement("input"); input.type = "file"; input.id = "stream-file"; document.body.append(input); });
  await page.locator("#stream-file").setInputFiles(join(tmpdir(), "prisma-browser-compression-probe.mp4"));
  await page.locator("#stream-file").evaluate(async input => {
    const { streamVideo } = await import("/src/videoStream.ts");
    const file = input.files[0]; const video = document.createElement("video"); video.controls = true; video.muted = true; document.body.append(video);
    const controller = new AbortController(); window.streamTest = { video, controller, error: null };
    void streamVideo(video, file.size, async offset => new Uint8Array(await file.slice(offset, offset + 1048576).arrayBuffer()), controller.signal)
      .catch(error => { if (!controller.signal.aborted) window.streamTest.error = String(error); });
  });
  await page.waitForFunction(() => window.streamTest.video.readyState >= 2 || window.streamTest.error, null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.streamTest.error), null);
  await page.evaluate(() => window.streamTest.video.play());
  await page.waitForFunction(() => window.streamTest.video.ended, null, { timeout: 10000 });
  results.push({ progressiveMp4WithAudio: true, ended: true });
  await page.evaluate(() => { window.streamTest.controller.abort(); window.streamTest.video.remove(); delete window.streamTest; });
  await page.locator("#stream-file").setInputFiles(join(tmpdir(), "prisma-video-captions.mp4"));
  const captions = await page.locator("#stream-file").evaluate(async input => {
    const { extractMp4Captions } = await import("/src/mp4Captions.ts");
    return extractMp4Captions(input.files[0], new AbortController().signal);
  });
  assert.equal(captions[0].cues.length, 2);
  results.push({ captionExtraction: true, cues: captions[0].cues });
  if (largeVideoPath) {
    await page.locator("#stream-file").setInputFiles(resolve(largeVideoPath));
    await page.locator("#stream-file").evaluate(async input => {
      const { streamVideo } = await import("/src/videoStream.ts");
      const file = input.files[0]; const video = document.createElement("video"); video.controls = true; video.muted = true;
      document.body.append(video);
      const controller = new AbortController();
      window.streamTest = { video, controller, error: null, bytes: 0, reads: 0, started: performance.now() };
      void streamVideo(video, file.size, async offset => {
        const bytes = new Uint8Array(await file.slice(offset, offset + 1048576).arrayBuffer());
        window.streamTest.bytes += bytes.length; window.streamTest.reads++; return bytes;
      }, controller.signal).catch(error => { if (!controller.signal.aborted) window.streamTest.error = String(error); });
    });
    await page.waitForFunction(() => window.streamTest.video.readyState >= 2 || window.streamTest.error, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => window.streamTest.error), null);
    await page.evaluate(() => { window.streamTest.video.playbackRate = 4; return window.streamTest.video.play(); });
    await page.waitForFunction(() => window.streamTest.video.ended || window.streamTest.error, null, { timeout: 120000 }).catch(async error => {
      console.error(JSON.stringify(await page.evaluate(() => ({ time: window.streamTest.video.currentTime, ready: window.streamTest.video.readyState,
        paused: window.streamTest.video.paused, duration: window.streamTest.video.duration, error: window.streamTest.error,
        reads: window.streamTest.reads, bytes: window.streamTest.bytes,
        buffered: Array.from({ length: window.streamTest.video.buffered.length }, (_, index) => [window.streamTest.video.buffered.start(index), window.streamTest.video.buffered.end(index)]) }))));
      throw error;
    });
    const playback = await page.evaluate(() => ({ ended: window.streamTest.video.ended, time: window.streamTest.video.currentTime,
      duration: window.streamTest.video.duration, error: window.streamTest.error, reads: window.streamTest.reads, bytesRead: window.streamTest.bytes,
      elapsedMs: performance.now() - window.streamTest.started, playbackRate: window.streamTest.video.playbackRate }));
    assert.equal(playback.error, null); assert.equal(playback.ended, true);
    results.push({ largeProgressivePlayback: playback });
    await page.evaluate(() => { window.streamTest.controller.abort(); window.streamTest.video.remove(); delete window.streamTest; });
  }
  console.log(JSON.stringify({ browser: await browser.version(), results, scope: "Isolated local fixtures; no Dataverse login or remote permission claims. Audio decode tested muted, not audible output." }, null, 2));
} finally { await context.close(); await browser.close(); }