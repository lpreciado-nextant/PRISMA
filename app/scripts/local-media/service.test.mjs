import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteMediaState } from "./state.mjs";
import { DatabaseSync } from "node:sqlite";
import { LocalMediaService } from "./service.mjs";
import { BLOCK_SIZE, RANGE_SIZE, SESSION_TTL } from "./policy.mjs";
import { runScanOnce, SCAN_LEASE, SCAN_RETRY_DELAY } from "./scanner.mjs";

class MemoryStore {
  staged = new Map();
  final = new Map();
  async stage(id, index, bytes) {
    const blocks = this.staged.get(id) ?? [];
    blocks[index] = Buffer.from(bytes); this.staged.set(id, blocks);
  }
  async seal(id) {
    const bytes = Buffer.concat(this.staged.get(id));
    return { stream: Readable.from([bytes]), size: bytes.length, etag: "staged" };
  }
  async promote(id, assetId) { this.final.set(assetId, Buffer.concat(this.staged.get(id))); return "final"; }
  async read(id, offset, count) { return this.final.get(id).subarray(offset, offset + count); }
  async remove(id, assetId) { this.staged.delete(id); this.final.delete(assetId); }
}

export function fixture(size = BLOCK_SIZE + 24) {
  const bytes = Buffer.alloc(size, 7);
  bytes.writeUInt32BE(24, 0); bytes.write("ftypisom", 4, "ascii");
  return { bytes, name: "fixture.mp4", size, sha256: createHash("sha256").update(bytes).digest("hex") };
}

async function start(service, file) {
  let state = await service.execute("builder", "create");
  state = await service.execute("builder", "begin", { ...state, ...file });
  return state;
}

async function drainScan(service, id) {
  const originalNow = service.now;
  let clock = originalNow();
  service.now = () => clock;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await service.execute("builder", "read", { id, mode: "submission" });
      if (!current.upload.scan.job) return current;
      clock = Math.max(clock, current.upload.scan.job.availableAt);
      await runScanOnce(service, service.store, { scan: async outcome => {
        if (outcome === "outage") throw new Error("Scanner unavailable");
        return outcome === "pass" ? "passed" : "rejected";
      } });
    }
    return service.execute("builder", "read", { id, mode: "submission" });
  } finally { service.now = originalNow; }
}

test("interrupted upload resumes exact bytes and bounded reads match the original", async () => {
  const store = new MemoryStore();
  const service = new LocalMediaService(store);
  const file = fixture();
  let state = await start(service, file);
  await service.execute("builder", "block", { ...state, session: state.upload.id, index: 0, bytes: file.bytes.subarray(0, BLOCK_SIZE) });
  state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
  assert.equal(state.upload.received, BLOCK_SIZE);
  await assert.rejects(service.execute("builder", "checkpoint", { ...state, ...file, sha256: "b".repeat(64), session: state.upload.id }), /exact file/);
  state = await service.execute("builder", "checkpoint", { ...state, ...file, session: state.upload.id });
  state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 1, bytes: file.bytes.subarray(BLOCK_SIZE) });
  await service.execute("builder", "finish", { ...state, session: state.upload.id });
  state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
  assert.equal(state.upload.complete, true);
  assert.match(state.upload.verification, /not malware-scanned/);
  assert.deepEqual(await service.execute("builder", "finish", { ...state, session: state.upload.id }), state);
  state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" });
  state = await drainScan(service, state.id);
  const parts = [];
  for (let offset = 0; offset < file.size; offset += RANGE_SIZE) {
    const result = await service.execute("builder", "range", { id: state.id, assetId: state.upload.assetId, mode: "submission", offset, count: RANGE_SIZE });
    parts.push(Buffer.from(result.bytes));
  }
  assert.deepEqual(Buffer.concat(parts), file.bytes);
  await assert.rejects(service.execute("reader", "range", { id: state.id, assetId: state.upload.assetId, mode: "present", offset: 0, count: 12 }), /unavailable/);
  state = await service.execute("builder", "submit", state);
  await assert.rejects(service.execute("builder", "publish", { ...state, safe: true }), /librarian/);
  state = await service.execute("librarian", "publish", { ...state, safe: true });
  const read = { id: state.id, assetId: state.upload.assetId, mode: "present", offset: 0, count: 12 };
  const previous = await service.execute("reader", "range", read);
  state = await service.execute("librarian", "withdraw", state);
  await assert.rejects(service.execute("reader", "range", read), /unavailable/);
  await assert.rejects(service.execute("builder", "range", { ...read, mode: "submission", version: previous.version }), /version/);
  await service.execute("builder", "remove", { ...state, session: state.upload.id });
  assert.equal(store.final.size, 0);
});

test("simultaneous stale mutations cannot overwrite a confirmed block", async () => {
  const service = new LocalMediaService(new MemoryStore());
  const file = fixture(24);
  const state = await start(service, file);
  const block = { ...state, session: state.upload.id, index: 0, bytes: file.bytes };
  const results = await Promise.allSettled([service.execute("builder", "block", block), service.execute("builder", "block", block)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.match(results.find(result => result.status === "rejected").reason.message, /Version/);
});

test("bad checksums, cross-owner requests and expired sessions cannot finalize", async () => {
  let now = 0;
  const service = new LocalMediaService(new MemoryStore(), () => now);
  const file = fixture(24);
  let state = await start(service, { ...file, sha256: "a".repeat(64) });
  await assert.rejects(service.execute("other-builder", "read", { id: state.id, mode: "submission" }), /denied/);
  assert.deepEqual(await service.execute("reader", "list"), []);
  await assert.rejects(service.execute("builder", "finish", { ...state, session: state.upload.id }), /incomplete/);
  state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 0, bytes: file.bytes });
  await assert.rejects(service.execute("builder", "finish", { ...state, session: state.upload.id }), /SHA-256/);
  assert.equal(state.upload.complete, false);
  now = SESSION_TTL;
  await assert.rejects(service.execute("builder", "finish", { ...state, session: state.upload.id }), /expired/);
});

test("SQLite checkpoints, finalization and withdrawal survive service restarts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prisma-state-test-"));
  const path = join(directory, "media.sqlite");
  const store = new MemoryStore();
  let journal;
  const restart = () => { journal?.close(); journal = new SqliteMediaState(path); return new LocalMediaService(store, Date.now, journal); };
  try {
    let service = restart();
    const file = fixture();
    let state = await start(service, file);
    state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 0, bytes: file.bytes.subarray(0, BLOCK_SIZE) });
    const checkpoint = state;
    service = restart();
    state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
    assert.deepEqual(state, checkpoint);
    state = await service.execute("builder", "checkpoint", { ...state, ...file, session: state.upload.id });
    state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 1, bytes: file.bytes.subarray(BLOCK_SIZE) });
    state = await service.execute("builder", "finish", { ...state, session: state.upload.id });
    service = restart();
    assert.deepEqual(await service.execute("builder", "read", { id: state.id, mode: "submission" }), state);
    state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" });
    state = await drainScan(service, state.id);
    state = await service.execute("builder", "submit", state);
    state = await service.execute("librarian", "publish", { ...state, safe: true });
    state = await service.execute("librarian", "withdraw", state);
    service = restart();
    await assert.rejects(service.execute("reader", "read", { id: state.id, mode: "present" }), /unavailable/);
  } finally { journal?.close(); await rm(directory, { recursive: true, force: true }); }
});

test("failed SQLite writes are not acknowledged or left in live service state", async () => {
  const journal = new SqliteMediaState(":memory:");
  try {
    const service = new LocalMediaService(new MemoryStore(), Date.now, journal);
    journal.database.exec("CREATE TRIGGER reject_save BEFORE UPDATE ON media_state BEGIN SELECT RAISE(ABORT, 'injected write failure'); END;");
    await assert.rejects(service.execute("builder", "create"), /injected write failure/);
    assert.deepEqual(await service.execute("builder", "list"), []);
    journal.database.exec("DROP TRIGGER reject_save;");
    const state = await service.execute("builder", "create");
    assert.deepEqual(await service.execute("builder", "list"), [state]);
  } finally { journal.close(); }
});

test("corrupt, missing and future-version state fail closed without replacing the catalogue", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prisma-invalid-state-"));
  const path = join(directory, "media.sqlite");
  try {
    const journal = new SqliteMediaState(path); journal.close();
    let database = new DatabaseSync(path);
    database.prepare("UPDATE media_state SET payload = ?").run("invalid-json"); database.close();
    assert.throws(() => new SqliteMediaState(path), SyntaxError);
    database = new DatabaseSync(path);
    assert.equal(database.prepare("SELECT payload FROM media_state").get().payload, "invalid-json");
    database.exec("DELETE FROM media_state;"); database.close();
    assert.throws(() => new SqliteMediaState(path), /missing/);
    database = new DatabaseSync(path);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM media_state").get().count, 0);
    database.exec("PRAGMA user_version = 99;"); database.close();
    assert.throws(() => new SqliteMediaState(path), /version/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("quarantine blocks all bytes and submission until a bound simulated pass; outage retries and rejection stay closed", async () => {
  const journal = new SqliteMediaState(":memory:");
  const store = new MemoryStore();
  let service = new LocalMediaService(store, Date.now, journal);
  try {
    const file = fixture(24);
    let state = await start(service, file);
    state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 0, bytes: file.bytes });
    state = await service.execute("builder", "finish", { ...state, session: state.upload.id });
    const denied = async () => {
      for (const actor of ["builder", "librarian", "reader", "other-builder"]) {
        for (const mode of ["submission", "published", "present"]) {
          await assert.rejects(service.execute(actor, "range", { id: state.id, assetId: state.upload.assetId, mode, offset: 0, count: 12 }));
        }
      }
      await assert.rejects(service.execute("builder", "submit", { ...state, released: true, scan: { status: "passed" } }), /quarantined/);
    };
    assert.equal(state.upload.scan.status, "pending");
    assert.equal(state.upload.released, false);
    await denied();
    await assert.rejects(service.execute("other-builder", "scan", { ...state, session: state.upload.id, outcome: "pass" }), /owner/);
    await assert.rejects(service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "unknown" }), /outcome/);
    const original = state;
    state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "outage" });
    state = await drainScan(service, state.id);
    assert.equal(state.upload.scan.status, "error");
    assert.equal(state.upload.scan.attempts, 3);
    service = new LocalMediaService(store, Date.now, journal);
    assert.deepEqual(await service.execute("builder", "read", { id: state.id, mode: "submission" }), state);
    await denied();
    await assert.rejects(service.execute("builder", "scan", { ...original, session: state.upload.id, outcome: "pass" }), /Version/);
    state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" });
    state = await drainScan(service, state.id);
    assert.equal(state.upload.released, true);
    assert.equal(state.upload.scan.attempts, 4);
    const range = await service.execute("builder", "range", { id: state.id, assetId: state.upload.assetId, mode: "submission", offset: 0, count: 24 });
    assert.deepEqual(Buffer.from(range.bytes), file.bytes);
    await journal.transaction(drafts => { delete drafts.get(state.id).upload.scan; });
    state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
    assert.equal(state.upload.scan.status, "pending");
    await denied();
    state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "reject" });
    state = await drainScan(service, state.id);
    assert.equal(state.upload.scan.status, "rejected");
    await denied();
    await assert.rejects(service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" }), /final/);
    await assert.rejects(journal.transaction(drafts => { drafts.get(state.id).upload.scan.etag = "different"; }), /scan binding/);
    state = await service.execute("builder", "remove", { ...state, session: state.upload.id });
    assert.equal(state.upload, null);
  } finally { journal.close(); }
});

test("scan save/storage failures never release files and legacy publication cannot bypass quarantine", async () => {
  const journal = new SqliteMediaState(":memory:");
  try {
    const store = new MemoryStore();
    const service = new LocalMediaService(store, Date.now, journal);
    const file = fixture(24);
    let state = await start(service, file);
    state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 0, bytes: file.bytes });
    state = await service.execute("builder", "finish", { ...state, session: state.upload.id });
    journal.database.exec("CREATE TRIGGER reject_scan BEFORE UPDATE ON media_state BEGIN SELECT RAISE(ABORT, 'scan save failed'); END;");
    await assert.rejects(service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" }), /scan save failed/);
    journal.database.exec("DROP TRIGGER reject_scan;");
    assert.deepEqual(await service.execute("builder", "read", { id: state.id, mode: "submission" }), state);
    const read = store.read.bind(store);
    store.read = async () => { throw new Error("Storage offline"); };
    state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" });
    state = await drainScan(service, state.id);
    assert.equal(state.upload.scan.status, "error");
    assert.equal(state.upload.released, false);
    store.read = read;
    state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" });
    state = await drainScan(service, state.id);
    state = await service.execute("builder", "submit", state);
    await journal.transaction(drafts => { delete drafts.get(state.id).upload.scan; });
    await assert.rejects(service.execute("librarian", "publish", { ...state, safe: true }), /quarantined/);
    await journal.transaction(drafts => { const draft = drafts.get(state.id); draft.status = "published"; draft.safe = true; });
    assert.deepEqual(await service.execute("reader", "list"), []);
    for (const mode of ["published", "present"]) {
      await assert.rejects(service.execute("reader", "read", { id: state.id, mode }), /quarantined/);
      await assert.rejects(service.execute("reader", "range", { id: state.id, assetId: state.upload.assetId, mode, offset: 0, count: 12 }), /quarantined/);
    }
    state = await service.execute("builder", "read", { id: state.id, mode: "submission" });
    state = await service.execute("builder", "withdraw", state);
    state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" });
    state = await drainScan(service, state.id);
    state = await service.execute("builder", "submit", state);
    state = await service.execute("librarian", "publish", { ...state, safe: true });
    assert.equal((await service.execute("reader", "list"))[0].id, state.id);
  } finally { journal.close(); }
});

test("durable scan jobs fence expired leases, bound retries and removed uploads without holding a transaction", async () => {
  const journal = new SqliteMediaState(":memory:");
  let clock = 1000;
  try {
    const service = new LocalMediaService(new MemoryStore(), () => clock, journal);
    const file = fixture(24);
    let draft = await start(service, file);
    draft = await service.execute("builder", "block", { ...draft, session: draft.upload.id, index: 0, bytes: file.bytes });
    draft = await service.execute("builder", "finish", { ...draft, session: draft.upload.id });
    draft = await service.execute("builder", "scan", { ...draft, session: draft.upload.id, outcome: "pass" });
    assert.equal(draft.upload.scan.job.state, "queued");
    assert.equal(draft.upload.scan.attempts, 0);
    assert.equal(draft.upload.released, false);
    await assert.rejects(service.execute("builder", "scan", { ...draft, session: draft.upload.id, outcome: "pass" }), /already queued/);
    const first = await service.claimScan();
    assert.equal(await service.claimScan(), null);
    assert.equal((await service.execute("builder", "list")).length, 1);
    clock += SCAN_LEASE;
    assert.equal(await service.settleScan(first, "passed"), false);
    const second = await service.claimScan();
    assert.notEqual(first.token, second.token);
    assert.equal(await service.settleScan(first, "passed"), false);
    assert.equal(await service.settleScan(second, "error", "timeout"), true);
    assert.equal(await service.claimScan(), null);
    clock += SCAN_RETRY_DELAY * 2;
    const third = await service.claimScan();
    await service.settleScan(third, "error");
    draft = await service.execute("builder", "read", { id: draft.id, mode: "submission" });
    assert.equal(draft.upload.scan.status, "error");
    assert.equal(draft.upload.scan.attempts, 3);
    assert.equal(draft.upload.scan.job, null);
    assert.equal(await service.claimScan(), null);
    draft = await service.execute("builder", "scan", { ...draft, session: draft.upload.id, outcome: "pass" });
    const removed = await service.claimScan();
    draft = await service.execute("builder", "read", { id: draft.id, mode: "submission" });
    await service.execute("builder", "remove", { ...draft, session: draft.upload.id });
    assert.equal(await service.settleScan(removed, "passed"), false);
    draft = await service.execute("builder", "read", { id: draft.id, mode: "submission" });
    draft = await service.execute("builder", "begin", { ...draft, ...file });
    draft = await service.execute("builder", "block", { ...draft, session: draft.upload.id, index: 0, bytes: file.bytes });
    draft = await service.execute("builder", "finish", { ...draft, session: draft.upload.id });
    assert.equal(await service.settleScan(removed, "passed"), false);
    assert.equal(draft.upload.released, false);
    draft = await service.execute("builder", "scan", { ...draft, session: draft.upload.id, outcome: "pass" });
    for (let attempt = 0; attempt < 3; attempt++) {
      assert(await service.claimScan());
      clock += SCAN_LEASE;
    }
    assert.equal(await service.claimScan(), null);
    draft = await service.execute("builder", "read", { id: draft.id, mode: "submission" });
    assert.equal(draft.upload.scan.status, "error");
    assert.equal(draft.upload.scan.failure, "interrupted");
    assert.equal(draft.upload.scan.attempts, 3);
  } finally { journal.close(); }
});

test("background scanner releases database during work and times out even when a scanner ignores cancellation", async () => {
  const journal = new SqliteMediaState(":memory:");
  try {
    const store = new MemoryStore();
    const service = new LocalMediaService(store, Date.now, journal);
    const file = fixture(24);
    let draft = await start(service, file);
    draft = await service.execute("builder", "block", { ...draft, session: draft.upload.id, index: 0, bytes: file.bytes });
    draft = await service.execute("builder", "finish", { ...draft, session: draft.upload.id });
    draft = await service.execute("builder", "scan", { ...draft, session: draft.upload.id, outcome: "timeout" });
    let lateResult;
    const scanning = runScanOnce(service, store, { timeout: 20, scan: async () => {
      await service.execute("builder", "create");
      return new Promise(resolve => { lateResult = resolve; });
    } });
    assert.equal(await scanning, true);
    draft = await service.execute("builder", "read", { id: draft.id, mode: "submission" });
    assert.equal(draft.upload.scan.failure, "timeout");
    assert.equal(draft.upload.scan.job.state, "queued");
    assert.equal(draft.upload.released, false);
    lateResult("passed");
    assert.equal((await service.execute("builder", "read", { id: draft.id, mode: "submission" })).upload.released, false);
  } finally { journal.close(); }
});

test("failed background verdict commit retains quarantine and recovery accepts a verdict only once", async () => {
  const journal = new SqliteMediaState(":memory:");
  let clock = 1000;
  try {
    const store = new MemoryStore();
    const service = new LocalMediaService(store, () => clock, journal);
    const file = fixture(24);
    let draft = await start(service, file);
    draft = await service.execute("builder", "block", { ...draft, session: draft.upload.id, index: 0, bytes: file.bytes });
    draft = await service.execute("builder", "finish", { ...draft, session: draft.upload.id });
    draft = await service.execute("builder", "scan", { ...draft, session: draft.upload.id, outcome: "pass" });
    await assert.rejects(runScanOnce(service, store, { scan: async () => {
      journal.database.exec("CREATE TRIGGER reject_verdict BEFORE UPDATE ON media_state BEGIN SELECT RAISE(ABORT, 'verdict commit failed'); END;");
      return "passed";
    } }), /verdict commit failed/);
    journal.database.exec("DROP TRIGGER reject_verdict;");
    draft = await service.execute("builder", "read", { id: draft.id, mode: "submission" });
    assert.equal(draft.upload.released, false);
    assert.equal(draft.upload.scan.job.state, "running");
    clock += SCAN_LEASE;
    const retry = await service.claimScan();
    assert.equal(await service.settleScan(retry, "passed"), true);
    assert.equal(await service.settleScan(retry, "rejected"), false);
    draft = await service.execute("builder", "read", { id: draft.id, mode: "submission" });
    assert.equal(draft.upload.released, true);
    assert.equal(draft.upload.scan.attempts, 2);
  } finally { journal.close(); }
});

test("HTML and document finalization retains quarantine, exact bytes and read revocation", async () => {
  for (const [name, bytes, mime] of [
    ["fixture.html", Buffer.from("<!doctype html><h1>Local fixture</h1>"), "text/html"],
    ["fixture.pdf", Buffer.from("%PDF-1.7\nfixture"), "application/pdf"],
    ["fixture.ppt", Buffer.from("d0cf11e0a1b11ae100000000", "hex"), "application/vnd.ms-powerpoint"],
    ["fixture.pptx", Buffer.from("504b03040000000000000000", "hex"), "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ]) {
    const service = new LocalMediaService(new MemoryStore());
    const file = { name, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    let state = await start(service, file);
    assert.equal(state.upload.mime, mime);
    state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 0, bytes });
    state = await service.execute("builder", "finish", { ...state, session: state.upload.id });
    assert.equal(state.upload.released, false);
    const read = { id: state.id, assetId: state.upload.assetId, mode: "submission", offset: 0, count: bytes.length };
    await assert.rejects(service.execute("builder", "range", read), /quarantined/);
    await assert.rejects(service.execute("builder", "submit", state), /quarantined/);
    state = await service.execute("builder", "scan", { ...state, session: state.upload.id, outcome: "pass" });
    state = await drainScan(service, state.id);
    assert.deepEqual(Buffer.from((await service.execute("builder", "range", read)).bytes), bytes);
    state = await service.execute("builder", "submit", state);
    state = await service.execute("librarian", "publish", { ...state, safe: true });
    assert.deepEqual(Buffer.from((await service.execute("reader", "range", { ...read, mode: "present" })).bytes), bytes);
    state = await service.execute("builder", "withdraw", state);
    await assert.rejects(service.execute("reader", "range", { ...read, mode: "present" }), /unavailable/);
  }
});

test("mismatched document signatures and invalid HTML text never finalize", async () => {
  for (const [name, bytes] of [["bad.pdf", Buffer.from("not a PDF")], ["bad.ppt", Buffer.from("not a PPT")],
    ["bad.pptx", Buffer.from("not a ZIP")], ["bad.html", Buffer.from([255, 254])], ["null.html", Buffer.from("<html>\0</html>")]]) {
    const store = new MemoryStore(); const service = new LocalMediaService(store);
    let state = await start(service, { name, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    state = await service.execute("builder", "block", { ...state, session: state.upload.id, index: 0, bytes });
    await assert.rejects(service.execute("builder", "finish", { ...state, session: state.upload.id }), /header|UTF-8|null bytes/);
    assert.equal(store.final.size, 0);
    assert.equal((await service.execute("builder", "read", { id: state.id, mode: "submission" })).upload.complete, false);
  }
});