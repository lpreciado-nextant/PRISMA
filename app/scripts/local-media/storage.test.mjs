import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { fork } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteMediaState } from "./state.mjs";
import { startEmulator } from "./emulator.mjs";
import { LocalBlobStore } from "./storage.mjs";
import { LocalMediaService } from "./service.mjs";
import { BLOCK_SIZE, RANGE_SIZE } from "./policy.mjs";
import { runScanOnce } from "./scanner.mjs";

test("Azurite round-trip: checkpoint, SHA verification, range seeking, revocation and cleanup", { timeout: 120_000 }, async () => {
  const emulator = await startEmulator();
  try {
    assert.throws(() => new LocalBlobStore("https://example.blob.core.windows.net", "unused", "unused"), /loopback/);
    const store = new LocalBlobStore(emulator.endpoint, emulator.account, emulator.key);
    await store.initialize();
    const service = new LocalMediaService(store);
    const bytes = Buffer.alloc(BLOCK_SIZE + 123, 42);
    bytes.writeUInt32BE(24, 0); bytes.write("ftypisom", 4, "ascii");
    const file = { name: "roundtrip.mp4", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    let state = await service.execute("builder", "create");
    state = await service.execute("builder", "begin", { ...state, ...file });
    await service.execute("builder", "block", { ...state, session: state.upload.id, index: 0, bytes: bytes.subarray(0, BLOCK_SIZE) });
    state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
    state = await service.execute("builder", "checkpoint", { ...state, ...file, session: state.upload.id });
    assert.equal(state.upload.received, BLOCK_SIZE);
    state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 1, bytes: bytes.subarray(BLOCK_SIZE) });
    state = await service.execute("builder", "finish", { ...state, session: state.upload.id });
    await assert.rejects(service.execute("builder", "range", { id: state.id, assetId: state.upload.assetId, mode: "submission", offset: 0, count: 12 }), /quarantined/);
    state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" });
    await runScanOnce(service, store);
    state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
    const downloaded = [];
    for (let offset = 0; offset < file.size; offset += RANGE_SIZE) {
      const response = await service.execute("builder", "range", { id: state.id, assetId: state.upload.assetId, mode: "submission", offset, count: RANGE_SIZE });
      downloaded.push(Buffer.from(response.bytes));
    }
    assert.equal(createHash("sha256").update(Buffer.concat(downloaded)).digest("hex"), file.sha256);
    state = await service.execute("builder", "submit", state);
    state = await service.execute("librarian", "publish", { ...state, safe: true });
    const range = { id: state.id, assetId: state.upload.assetId, mode: "present", offset: BLOCK_SIZE, count: RANGE_SIZE };
    const tail = await service.execute("reader", "range", range);
    assert.equal(tail.bytes.length, 123);
    state = await service.execute("librarian", "withdraw", state);
    await assert.rejects(service.execute("reader", "range", range), /unavailable/);
    const ids = { session: state.upload.id, asset: state.upload.assetId };
    await service.execute("builder", "remove", { ...state, session: ids.session });
    assert.equal(await store.assets.getBlobClient(ids.asset).exists(), false);
    assert.equal(await store.staging.getBlobClient(ids.session).exists(), false);
  } finally { await emulator.stop(); }
});

test("retained workspace resumes after full shutdown and rejects a second emulator owner", { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "prisma-retained-test-"));
  const blobDirectory = join(directory, "blob");
  const path = join(directory, "media.sqlite");
  let emulator;
  let journal;
  try {
    emulator = await startEmulator({ directory: blobDirectory });
    await assert.rejects(startEmulator({ directory: blobDirectory }), /already running/);
    let store = new LocalBlobStore(emulator.endpoint, emulator.account, emulator.key);
    await store.initialize();
    journal = new SqliteMediaState(path);
    let service = new LocalMediaService(store, Date.now, journal);
    const bytes = Buffer.alloc(BLOCK_SIZE + 123, 42);
    bytes.writeUInt32BE(24, 0); bytes.write("ftypisom", 4, "ascii");
    const file = { name: "retained.mp4", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    let state = await service.execute("builder", "create");
    state = await service.execute("builder", "begin", { ...state, ...file });
    state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 0, bytes: bytes.subarray(0, BLOCK_SIZE) });
    const previous = state;
    journal.close(); journal = null; await emulator.stop();
    emulator = await startEmulator({ directory: blobDirectory });
    store = new LocalBlobStore(emulator.endpoint, emulator.account, emulator.key);
    await store.initialize();
    journal = new SqliteMediaState(path);
    service = new LocalMediaService(store, Date.now, journal);
    state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
    assert.deepEqual(state, previous);
    state = await service.execute("builder", "checkpoint", { ...state, ...file, session: state.upload.id });
    state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 1, bytes: bytes.subarray(BLOCK_SIZE) });
    state = await service.execute("builder", "finish", { ...state, session: state.upload.id });
    state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" });
    await runScanOnce(service, store);
    state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
    const tail = await service.execute("builder", "range", { id: state.id, assetId: state.upload.assetId, mode: "submission", offset: BLOCK_SIZE, count: RANGE_SIZE });
    assert.deepEqual(Buffer.from(tail.bytes), bytes.subarray(BLOCK_SIZE));
  } finally { journal?.close(); await emulator?.stop(); await rm(directory, { recursive: true, force: true }); }
});

test("API process crashes recover unacknowledged blocks and finalization without exposing partial files", { timeout: 120_000 }, async () => {
  const emulator = await startEmulator();
  const directory = await mkdtemp(join(tmpdir(), "prisma-crash-test-"));
  const path = join(directory, "media.sqlite");
  let journal;
  try {
    const store = new LocalBlobStore(emulator.endpoint, emulator.account, emulator.key);
    await store.initialize();
    const reopen = () => { journal?.close(); journal = new SqliteMediaState(path); return new LocalMediaService(store, Date.now, journal); };
    let service = reopen();
    const bytes = Buffer.alloc(BLOCK_SIZE + 123, 42);
    bytes.writeUInt32BE(24, 0); bytes.write("ftypisom", 4, "ascii");
    const file = { name: "crash.mp4", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    let state = await service.execute("builder", "create");
    state = await service.execute("builder", "begin", { ...state, ...file });
    state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 0, bytes: bytes.subarray(0, BLOCK_SIZE) });
    const crash = async (crashAfter, action, input) => {
      journal.close(); journal = null;
      const child = fork(fileURLToPath(new URL("./recovery-worker.mjs", import.meta.url)), [], { silent: true, serialization: "advanced" });
      let errors = "";
      child.stderr.on("data", chunk => { errors += chunk; });
      const exited = once(child, "exit");
      const timer = setTimeout(() => child.kill(), 30_000);
      try {
        child.send({ endpoint: emulator.endpoint, account: emulator.account, key: emulator.key, path, crashAfter, action, input });
        const [code] = await exited;
        assert.equal(code, crashAfter === "commit" ? 74 : 73, errors);
      } finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill(); }
      service = reopen();
    };
    const block = { ...state, session: state.upload.id, index: 1, bytes: bytes.subarray(BLOCK_SIZE) };
    await crash("stage", "block", block);
    assert.deepEqual(await service.execute("builder", "read", { id: state.id, mode: "submission" }), state);
    state = await service.execute("builder", "block", block);
    const finish = { id: state.id, version: state.version, session: state.upload.id };
    for (const phase of ["seal", "promote"]) {
      await crash(phase, "finish", finish);
      assert.deepEqual(await service.execute("builder", "read", { id: state.id, mode: "submission" }), state);
      await assert.rejects(service.execute("builder", "range", { id: state.id, assetId: state.upload.assetId, mode: "submission", offset: 0, count: 12 }), /not found/);
    }
    assert.equal(await store.assets.getBlobClient(state.upload.assetId).exists(), true);
    await crash("commit", "finish", finish);
    state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
    assert.equal(state.upload.complete, true);
    assert.deepEqual(await service.execute("builder", "finish", { ...state, session: state.upload.id }), state);
    const scan = { ...state, session: state.upload.id, outcome: "pass" };
    state = await service.execute("builder", "scan", scan);
    await crash("read", "runScan", {});
    state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
    assert.equal(state.upload.scan.job.state, "running");
    await assert.rejects(service.execute("builder", "range", { id: state.id, assetId: state.upload.assetId, mode: "submission", offset: 0, count: 12 }), /quarantined/);
    await journal.transaction(drafts => { drafts.get(state.id).upload.scan.job.leaseUntil = Date.now() - 1; });
    await crash("commit", "runScan", {});
    state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
    assert.equal(state.upload.released, true);
    assert.equal(state.upload.scan.attempts, 2);
    await assert.rejects(service.execute("builder", "scan", scan), /Version/);
    const parts = [];
    for (let offset = 0; offset < bytes.length; offset += RANGE_SIZE) {
      const response = await service.execute("builder", "range", { id: state.id, assetId: state.upload.assetId, mode: "submission", offset, count: RANGE_SIZE });
      parts.push(Buffer.from(response.bytes));
    }
    assert.equal(createHash("sha256").update(Buffer.concat(parts)).digest("hex"), file.sha256);
    const assets = [];
    for await (const asset of store.assets.listBlobsFlat()) assets.push(asset.name);
    assert.deepEqual(assets, [state.upload.assetId]);
  } finally { journal?.close(); await emulator.stop(); await rm(directory, { recursive: true, force: true }); }
});

test("scan worker process restart reclaims a crashed lease and commits a bound pass without blocking the API", { timeout: 120_000 }, async () => {
  const emulator = await startEmulator();
  const path = join(emulator.directory, "media.sqlite");
  const journal = new SqliteMediaState(path);
  let child;
  const waitMessage = (worker, event) => new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); worker.off("message", message); worker.off("exit", exited); };
    const message = value => { if (value.event === event) { cleanup(); resolve(value); } };
    const exited = code => { cleanup(); reject(new Error(`Scan worker exited early: ${code}`)); };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Missing worker event: ${event}`)); }, 30_000);
    worker.on("message", message); worker.once("exit", exited);
  });
  try {
    const store = new LocalBlobStore(emulator.endpoint, emulator.account, emulator.key);
    await store.initialize();
    const service = new LocalMediaService(store, Date.now, journal);
    const bytes = Buffer.alloc(24, 42); bytes.writeUInt32BE(24, 0); bytes.write("ftypisom", 4, "ascii");
    let draft = await service.execute("builder", "create");
    draft = await service.execute("builder", "begin", { ...draft, name: "worker.mp4", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    draft = await service.execute("builder", "block", { ...draft, session: draft.upload.id, index: 0, bytes });
    draft = await service.execute("builder", "finish", { ...draft, session: draft.upload.id });
    draft = await service.execute("builder", "scan", { ...draft, session: draft.upload.id, outcome: "pass" });
    const options = { path, endpoint: emulator.endpoint, account: emulator.account, key: emulator.key };
    child = fork(new URL("./scan-worker.mjs", import.meta.url), [], { silent: true });
    const claimed = waitMessage(child, "claimed"); child.send(options); await claimed;
    assert.equal((await service.execute("builder", "read", { id: draft.id, mode: "submission" })).upload.released, false);
    await service.execute("builder", "create");
    let exited = once(child, "exit"); child.kill(); await exited;
    await assert.rejects(service.execute("builder", "range", { id: draft.id, assetId: draft.upload.assetId, mode: "submission", offset: 0, count: 12 }), /quarantined/);
    child = fork(new URL("./scan-worker.mjs", import.meta.url), [], { silent: true });
    const settled = waitMessage(child, "settled"); child.send(options); await settled;
    draft = await service.execute("builder", "read", { id: draft.id, mode: "submission" });
    assert.equal(draft.upload.scan.attempts, 2);
    assert.equal(draft.upload.released, true);
    const response = await service.execute("builder", "range", { id: draft.id, assetId: draft.upload.assetId, mode: "submission", offset: 0, count: 24 });
    assert.deepEqual(Buffer.from(response.bytes), bytes);
    exited = once(child, "exit"); child.send("shutdown"); await exited; child = null;
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
    journal.close(); await emulator.stop();
  }
});