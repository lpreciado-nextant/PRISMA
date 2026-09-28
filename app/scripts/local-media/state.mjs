import { DatabaseSync } from "node:sqlite";
import { statSync } from "node:fs";
import { BLOCK_SIZE, validateFile } from "./policy.mjs";
import { MAX_SCAN_ATTEMPTS } from "./scanner.mjs";

function decode(payload) {
  const data = JSON.parse(payload);
  if (data.schema !== 1 || !Array.isArray(data.drafts)) throw new Error("Unsupported local media state. Preserve the database for recovery.");
  const drafts = new Map();
  const guid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  for (const draft of data.drafts) {
    if (!draft || !guid.test(draft.id) || drafts.has(draft.id) || !["builder", "other-builder"].includes(draft.owner)
      || !["draft", "review", "published"].includes(draft.status) || !Number.isSafeInteger(draft.version) || draft.version < 1
      || typeof draft.safe !== "boolean" || (draft.status !== "published" && draft.safe)) throw new Error("Invalid persisted draft.");
    const upload = draft.upload;
    if (upload !== null) {
      validateFile(upload);
      if (!guid.test(upload.id) || !guid.test(upload.assetId) || !Number.isSafeInteger(upload.blocks) || upload.blocks < 0
        || upload.blocks > Math.ceil(upload.size / BLOCK_SIZE) || upload.received !== Math.min(upload.blocks * BLOCK_SIZE, upload.size)
        || !Number.isSafeInteger(upload.expires) || typeof upload.complete !== "boolean"
        || (upload.complete && (upload.received !== upload.size || typeof upload.etag !== "string" || !upload.etag))) throw new Error("Invalid persisted upload.");
      const scan = upload.scan;
      if (scan !== undefined && (!upload.complete || !scan || scan.engine !== "simulated"
        || !["pending", "passed", "rejected", "error"].includes(scan.status)
        || !Number.isSafeInteger(scan.attempts) || scan.attempts < 0 || (scan.status !== "pending" && scan.attempts < 1)
        || scan.assetId !== upload.assetId || scan.etag !== upload.etag || scan.sha256 !== upload.sha256)) throw new Error("Invalid persisted scan binding.");
      if (scan?.failure !== undefined && !["unavailable", "timeout", "interrupted"].includes(scan.failure)) throw new Error("Invalid persisted scan failure.");
      const job = scan?.job;
      if (job !== undefined && (!job || scan.status !== "pending" || draft.status !== "draft" || !guid.test(job.id)
        || job.sessionId !== upload.id || !["pass", "reject", "outage", "timeout"].includes(job.outcome)
        || !["queued", "running"].includes(job.state) || !Number.isSafeInteger(job.attempts) || job.attempts < 0
        || job.attempts > MAX_SCAN_ATTEMPTS || scan.attempts < job.attempts || !Number.isSafeInteger(job.availableAt)
        || !Number.isSafeInteger(job.leaseUntil) || (job.state === "running" ? !guid.test(job.token) || job.attempts < 1 || job.leaseUntil < 1
          : job.token !== null || job.leaseUntil !== 0 || job.attempts >= MAX_SCAN_ATTEMPTS))) throw new Error("Invalid persisted scan job.");
    }
    if (draft.status !== "draft" && !upload?.complete) throw new Error("Published/review state requires completed media.");
    drafts.set(draft.id, draft);
  }
  return drafts;
}

export class SqliteMediaState {
  constructor(path, { existingOnly = false, readOnly = false } = {}) {
    if (existingOnly && !statSync(path).isFile()) throw new Error("An existing local media database is required.");
    this.readOnly = readOnly;
    this.database = new DatabaseSync(path, { readOnly });
    try {
      this.database.exec("PRAGMA busy_timeout = 250;");
      const version = this.database.prepare("PRAGMA user_version").get().user_version;
      if (version !== 0 && version !== 1) throw new Error("Unsupported local media database version.");
      if ((existingOnly || readOnly) && version !== 1) throw new Error("An existing initialized local media database is required.");
      if (!readOnly) this.database.exec("PRAGMA synchronous = FULL; PRAGMA journal_mode = DELETE;");
      if (version === 0) {
        this.database.exec("BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS media_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);");
        this.database.prepare("INSERT OR IGNORE INTO media_state (id, payload) VALUES (1, ?)").run(JSON.stringify({ schema: 1, drafts: [] }));
        this.database.exec("PRAGMA user_version = 1; COMMIT;");
      }
      const record = this.database.prepare("SELECT payload FROM media_state WHERE id = 1").get();
      if (!record) throw new Error("Local media state is missing. Preserve the database for recovery.");
      decode(record.payload);
    } catch (error) { this.database.close(); throw error; }
  }

  async transaction(operation) {
    this.database.exec(this.readOnly ? "BEGIN;" : "BEGIN IMMEDIATE;");
    try {
      const previous = this.database.prepare("SELECT payload FROM media_state WHERE id = 1").get().payload;
      const drafts = decode(previous);
      const result = await operation(drafts);
      const next = JSON.stringify({ schema: 1, drafts: [...drafts.values()] });
      decode(next);
      if (next !== previous) this.database.prepare("UPDATE media_state SET payload = ? WHERE id = 1").run(next);
      this.database.exec("COMMIT;");
      return result;
    } catch (error) { this.database.exec("ROLLBACK;"); throw error; }
  }

  close() { this.database.close(); }
}