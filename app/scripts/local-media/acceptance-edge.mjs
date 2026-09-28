import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fork, execFile } from "node:child_process";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import { chromium } from "playwright-core";
import ffmpeg from "ffmpeg-static";
import { PDFDocument } from "pdf-lib";
import PptxGenJS from "pptxgenjs";
import CFB from "cfb";

const { values } = parseArgs({ strict: true, options: { output: { type: "string" }, headless: { type: "boolean" }, attachments: { type: "boolean" }, help: { type: "boolean" } } });
if (values.help) {
  console.log("Usage: npm run test:media:edge -- [--output <new-directory>] [--headless] [--attachments]");
  console.log("Runs installed Microsoft Edge (headed by default), synthetic media and an isolated Azurite lab. No cloud access. Retains local evidence.");
  process.exit(0);
}
const directory = values.output ? resolve(values.output) : await mkdtemp(join(tmpdir(), "prisma-edge-acceptance-"));
if (values.output) await mkdir(directory);
const log = createWriteStream(join(directory, "lab.log"), { flags: "wx" });
const report = { ok: false, mode: values.headless ? "headless-edge" : "headed-edge", steps: [],
  scope: "Synthetic fixtures and simulated actors only. Not Entra/Dataverse authorization, audible output, maximum-size acceptance or Azure integration." };
let browser;
let context;
let page;
let child;
let url;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const step = name => { report.steps.push(name); console.log(`PASS ${name}`); };

async function startLab() {
  child = fork(new URL("./dev.mjs", import.meta.url), ["--data-dir", join(directory, "workspace")], { stdio: ["ignore", "pipe", "pipe", "ipc"] });
  child.stdout.on("data", chunk => log.write(chunk));
  child.stderr.on("data", chunk => log.write(chunk));
  const current = child;
  url = await new Promise((resolveReady, reject) => {
    const deadline = setTimeout(() => reject(new Error("Lab startup timed out.")), 45000);
    current.once("error", error => { clearTimeout(deadline); reject(error); });
    current.once("exit", code => { clearTimeout(deadline); reject(new Error(`Lab exited before readiness (${code}).`)); });
    current.on("message", message => {
      if (message.event !== "ready") return;
      clearTimeout(deadline);
      if (!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(message.url)) reject(new Error("Non-loopback lab refused."));
      else resolveReady(message.url);
    });
  });
}

async function stopLab() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const current = child;
  const exited = once(current, "exit");
  const deadline = setTimeout(() => current.kill(), 20000);
  try {
    if (current.connected) current.send("shutdown"); else current.kill();
    const [code] = await exited;
    assert.equal(code, 0, "Lab must flush and shut down cleanly.");
  } finally { clearTimeout(deadline); child = null; }
}

async function request(actor, action, input) {
  return context.request.post(`${url}api/local-media/${action}`, { headers: {
    Origin: new URL(url).origin, "X-Prisma-Local": "1", "X-Local-Actor": actor,
  }, data: input, timeout: 15000 });
}

async function command(actor, action, input = {}) {
  const response = await request(actor, action, input);
  assert.equal(response.status(), 200, `${action}: ${await response.text()}`);
  return response.json();
}

async function readyVideo() {
  await page.waitForFunction(() => { const video = document.querySelector("video"); return video && video.readyState >= 2 && !video.error; }, null, { timeout: 30000 });
}

async function seek(seconds) {
  await page.locator("video").evaluate((video, time) => { video.pause(); video.currentTime = time; }, seconds);
  await page.waitForFunction(time => {
    const video = document.querySelector("video");
    return video && !video.seeking && Math.abs(video.currentTime - time) < 0.25 && video.readyState >= 2;
  }, seconds, { timeout: 15000 });
  const pixels = await page.locator("video").evaluate(video => {
    const canvas = document.createElement("canvas"); canvas.width = 160; canvas.height = 90;
    const drawing = canvas.getContext("2d"); drawing.drawImage(video, 0, 0, 160, 90);
    const data = drawing.getImageData(0, 0, 160, 90).data;
    const colors = new Set();
    for (let offset = 0; offset < data.length; offset += 16) colors.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`);
    return { colors: colors.size, width: video.videoWidth, height: video.videoHeight };
  });
  assert.ok(pixels.colors > 16, "Decoded video must contain nonblank fixture pixels.");
  assert.deepEqual([pixels.width, pixels.height], [640, 360]);
}

async function capture(name, width, height) {
  await page.setViewportSize({ width, height });
  const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
    videoWidth: document.querySelector("video")?.getBoundingClientRect().width ?? 0 }));
  assert.ok(layout.content <= layout.width + 1, `${name}: horizontal overflow`);
  assert.ok(layout.videoWidth > 0 && layout.videoWidth <= width, `${name}: player not framed`);
  await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
}

async function attachmentAcceptance() {
  const pdf = await PDFDocument.create();
  pdf.addPage([640, 360]).drawText("PRISMA synthetic document fixture", { x: 30, y: 280, size: 24 });
  const presentation = new PptxGenJS(); presentation.layout = "LAYOUT_WIDE";
  presentation.addSlide().addText("PRISMA synthetic slide fixture", { x: 0.5, y: 0.5, w: 10, h: 1, fontSize: 24 });
  const pptx = join(directory, "attachment.pptx");
  await presentation.writeFile({ fileName: pptx });
  const compound = CFB.utils.cfb_new();
  CFB.utils.cfb_add(compound, "PowerPoint Document", Buffer.from("Synthetic container for download-only acceptance; not an Office rendering fixture."));
  const html = Buffer.from(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src * data: 'unsafe-inline'"><title>HTML fixture</title>
    <style>body{font-family:sans-serif;padding:24px;background:#eaf7f0;color:#18303c}button{padding:12px}img{width:32px;height:32px}</style></head>
    <body><h1>Local HTML fixture</h1><button id="increment">Increment</button><output id="count">0</output>
    <img alt="Embedded fixture pixel" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6kAAAAASUVORK5CYII=">
    <script>
      let count=0; document.getElementById('increment').onclick=()=>{document.getElementById('count').textContent=String(++count)};
      try { parent.document.body.dataset.sandboxEscape='unexpected'; document.body.dataset.parent='escaped'; } catch { document.body.dataset.parent='blocked'; }
      try { localStorage.setItem('sandboxEscape','unexpected'); document.body.dataset.storage='escaped'; } catch { document.body.dataset.storage='blocked'; }
      fetch('${url}sandbox-probe').then(()=>{document.body.dataset.network='escaped'}).catch(()=>{document.body.dataset.network='blocked'});
    </script></body></html>`);
  const fixtures = [{ name: "attachment.html", bytes: html }, { name: "attachment.pdf", bytes: Buffer.from(await pdf.save()) },
    { name: "attachment.pptx", bytes: await readFile(pptx) }, { name: "attachment.ppt", bytes: Buffer.from(CFB.write(compound, { type: "buffer" })) }];
  let networkEscapes = 0;
  await context.route("**/sandbox-probe", async route => { networkEscapes++; await route.fulfill({ status: 200, body: "Unexpected network access" }); });
  report.attachments = [];
  for (const fixture of fixtures) {
    await page.bringToFront();
    const path = join(directory, fixture.name);
    if (fixture.name !== "attachment.pptx") await writeFile(path, fixture.bytes);
    await page.getByLabel("Simulated identity").selectOption("builder");
    await page.getByRole("button", { name: "New draft", exact: true }).click();
    await page.getByRole("heading", { name: "New attachment draft", exact: true }).waitFor();
    const id = new URL(page.url()).hash.split("/").at(-1);
    await page.getByLabel("Attachment file", { exact: true }).setInputFiles(path);
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await page.getByText("Integrity verified / not malware-scanned", { exact: true }).waitFor();
    const quarantined = await command("builder", "read", { id, mode: "submission" });
    const range = { id, assetId: quarantined.upload.assetId, mode: "present", offset: 0, count: 24 };
    assert.equal((await request("builder", "range", { ...range, mode: "submission" })).status(), 403);
    assert.equal(await page.locator("iframe").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Download", exact: true }).count(), 0);
    await page.getByLabel("Simulated outcome").selectOption("pass");
    await page.getByRole("button", { name: "Run simulated scan", exact: true }).click();
    await page.getByText("Simulated pass / not malware-scanned", { exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Submit for local review", exact: true }).click();
    await page.getByRole("button", { name: `${fixture.name} review / builder`, exact: true }).waitFor();
    await page.getByLabel("Simulated identity").selectOption("librarian");
    await page.getByRole("button", { name: `${fixture.name} review / builder`, exact: true }).click();
    await page.getByLabel("Non-sensitive, client-safe fixture").check();
    await page.getByRole("button", { name: "Publish locally", exact: true }).click();
    await page.getByRole("button", { name: `${fixture.name} published / builder`, exact: true }).waitFor();
    await page.getByLabel("Simulated identity").selectOption("reader");
    await page.getByRole("button", { name: `${fixture.name} published / builder`, exact: true }).click();
    await page.getByRole("region", { name: "Protected attachment", exact: true }).getByText("Ready", { exact: true }).waitFor();
    if (fixture.name.endsWith(".html")) {
      const frame = page.frameLocator(`iframe[title="${fixture.name}"]`);
      await frame.locator('body[data-network="blocked"]').waitFor();
      await frame.getByRole("button", { name: "Increment", exact: true }).click();
      await frame.locator("#count").filter({ hasText: "1" }).waitFor();
      await page.waitForFunction(() => document.body.dataset.sandboxEscape === undefined);
      const frameHandle = await (await page.locator(`iframe[title="${fixture.name}"]`).elementHandle()).contentFrame();
      assert.ok(frameHandle);
      await frameHandle.waitForFunction(() => document.body.dataset.network === "blocked");
      assert.deepEqual(await frameHandle.evaluate(() => ({ parent: document.body.dataset.parent, storage: document.body.dataset.storage })), { parent: "blocked", storage: "blocked" });
      assert.equal(await page.locator("iframe").getAttribute("sandbox"), "allow-scripts");
      assert.equal(await page.locator("iframe").getAttribute("referrerpolicy"), "no-referrer");
      assert.equal(networkEscapes, 0);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
          frame: document.querySelector("iframe").getBoundingClientRect().width }));
        assert.ok(layout.content <= layout.width + 1 && layout.frame > 0 && layout.frame <= width);
        await page.screenshot({ path: join(directory, `html-${width}.png`), fullPage: true });
      }
    } else {
      assert.equal(await page.locator("iframe, object, embed, video").count(), 0);
      await page.screenshot({ path: join(directory, `${fixture.name}.png`), fullPage: true });
    }
    const attempt = { name: fixture.name, ranges: [] };
    report.downloadAttempts ??= []; report.downloadAttempts.push(attempt);
    const recordRange = request => { if (request.url().endsWith("/api/local-media/range")) attempt.ranges.push(request.postDataJSON()); };
    page.on("request", recordRange);
    await page.evaluate(() => {
      window.downloadProbe = [];
      window.downloadProbeHandler = event => {
        const button = event.target.closest?.("button");
        if (button) window.downloadProbe.push({ button: button.textContent, trusted: event.isTrusted });
        if (event.target instanceof HTMLAnchorElement && event.target.download) window.downloadProbe.push({ download: event.target.download, href: event.target.href, trusted: event.isTrusted });
      };
      document.addEventListener("click", window.downloadProbeHandler, true);
    });
    let download;
    try {
      const downloading = page.waitForEvent("download");
      const downloadButton = page.getByRole("button", { name: "Download", exact: true });
      await downloadButton.focus();
      await downloadButton.press("Enter");
      download = await downloading;
    } finally {
      page.off("request", recordRange);
      attempt.events = await page.evaluate(() => {
        document.removeEventListener("click", window.downloadProbeHandler, true);
        return { clicks: window.downloadProbe, focused: document.hasFocus(), state: document.querySelector(".attachment-preview")?.textContent };
      });
    }
    assert.equal(await download.failure(), null);
    assert.equal(download.suggestedFilename(), fixture.name);
    const saved = join(directory, `downloaded-${fixture.name}`); await download.saveAs(saved);
    assert.equal(hash(await readFile(saved)), hash(fixture.bytes));
    const owner = await context.newPage(); await owner.goto(url);
    await owner.getByRole("button", { name: `${fixture.name} published / builder`, exact: true }).click();
    await owner.getByRole("button", { name: "Withdraw locally", exact: true }).click();
    await owner.getByRole("button", { name: `${fixture.name} draft / builder`, exact: true }).waitFor();
    assert.equal((await request("reader", "range", range)).status(), 403);
    await page.bringToFront();
    if (fixture.name.endsWith(".html")) {
      await page.getByText("Access / attachment failed", { exact: true }).waitFor({ timeout: 35000 });
      assert.equal(await page.locator("iframe").count(), 0);
    } else {
      const downloadButton = page.getByRole("button", { name: "Download", exact: true });
      await downloadButton.focus();
      await downloadButton.press("Enter");
      await page.getByText("Access / attachment failed", { exact: true }).waitFor();
    }
    assert.ok(await page.getByRole("button", { name: "Download", exact: true }).isDisabled());
    await owner.close();
    report.attachments.push({ name: fixture.name, size: fixture.bytes.length, sha256: hash(fixture.bytes), downloadExact: true, withdrawalDenied: true });
    step(`${fixture.name}: quarantined upload, protected original download and withdrawal denial`);
  }
  assert.equal(networkEscapes, 0);
  await context.unroute("**/sandbox-probe");
  step("HTML inline interaction works without same-origin storage/parent/network access; preview removed after withdrawal");
}

try {
  console.log(`Evidence directory: ${directory}`);
  browser = await chromium.launch({ channel: "msedge", headless: !!values.headless });
  report.browser = await browser.version();
  context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  report.pageErrors = [];
  report.consoleErrors = [];
  page.on("pageerror", error => report.pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  const fixture = join(directory, "edge-acceptance.mp4");
  const run = promisify(execFile);
  report.ffmpeg = (await run(ffmpeg, ["-version"], { windowsHide: true })).stdout.split("\n")[0];
  await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
    "-t", "16", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "0", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", fixture],
  { windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 });
  const original = await readFile(fixture);
  assert.ok(original.length > 2 * 4194304 && original.length < 30 * 1024 * 1024, "Fixture must span at least three upload blocks.");
  report.fixture = { name: "edge-acceptance.mp4", bytes: original.length, sha256: hash(original) };
  step("generated multi-block MP4/AAC fixture");
  await startLab();
  await page.goto(url);
  await page.getByRole("button", { name: "New draft", exact: true }).click();
  await page.getByRole("heading", { name: "New attachment draft" }).waitFor();
  const id = new URL(page.url()).hash.split("/").at(-1);
  report.draftId = id;
  const blocks = [];
  let dropped = false;
  let routeError;
  await page.route("**/api/local-media/block", async route => {
    try {
      const input = JSON.parse(route.request().headers()["x-local-command"]);
      blocks.push(input.index);
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      if (!dropped) {
        assert.equal((await response.json()).upload.received, 4194304);
        dropped = true;
        await route.abort("failed");
      } else await route.fulfill({ response });
    } catch (error) { routeError = error; await route.abort("failed").catch(() => {}); }
  });
  await page.getByLabel("Attachment file", { exact: true }).setInputFiles(fixture);
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await page.getByText("Writes locked pending Reopen", { exact: true }).waitFor();
  if (routeError) throw routeError;
  assert.ok(dropped);
  await page.getByRole("button", { name: "Reopen", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("progress")?.value === 4194304);
  const checkpoint = await command("builder", "read", { id, mode: "submission" });
  assert.equal(checkpoint.upload.nextBlock, 1);
  assert.equal(checkpoint.upload.complete, false);
  assert.equal((await request("other-builder", "read", { id, mode: "submission" })).status(), 403);
  step("lost committed response requires reopen; cross-owner draft denied");
  await stopLab();
  await startLab();
  await page.goto(url);
  await page.getByRole("button", { name: "edge-acceptance.mp4 draft / builder", exact: true }).click();
  const reopened = await command("builder", "read", { id, mode: "submission" });
  assert.deepEqual(reopened, checkpoint);
  await page.getByLabel("Attachment file", { exact: true }).setInputFiles(fixture);
  await page.getByRole("button", { name: "Resume upload", exact: true }).click();
  await page.getByText("Integrity verified / not malware-scanned", { exact: true }).waitFor({ timeout: 30000 });
  if (routeError) throw routeError;
  assert.deepEqual(blocks, Array.from({ length: Math.ceil(original.length / 4194304) }, (_value, index) => index));
  await page.unroute("**/api/local-media/block");
  const finished = await command("builder", "read", { id, mode: "submission" });
  assert.equal(finished.upload.sha256, report.fixture.sha256);
  assert.equal(finished.upload.complete, true);
  assert.equal(finished.upload.released, false);
  const range = { id, assetId: finished.upload.assetId, mode: "submission", offset: 0, count: 24 };
  assert.equal((await request("builder", "range", range)).status(), 403);
  assert.equal(await page.locator("video").count(), 0);
  assert.ok(await page.getByRole("button", { name: "Submit for local review" }).isDisabled());
  step("full lab restart and exact resume without block replay; quarantine denies bytes");
  await page.getByLabel("Simulated outcome").selectOption("pass");
  await page.getByRole("button", { name: "Run simulated scan", exact: true }).click();
  await page.getByText("Simulated pass / not malware-scanned", { exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Submit for local review" }).click();
  await page.getByRole("button", { name: "edge-acceptance.mp4 review / builder", exact: true }).waitFor();
  await page.getByLabel("Simulated identity").selectOption("librarian");
  await page.getByRole("button", { name: "edge-acceptance.mp4 review / builder", exact: true }).click();
  await page.getByLabel("Non-sensitive, client-safe fixture").check();
  await page.getByRole("button", { name: "Publish locally", exact: true }).click();
  await page.getByRole("button", { name: "edge-acceptance.mp4 published / builder", exact: true }).waitFor();
  await page.getByLabel("Simulated identity").selectOption("reader");
  await page.getByRole("button", { name: "edge-acceptance.mp4 published / builder", exact: true }).click();
  await readyVideo();
  assert.equal(await page.getByRole("combobox", { name: /Read mode/ }).inputValue(), "present");
  step("background scan, review and publication enable CSM present playback");
  await page.locator("video").evaluate(async video => { video.muted = true; video.currentTime = 0; video.playbackRate = 1; await video.play(); });
  await page.waitForFunction(() => document.querySelector("video")?.ended, null, { timeout: 35000 });
  report.playback = await page.locator("video").evaluate(video => ({ ended: video.ended, time: video.currentTime, duration: video.duration,
    readyState: video.readyState, width: video.videoWidth, height: video.videoHeight, muted: video.muted, error: video.error?.message ?? null }));
  assert.ok(report.playback.duration >= 15.9 && report.playback.duration <= 16.2);
  assert.equal(report.playback.error, null);
  await seek(5);
  await capture("desktop", 1280, 900);
  await seek(2);
  await capture("mobile", 390, 844);
  step("normal-speed playback reaches end; forward/backward seeks decode nonblank pixels on desktop/mobile");
  const downloaded = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const download = await downloaded;
  assert.equal(await download.failure(), null);
  assert.equal(download.suggestedFilename(), "edge-acceptance.mp4");
  const saved = join(directory, "downloaded.mp4");
  await download.saveAs(saved);
  report.downloadSha256 = hash(await readFile(saved));
  assert.equal(report.downloadSha256, report.fixture.sha256);
  step("browser download through protected ranges matches original SHA-256");
  await page.locator("video").evaluate(async video => { video.currentTime = 1; await video.play(); });
  const owner = await context.newPage();
  await owner.goto(url);
  await owner.getByRole("button", { name: "edge-acceptance.mp4 published / builder", exact: true }).click();
  await owner.getByRole("button", { name: "Withdraw locally", exact: true }).click();
  await owner.getByRole("button", { name: "edge-acceptance.mp4 draft / builder", exact: true }).waitFor();
  assert.equal((await request("reader", "range", { ...range, mode: "present" })).status(), 403);
  assert.ok(!(await command("reader", "list")).some(draft => draft.id === id));
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video && !video.getAttribute("src") && video.readyState === 0 && video.paused;
  }, null, { timeout: 35000 });
  await page.getByText("Access / playback failed", { exact: true }).waitFor();
  assert.ok(await page.getByRole("button", { name: "Download", exact: true }).isDisabled());
  await page.screenshot({ path: join(directory, "withdrawn.png"), fullPage: true });
  step("withdrawal denies new reads, removes catalogue entry and clears the open player on heartbeat");
  if (values.attachments) await attachmentAcceptance();
  assert.deepEqual(report.pageErrors, []);
  report.ok = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  if (page && !page.isClosed()) {
    report.framesAtFailure = await Promise.all(page.frames().filter(frame => frame !== page.mainFrame()).map(async frame => ({
      url: frame.url(), state: await frame.evaluate(() => ({ text: document.body?.innerText, dataset: { ...document.body?.dataset },
        scripts: document.scripts.length, handler: typeof document.getElementById("increment")?.onclick })).catch(() => null),
    })));
    report.playerAtFailure = await page.locator("video").evaluateAll(videos => videos.map(video => ({ time: video.currentTime, duration: video.duration,
      paused: video.paused, readyState: video.readyState, error: video.error?.message ?? null }))).catch(() => null);
    await page.screenshot({ path: join(directory, "failure.png"), fullPage: true }).catch(() => {});
  }
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await context?.close();
  await browser?.close();
  try { await stopLab(); }
  catch (error) { report.ok = false; report.shutdownError = error.message; process.exitCode = 1; }
  await new Promise(resolveClosed => log.end(resolveClosed));
  await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, directory, steps: report.steps, error: report.error, shutdownError: report.shutdownError }, null, 2));
}