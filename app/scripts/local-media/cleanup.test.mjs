import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { planCleanup, cleanupWorkspace, ORPHAN_GRACE } from "./cleanup.mjs";
import { startEmulator } from "./emulator.mjs";
import { LocalBlobStore } from "./storage.mjs";
import { LocalMediaService } from "./service.mjs";
import { SqliteMediaState } from "./state.mjs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, fork } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { runScanOnce } from "./scanner.mjs";

const now = ORPHAN_GRACE * 2;
const record = (complete, expires = now) => ({ id: randomUUID(), owner: "builder", version: 3, status: complete ? "published" : "draft", safe: complete,
  upload: { id: randomUUID(), assetId: randomUUID(), name: "test.mp4", sha256: "0".repeat(64), blocks: complete ? 1 : 0,
    complete, expires, size: 24, received: complete ? 24 : 0, etag: "final" } });
const blob = (container, name, overrides = {}) => ({ container, name, etag: "final", size: 24, modified: now - ORPHAN_GRACE, uncommitted: false, ...overrides });

test("cleanup report preserves every completed reference and respects expiry and orphan grace", () => {
  const complete = record(true, 0);
  const expired = record(false);
  const active = record(false, now + 1);
  const oldOrphan = blob("assets", randomUUID());
  const recent = blob("staging", randomUUID(), { modified: now - ORPHAN_GRACE + 1 });
  const inventory = [blob("assets", complete.upload.assetId), blob("staging", complete.upload.id), blob("staging", expired.upload.id),
    blob("assets", expired.upload.assetId), blob("staging", active.upload.id), oldOrphan, recent, blob("assets", "unknown")];
  const drafts = new Map([complete, expired, active].map(draft => [draft.id, draft]));
  const before = structuredClone({ drafts, inventory });
  const report = planCleanup(drafts, inventory, now, "test-workspace");
  assert.equal(report.blocked, false);
  assert.deepEqual(report.expiredUploads.map(upload => upload.draftId), [expired.id]);
  assert.deepEqual(report.orphanBlobs, [oldOrphan]);
  assert.equal(report.retainedBlobs.length, 5);
  assert.deepEqual({ drafts, inventory }, before);
  assert.equal(planCleanup(drafts, inventory, now + 0.5, "test-workspace").fingerprint, report.fingerprint);
  complete.version++;
  assert.notEqual(planCleanup(drafts, inventory, now, "test-workspace").fingerprint, report.fingerprint);
});

test("missing or changed completed blobs and conflicting references block cleanup", () => {
  const complete = record(true);
  const expired = record(false);
  expired.upload.assetId = complete.upload.assetId;
  const drafts = new Map([complete, expired].map(draft => [draft.id, draft]));
  const missing = planCleanup(drafts, [], now, "test-workspace");
  assert.equal(missing.blocked, true);
  assert(missing.issues.some(issue => issue.kind === "missing-completed-asset"));
  assert(missing.issues.some(issue => issue.kind === "shared-reference"));
  const changed = planCleanup(new Map([[complete.id, complete]]), [blob("assets", complete.upload.assetId, { etag: "replaced" })], now, "test-workspace");
  assert.equal(changed.blocked, true);
  assert.equal(changed.issues[0].kind, "changed-completed-asset");
});

test("Azurite cleanup removes expired uncommitted uploads and old orphans but preserves published bytes", { timeout: 120_000 }, async () => {
  const emulator = await startEmulator();
  const path = join(emulator.directory, "media.sqlite");
  let journal = new SqliteMediaState(path);
  try {
    const store = new LocalBlobStore(emulator.endpoint, emulator.account, emulator.key);
    await store.initialize();
    let clock = Date.now();
    let service = new LocalMediaService(store, () => clock, journal);
    const bytes = Buffer.alloc(24, 42); bytes.writeUInt32BE(24, 0); bytes.write("ftypisom", 4, "ascii");
    const file = { name: "cleanup.mp4", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    const upload = async complete => {
      let draft = await service.execute("builder", "create");
      draft = await service.execute("builder", "begin", { ...draft, ...file });
      draft = await service.execute("builder", "block", { ...draft, session: draft.upload.id, index: 0, bytes });
      if (complete) draft = await service.execute("builder", "finish", { ...draft, session: draft.upload.id });
      return draft;
    };
    const expired = await upload(false);
    let published = await upload(true);
    published = await service.execute("builder", "scan", { ...published, session: published.upload.id, outcome: "pass" });
    await runScanOnce(service, store);
    published = await service.execute("builder", "read", { id: published.id, mode: "submission" });
    published = await service.execute("builder", "submit", published);
    published = await service.execute("librarian", "publish", { ...published, safe: true });
    const orphan = randomUUID();
    await store.assets.getBlockBlobClient(orphan).uploadData(bytes);
    clock += ORPHAN_GRACE + 10_000;
    const active = await upload(false);
    const options = { workspace: "disposable-cleanup-test", now: () => clock };
    const report = await cleanupWorkspace(journal, store, options);
    assert.equal(report.blocked, false);
    assert.deepEqual(report.expiredUploads.map(upload => upload.draftId), [expired.id]);
    assert.equal(report.expiredUploads[0].blobs[0].uncommitted, true);
    assert.equal(report.expiredUploads[0].blobs[0].size, bytes.length);
    assert.deepEqual(report.orphanBlobs.map(blob => blob.name), [orphan]);
    assert.equal((await service.execute("builder", "read", { id: expired.id, mode: "submission" })).upload.id, expired.upload.id);
    await assert.rejects(cleanupWorkspace(journal, store, { ...options, execute: true, expected: "0".repeat(64) }), /stale/);
    for (const crashAfter of ["cleanup-placeholder", "deleteObserved"]) {
      const current = await cleanupWorkspace(journal, store, options);
      journal.close(); journal = null;
      const child = fork(fileURLToPath(new URL("./recovery-worker.mjs", import.meta.url)), [], { silent: true, serialization: "advanced" });
      let errors = "";
      child.stderr.on("data", chunk => { errors += chunk; });
      const exited = once(child, "exit");
      const timer = setTimeout(() => child.kill(), 30_000);
      try {
        child.send({ endpoint: emulator.endpoint, account: emulator.account, key: emulator.key, path, crashAfter, action: "cleanup",
          cleanup: { workspace: options.workspace, expected: current.fingerprint, time: clock } });
        const [code] = await exited;
        assert.equal(code, 73, errors);
      } finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill(); }
      journal = new SqliteMediaState(path, { existingOnly: true });
      service = new LocalMediaService(store, () => clock, journal);
      assert.equal((await service.execute("builder", "read", { id: expired.id, mode: "submission" })).upload.id, expired.upload.id);
    }
    const retry = await cleanupWorkspace(journal, store, options);
    assert.notEqual(retry.fingerprint, report.fingerprint);
    const result = await cleanupWorkspace(journal, store, { ...options, execute: true, expected: retry.fingerprint });
    assert.equal(result.removedBlobs.length, 1);
    const cleaned = await service.execute("builder", "read", { id: expired.id, mode: "submission" });
    assert.equal(cleaned.upload, null);
    assert.equal(Number(cleaned.version), Number(expired.version) + 1);
    const inventory = await store.inventory();
    assert(!inventory.some(blob => blob.name === expired.upload.id || blob.name === orphan));
    assert(inventory.some(blob => blob.name === active.upload.id));
    assert(inventory.some(blob => blob.name === published.upload.id));
    const range = await service.execute("reader", "range", { id: published.id, assetId: published.upload.assetId, mode: "present", offset: 0, count: bytes.length });
    assert.deepEqual(Buffer.from(range.bytes), bytes);
    const replaced = randomUUID();
    const client = store.assets.getBlockBlobClient(replaced);
    await client.uploadData(bytes);
    const observed = (await store.inventory()).find(item => item.name === replaced);
    await client.uploadData(Buffer.alloc(25));
    await assert.rejects(store.deleteObserved(observed), error => error.statusCode === 412);
    assert.equal((await client.getProperties()).contentLength, 25);
  } finally { journal?.close(); await emulator.stop(); }
});

test("cleanup fails closed on storage outages, missing completed assets and stale publication references", async () => {
  const journal = new SqliteMediaState(":memory:");
  try {
    const expired = record(false);
    const complete = record(true);
    await journal.transaction(drafts => { drafts.set(expired.id, expired); drafts.set(complete.id, complete); });
    let inventory = [blob("staging", expired.upload.id), blob("assets", expired.upload.assetId), blob("assets", complete.upload.assetId)];
    let deletions = 0;
    const store = { inventory: async () => structuredClone(inventory), deleteObserved: async () => { deletions++; } };
    const options = { workspace: "failure-test", now: () => now };
    const report = await cleanupWorkspace(journal, store, options);
    store.inventory = async () => { throw new Error("Storage unavailable"); };
    await assert.rejects(cleanupWorkspace(journal, store, options), /Storage unavailable/);
    await assert.rejects(cleanupWorkspace(journal, store, { ...options, execute: true, expected: report.fingerprint }), /Storage unavailable/);
    store.inventory = async () => structuredClone(inventory);
    const original = inventory;
    inventory = inventory.filter(item => item.name !== complete.upload.assetId);
    assert.equal((await cleanupWorkspace(journal, store, options)).blocked, true);
    await assert.rejects(cleanupWorkspace(journal, store, { ...options, execute: true, expected: report.fingerprint }), /blocked/);
    inventory = original;
    await journal.transaction(drafts => {
      const draft = drafts.get(expired.id);
      draft.upload.complete = true; draft.upload.blocks = 1; draft.upload.received = 24;
      draft.status = "published"; draft.safe = true; draft.version++;
    });
    await assert.rejects(cleanupWorkspace(journal, store, { ...options, execute: true, expected: report.fingerprint }), /stale/);
    assert.equal(deletions, 0);
    assert.equal((await cleanupWorkspace(journal, store, options)).expiredUploads.length, 0);
  } finally { journal.close(); }
});

test("failed deletion rolls back metadata and a new report safely retries partially deleted uploads", async () => {
  const journal = new SqliteMediaState(":memory:");
  try {
    const expired = record(false);
    await journal.transaction(drafts => drafts.set(expired.id, expired));
    let inventory = [blob("staging", expired.upload.id), blob("assets", expired.upload.assetId)];
    let calls = 0;
    const store = { inventory: async () => structuredClone(inventory), deleteObserved: async target => {
      inventory = inventory.filter(item => item.name !== target.name);
      if (++calls === 2) throw new Error("Lost deletion response");
    } };
    const options = { workspace: "retry-test", now: () => now };
    const report = await cleanupWorkspace(journal, store, options);
    await assert.rejects(cleanupWorkspace(journal, store, { ...options, execute: true, expected: report.fingerprint }), /Lost deletion response/);
    await journal.transaction(drafts => assert.deepEqual(drafts.get(expired.id), expired));
    const retry = await cleanupWorkspace(journal, store, options);
    assert.equal(retry.expiredUploads.length, 1);
    assert.equal(retry.expiredUploads[0].blobs.length, 0);
    await cleanupWorkspace(journal, store, { ...options, execute: true, expected: retry.fingerprint });
    await journal.transaction(drafts => assert.equal(drafts.get(expired.id).upload, null));
    assert.equal((await cleanupWorkspace(journal, store, options)).expiredUploads.length, 0);
  } finally { journal.close(); }
});

test("offline CLI requires an existing idle workspace and reviewed confirmation; report preserves bytes and state", { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "prisma-cleanup-cli-"));
  const path = join(directory, "media.sqlite");
  const script = fileURLToPath(new URL("./maintenance.mjs", import.meta.url));
  const run = (...args) => promisify(execFile)(process.execPath, [script, "--data-dir", directory, ...args], { timeout: 30_000 });
  let emulator;
  try {
    await assert.rejects(run("--execute"), /both --execute and --confirm/);
    await assert.rejects(run(), /ENOENT/);
    assert.deepEqual(await readdir(directory), []);
    assert.throws(() => new SqliteMediaState(path, { existingOnly: true }), /ENOENT/);
    assert.deepEqual(await readdir(directory), []);
    const blank = new DatabaseSync(path); blank.close();
    assert.throws(() => new SqliteMediaState(path, { existingOnly: true }), /initialized/);
    const checkBlank = new DatabaseSync(path);
    assert.equal(checkBlank.prepare("PRAGMA user_version").get().user_version, 0); checkBlank.close();
    const state = new SqliteMediaState(path);
    const expired = record(false, Date.now() - 1000);
    await state.transaction(drafts => drafts.set(expired.id, expired));
    state.close();
    emulator = await startEmulator({ directory: join(directory, "blob") });
    const store = new LocalBlobStore(emulator.endpoint, emulator.account, emulator.key);
    await store.initialize();
    await store.stage(expired.upload.id, 0, Buffer.alloc(24));
    await assert.rejects(run(), /Cleanup stopped/);
    await emulator.stop(); emulator = null;
    const before = await readFile(path);
    const report = JSON.parse((await run()).stdout);
    assert.equal(report.blocked, false);
    assert.equal(report.expiredUploads[0].blobs[0].uncommitted, true);
    assert.deepEqual(await readFile(path), before);
    const second = JSON.parse((await run()).stdout);
    assert.equal(second.fingerprint, report.fingerprint);
    const result = JSON.parse((await run("--execute", "--confirm", report.fingerprint)).stdout);
    assert.equal(result.status, "completed");
    assert.deepEqual(result.clearedUploads, [expired.id]);
    const final = JSON.parse((await run()).stdout);
    assert.equal(final.expiredUploads.length, 0);
    assert.equal(final.orphanBlobs.length, 0);
    const readOnly = new SqliteMediaState(path, { existingOnly: true, readOnly: true });
    try {
      await assert.rejects(readOnly.transaction(drafts => { drafts.get(expired.id).version++; }), /readonly/);
      await readOnly.transaction(drafts => assert.equal(drafts.get(expired.id).version, expired.version + 1));
    } finally { readOnly.close(); }
  } finally { await emulator?.stop(); await rm(directory, { recursive: true, force: true }); }
});