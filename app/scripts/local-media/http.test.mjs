import test from "node:test";
import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { once } from "node:events";
import { mediaHandler } from "./http.mjs";
import { LocalMediaService } from "./service.mjs";
import { randomUUID } from "node:crypto";
import { runScanOnce, SCAN_RETRY_DELAY } from "./scanner.mjs";
import { fork } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("browser acceptance launcher announces loopback readiness and shuts down through IPC", { timeout: 45000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "prisma-browser-launcher-"));
  const child = fork(new URL("./dev.mjs", import.meta.url), ["--data-dir", directory], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
  let errors = "";
  child.stderr.on("data", chunk => { errors += chunk; });
  const exited = once(child, "exit");
  try {
    const ready = new Promise((resolve, reject) => {
      child.on("message", message => { if (message.event === "ready") resolve(message); });
      child.once("error", reject);
      child.once("exit", () => reject(new Error(`Launcher exited before readiness: ${errors}`)));
    });
    const { url } = await ready;
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    assert.equal((await fetch(url)).status, 200);
    child.send("shutdown");
    assert.deepEqual(await exited, [0, null], errors);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.disconnect(); await exited; }
    await rm(directory, { recursive: true, force: true });
  }
});

test("HTTP boundary rejects foreign origins, forged hosts, missing markers and malformed requests", async () => {
  const server = createServer(mediaHandler(new LocalMediaService({})));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = { origin, "x-prisma-local": "1", "x-local-actor": "builder", "content-type": "application/json" };
  try {
    const call = (overrides = {}, payload = "{}", method = "POST", action = "create") => fetch(`${origin}/api/local-media/${action}`, { method, headers: { ...headers, ...overrides }, ...(method === "POST" ? { body: payload } : {}) });
    assert.equal((await call()).status, 200);
    assert.equal((await call({ origin: "https://foreign.example" })).status, 403);
    const forgedHostStatus = await new Promise((resolve, reject) => {
      const request = httpRequest(`${origin}/api/local-media/create`, { method: "POST", headers: { ...headers, host: "foreign.example" } }, response => {
        response.resume(); resolve(response.statusCode);
      });
      request.on("error", reject); request.end("{}");
    });
    assert.equal(forgedHostStatus, 403);
    assert.equal((await call({ "x-prisma-local": "" })).status, 403);
    assert.equal((await call({ "x-local-actor": "unknown" })).status, 401);
    assert.equal((await call({}, "not-json")).status, 400);
    assert.equal((await call({}, "null")).status, 400);
    assert.equal((await call({ "content-type": "text/plain" })).status, 415);
    assert.equal((await call({}, "{}", "GET")).status, 405);
    assert.equal((await call({}, "{}", "POST", "no-such-action")).status, 404);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test("HTTP scan endpoint retains quarantine through outages and releases only an explicit simulated pass", async () => {
  let clock = Date.now();
  const service = new LocalMediaService({ read: async (_id, _offset, count) => Buffer.alloc(count) }, () => clock);
  let draft = await service.execute("builder", "create");
  const upload = { id: randomUUID(), assetId: randomUUID(), name: "http.mp4", size: 24, sha256: "0".repeat(64), received: 24, blocks: 1, complete: true, expires: 0, etag: "final" };
  service.drafts.get(draft.id).upload = upload;
  const server = createServer(mediaHandler(service));
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = (action, input, actor = "builder") => fetch(`${origin}/api/local-media/${action}`, {
    method: "POST", headers: { origin, "x-prisma-local": "1", "x-local-actor": actor, "content-type": "application/json" }, body: JSON.stringify(input),
  });
  const range = { id: draft.id, assetId: upload.assetId, mode: "submission", offset: 0, count: 12 };
  try {
    assert.equal((await call("range", range)).status, 403);
    assert.equal((await call("scan", { ...draft, session: upload.id, outcome: "pass" }, "reader")).status, 403);
    let response = await call("scan", { ...draft, session: upload.id, outcome: "outage" });
    assert.equal(response.status, 200); draft = await response.json();
    assert.equal(draft.upload.scan.job.state, "queued");
    assert.equal((await call("range", range)).status, 403);
    for (let attempt = 0; attempt < 3; attempt++) {
      await runScanOnce(service, service.store, { scan: async () => { throw new Error("Simulated outage"); } });
      clock += SCAN_RETRY_DELAY * 2 ** attempt;
    }
    draft = await service.execute("builder", "read", { id: draft.id, mode: "submission" });
    assert.equal(draft.upload.scan.status, "error");
    assert.equal((await call("range", range)).status, 403);
    response = await call("scan", { ...draft, session: upload.id, outcome: "pass" });
    assert.equal(response.status, 200); draft = await response.json();
    assert.equal(draft.upload.released, false);
    await runScanOnce(service, service.store, { scan: async () => "passed" });
    draft = await service.execute("builder", "read", { id: draft.id, mode: "submission" });
    assert.equal(draft.upload.released, true);
    response = await call("range", range);
    assert.equal(response.status, 200);
    assert.equal((await response.arrayBuffer()).byteLength, 12);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});