import { createHash } from "node:crypto";
import { createReadStream, openSync, closeSync, statSync } from "node:fs";
import { open, realpath, lstat } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { resolve, relative, isAbsolute, sep, join } from "node:path";

const guidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const tokenPattern = /^[a-zA-Z0-9._:-]{1,256}$/;

class MigrationError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new MigrationError(message);
}

function fields(value, names) {
  requireValue(value && typeof value === "object" && !Array.isArray(value), "Expected a manifest object.");
  requireValue(Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name)), "Unknown or missing manifest fields.");
}

function text(value, pattern) { return typeof value === "string" && value.trim() === value && pattern.test(value); }
function digest(value) { return text(value, digestPattern); }
function nullableDigest(value) { return value === null || digest(value); }
function size(value) { return Number.isSafeInteger(value) && value >= 0; }
function mime(value) { return text(value, /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/) && value.length <= 100; }

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function fingerprint(value) { return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }

export function parseManifest(raw, destination = false) {
  fields(raw, destination ? ["schemaVersion", "environmentId", "complete", "provider", "storeId", "assets"] : ["schemaVersion", "environmentId", "complete", "assets"]);
  requireValue(raw.schemaVersion === 1 && text(raw.environmentId, guidPattern) && raw.complete === true && Array.isArray(raw.assets)
    && raw.assets.length <= 100000, "Unsupported, partial or oversized manifest.");
  if (destination) requireValue(["local-blob", "azure-blob"].includes(raw.provider) && text(raw.storeId, guidPattern), "Invalid destination store identity.");
  const identities = new Set();
  const references = new Set();
  const assets = raw.assets.map(asset => {
    fields(asset, destination
      ? ["assetId", "solutionId", "sourceVersion", "contextSha256", "container", "key", "version", "size", "sha256", "mime"]
      : ["assetId", "solutionId", "provider", "version", "contextSha256", "kind", "mime", "size", "sha256", "complete"]);
    requireValue(text(asset.assetId, guidPattern) && text(asset.solutionId, guidPattern) && text(asset.version, tokenPattern), "Invalid asset identity or version.");
    requireValue(!identities.has(asset.assetId), "Duplicate asset identity.");
    identities.add(asset.assetId);
    if (destination) {
      requireValue(text(asset.sourceVersion, tokenPattern) && digest(asset.contextSha256) && size(asset.size) && digest(asset.sha256) && mime(asset.mime), "Invalid destination evidence.");
      requireValue(text(asset.container, /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/) && !asset.container.includes("--")
        && text(asset.key, /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/) && asset.key.length <= 512, "Invalid opaque destination reference; URLs and credentials are forbidden.");
      const reference = `${asset.container}/${asset.key}`;
      requireValue(!references.has(reference), "Destination reference is shared by multiple assets.");
      references.add(reference);
    } else {
      requireValue(asset.provider === "dataverse" && ["file", "external-link"].includes(asset.kind) && typeof asset.complete === "boolean"
        && (asset.size === null || size(asset.size)) && nullableDigest(asset.sha256) && nullableDigest(asset.contextSha256)
        && (asset.mime === null || mime(asset.mime)), "Invalid source evidence or unsupported source provider.");
    }
    return { ...asset };
  }).sort((left, right) => left.assetId.localeCompare(right.assetId));
  return { ...raw, assets };
}

export function planMigration(sourceInput, destinationInput = null) {
  const source = parseManifest(sourceInput);
  const destination = destinationInput === null ? null : parseManifest(destinationInput, true);
  requireValue(!destination || source.environmentId === destination.environmentId, "Manifest environments differ.");
  const observed = new Map(destination?.assets.map(asset => [asset.assetId, asset]) ?? []);
  const entries = source.assets.map(asset => {
    const target = observed.get(asset.assetId);
    observed.delete(asset.assetId);
    let outcome;
    let reasons = [];
    if (asset.kind === "external-link") { outcome = "deferred"; reasons = ["external-link-unchanged"]; }
    else if (!asset.complete) { outcome = "deferred"; reasons = ["unfinished-upload-stays-on-source"]; }
    else if (asset.mime !== "video/mp4") { outcome = "deferred"; reasons = ["outside-mp4-pilot"]; }
    else {
      if (!asset.sha256) reasons.push("missing-source-digest");
      if (!asset.contextSha256) reasons.push("missing-source-context");
      if (asset.size === null || asset.size < 12 || asset.size > 500 * 1024 * 1024) reasons.push("invalid-pilot-size");
      if (target) {
        if (target.solutionId !== asset.solutionId) reasons.push("solution-changed");
        if (target.sourceVersion !== asset.version) reasons.push("source-version-changed");
        if (target.contextSha256 !== asset.contextSha256) reasons.push("source-context-changed");
        if (target.size !== asset.size) reasons.push("size-mismatch");
        if (target.sha256 !== asset.sha256) reasons.push("digest-mismatch");
        if (target.mime !== asset.mime) reasons.push("mime-mismatch");
      }
      outcome = reasons.length ? "blocked" : target ? "matched-evidence" : destination ? "copy-required" : "destination-unobserved";
    }
    if (target && (asset.kind === "external-link" || !asset.complete)) {
      outcome = "blocked"; reasons.push("unexpected-destination");
    }
    return { assetId: asset.assetId, source: asset, destination: target ?? null, checkpoint: "dry-run", outcome, reasons };
  });
  for (const asset of observed.values()) entries.push({ assetId: asset.assetId, source: null, destination: asset, checkpoint: "dry-run", outcome: "blocked", reasons: ["destination-not-in-source"] });
  entries.sort((left, right) => left.assetId.localeCompare(right.assetId));
  const counts = { "copy-required": 0, "destination-unobserved": 0, "matched-evidence": 0, blocked: 0, deferred: 0 };
  let sourceBytes = 0;
  for (const entry of entries) {
    counts[entry.outcome]++;
    if (entry.source && entry.source.size !== null) sourceBytes += entry.source.size;
    requireValue(Number.isSafeInteger(sourceBytes), "Inventory byte total exceeds the safe integer limit.");
  }
  const report = { schemaVersion: 1, mode: "dry-run", environmentId: source.environmentId, canSwitch: false,
    sourceFingerprint: fingerprint(source), destinationFingerprint: destination ? fingerprint(destination) : null,
    destinationStore: destination ? { provider: destination.provider, storeId: destination.storeId } : null,
    counts, sourceBytes, entries };
  return { ...report, fingerprint: fingerprint(report) };
}

async function verifyBytes(root, parts, expected) {
  const base = await realpath(root);
  let path = base;
  for (const [index, part] of parts.entries()) {
    path = join(path, part);
    const info = await lstat(path);
    requireValue(!info.isSymbolicLink() && (index === parts.length - 1 ? info.isFile() : info.isDirectory()), "Only regular snapshot files/directories are supported.");
  }
  const resolved = await realpath(path);
  const inside = relative(base, resolved);
  requireValue(inside && inside !== ".." && !inside.startsWith(`..${sep}`) && !isAbsolute(inside), "Snapshot escaped its root.");
  const file = await open(resolved, "r");
  try {
    const before = await file.stat({ bigint: true });
    requireValue(before.isFile() && before.size === BigInt(expected.size), "Snapshot size differs.");
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of file.createReadStream({ autoClose: false, highWaterMark: 1024 * 1024 })) {
      bytes += chunk.length;
      requireValue(bytes <= expected.size, "Snapshot grew while reading.");
      hash.update(chunk);
    }
    const after = await file.stat({ bigint: true });
    const current = await lstat(resolved, { bigint: true });
    requireValue(["dev", "ino", "size", "mtimeNs", "ctimeNs"].every(field => before[field] === after[field] && after[field] === current[field])
      && !current.isSymbolicLink(), "Snapshot changed while reading.");
    const sha256 = hash.digest("hex");
    requireValue(bytes === expected.size && sha256 === expected.sha256, "Snapshot digest differs.");
    return { size: bytes, sha256 };
  } finally { await file.close(); }
}

export async function verifyMigration(source, destination, { sourceRoot, destinationRoot, checkpoint = () => {}, resume = null }) {
  const plan = planMigration(source, destination);
  requireValue(destination && sourceRoot && destinationRoot, "Verification requires both manifests and snapshot roots.");
  requireValue(plan.entries.length <= 100, "Verification pilots are limited to 100 inventory entries.");
  if (resume) {
    validateReport(resume);
    requireValue(resume.mode === "byte-verification" && resume.planFingerprint === plan.fingerprint, "Resume evidence does not match the current plan.");
  }
  const { fingerprint: planFingerprint, ...base } = plan;
  const report = { ...base, mode: "byte-verification", planFingerprint, scope: "offline-snapshots-only",
    complete: false, entries: plan.entries.map(entry => ({ ...entry, checkpoint: "pending", sourceBytes: null, destinationBytes: null })) };
  const snapshot = () => {
    const verificationCounts = { pending: 0, "source-verified": 0, "destination-verified": 0, blocked: 0, deferred: 0 };
    for (const entry of report.entries) verificationCounts[entry.checkpoint]++;
    const payload = { ...structuredClone(report), verificationCounts };
    return { ...payload, fingerprint: fingerprint(payload) };
  };
  await checkpoint(snapshot());
  for (const entry of report.entries) {
    if (!["matched-evidence", "copy-required"].includes(entry.outcome)) {
      entry.checkpoint = entry.outcome === "deferred" ? "deferred" : "blocked";
      await checkpoint(snapshot()); continue;
    }
    try {
      entry.sourceBytes = await verifyBytes(sourceRoot, [entry.assetId], entry.source);
      entry.checkpoint = "source-verified";
    } catch {
      entry.checkpoint = "blocked"; entry.reasons.push("source-bytes-unverified");
    }
    await checkpoint(snapshot());
    if (entry.checkpoint === "blocked" || !entry.destination) continue;
    try {
      entry.destinationBytes = await verifyBytes(destinationRoot, [entry.destination.container, ...entry.destination.key.split("/")], entry.destination);
      await verifyBytes(sourceRoot, [entry.assetId], entry.source);
      entry.checkpoint = "destination-verified";
    } catch {
      entry.checkpoint = "blocked"; entry.reasons.push("destination-or-rechecked-source-unverified");
    }
    await checkpoint(snapshot());
  }
  report.complete = true;
  const completed = snapshot();
  await checkpoint(completed);
  return completed;
}

function validateReport(report) {
  const { fingerprint: recorded, ...payload } = report;
  requireValue(digest(recorded) && fingerprint(payload) === recorded && report.canSwitch === false && report.schemaVersion === 1
    && ["dry-run", "byte-verification", "rollback-report"].includes(report.mode), "Invalid stored report. Preserve the ledger for recovery.");
  requireValue(report.mode !== "rollback-report" || report.canRollback === false, "Rollback execution is never authorized by a report.");
}

export function rollbackReport(baseline, current) {
  validateReport(baseline); validateReport(current);
  requireValue(baseline.mode === "byte-verification" && current.mode === "byte-verification" && baseline.complete && current.complete
    && baseline.environmentId === current.environmentId, "Rollback reports require completed verification in the same environment.");
  const previous = new Map(baseline.entries.filter(entry => entry.checkpoint === "destination-verified").map(entry => [entry.assetId, entry]));
  const entries = current.entries.map(entry => {
    const before = previous.get(entry.assetId);
    previous.delete(entry.assetId);
    let outcome = "blocked";
    let reason = "current-bytes-or-context-unverified";
    if (!before) { outcome = "retain-current-provider"; reason = "not-a-verified-baseline-migration"; }
    else if (entry.checkpoint === "destination-verified") {
      if (fingerprint(before.source) !== fingerprint(entry.source)) reason = "source-or-context-changed";
      else if (fingerprint(before.destination) !== fingerprint(entry.destination)
        || fingerprint(baseline.destinationStore) !== fingerprint(current.destinationStore)) reason = "destination-reference-changed";
      else { outcome = "candidate-for-authorized-restore"; reason = "retained-source-and-destination-snapshots-verified"; }
    }
    return { assetId: entry.assetId, outcome, reason, source: before?.source ?? null, destination: entry.destination };
  });
  for (const entry of previous.values()) entries.push({ assetId: entry.assetId, outcome: "blocked", reason: "baseline-asset-missing", source: entry.source, destination: entry.destination });
  entries.sort((left, right) => left.assetId.localeCompare(right.assetId));
  const report = { schemaVersion: 1, mode: "rollback-report", scope: "offline-snapshots-only", environmentId: current.environmentId,
    canSwitch: false, canRollback: false, baselineFingerprint: baseline.fingerprint, currentFingerprint: current.fingerprint, entries };
  return { ...report, fingerprint: fingerprint(report) };
}

export class MigrationLedger {
  constructor(path, { record = false } = {}) {
    let created = false;
    if (record) {
      try { closeSync(openSync(path, "wx", 0o600)); created = true; }
      catch (error) { if (error.code !== "EEXIST") throw error; }
    }
    requireValue(statSync(path).isFile(), "An existing ledger file is required.");
    this.readOnly = !record;
    this.database = new DatabaseSync(path, { readOnly: this.readOnly });
    try {
      this.database.exec("PRAGMA busy_timeout = 1000;");
      if (created) {
        this.database.exec(`PRAGMA synchronous = FULL; PRAGMA journal_mode = DELETE;
          BEGIN IMMEDIATE;
          CREATE TABLE reports (fingerprint TEXT PRIMARY KEY NOT NULL, recorded_at TEXT NOT NULL, payload TEXT NOT NULL) STRICT;
          CREATE TRIGGER reports_no_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'Reports are immutable'); END;
          CREATE TRIGGER reports_no_delete BEFORE DELETE ON reports BEGIN SELECT RAISE(ABORT, 'Reports are immutable'); END;
          PRAGMA application_id = 1347571009; PRAGMA user_version = 1; COMMIT;`);
      }
      requireValue(this.database.prepare("PRAGMA application_id").get().application_id === 1347571009
        && this.database.prepare("PRAGMA user_version").get().user_version === 1, "Not a supported initialized migration ledger. Preserve the file.");
      this.database.prepare("SELECT fingerprint, recorded_at, payload FROM reports LIMIT 0").all();
      if (record) this.database.exec("PRAGMA synchronous = FULL; PRAGMA journal_mode = DELETE;");
    } catch (error) { this.database.close(); throw error; }
  }

  get(id) {
    requireValue(digest(id), "Invalid report fingerprint.");
    const row = this.database.prepare("SELECT payload FROM reports WHERE fingerprint = ?").get(id);
    if (!row) return null;
    const report = JSON.parse(row.payload);
    validateReport(report);
    requireValue(report.fingerprint === id, "Invalid stored report. Preserve the ledger for recovery.");
    return report;
  }

  record(source, destination = null) {
    return this.recordReport(planMigration(source, destination));
  }

  recordReport(report) {
    requireValue(!this.readOnly, "Ledger was opened read-only.");
    validateReport(report);
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      const previous = this.get(report.fingerprint);
      if (!previous) this.database.prepare("INSERT INTO reports (fingerprint, recorded_at, payload) VALUES (?, ?, ?)")
        .run(report.fingerprint, new Date().toISOString(), JSON.stringify(report));
      this.database.exec("COMMIT;");
      return report;
    } catch (error) { this.database.exec("ROLLBACK;"); throw error; }
  }

  close() { this.database.close(); }
}

async function readManifest(path) {
  const chunks = [];
  let length = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: 65536 })) {
    length += chunk.length;
    requireValue(length <= 32 * 1024 * 1024, "Manifest exceeds the 32 MiB input limit.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function migrationCommand(args) {
  const { values } = parseArgs({ args, strict: true, options: { source: { type: "string" }, destination: { type: "string" },
    ledger: { type: "string" }, record: { type: "boolean" }, report: { type: "string" }, help: { type: "boolean" },
    "source-root": { type: "string" }, "destination-root": { type: "string" }, resume: { type: "string" }, "rollback-from": { type: "string" } } });
  if (values.help) {
    console.log("Usage: npm run migration:media -- --source <manifest.json> [--destination <manifest.json>] [--record --ledger <migration.sqlite>]");
    console.log("Read a recorded report: npm run migration:media -- --ledger <migration.sqlite> --report <fingerprint>");
    console.log("Verify offline bytes: add --source-root <directory> --destination-root <directory> and both manifests. Optional --record --ledger persists each stage.");
    console.log("Resume verification: add --resume <checkpoint-fingerprint> --record --ledger <migration.sqlite>; unchanged plan required, all bytes are rechecked.");
    console.log("Rollback report: add --rollback-from <completed-verification-fingerprint> --ledger <migration.sqlite> and both manifests/roots; --record is optional.");
    console.log("Offline evidence only. No copy, reference switch, rollback execution or deletion. Default: no writes. Requires Node 22.13+.");
    return 0;
  }
  let ledger;
  try {
    let report;
    if (values.report) {
      requireValue(values.ledger && Object.keys(values).every(key => ["ledger", "report"].includes(key)), "Report lookup requires only --ledger and --report.");
      ledger = new MigrationLedger(resolve(values.ledger));
      report = ledger.get(values.report);
      requireValue(report, "Recorded report not found.");
    } else {
      requireValue(values.source && (values.record ? values.ledger : !values.ledger || values["rollback-from"]), "Source is required; recording requires both --record and --ledger.");
      const verify = Boolean(values["source-root"] || values["destination-root"]);
      requireValue(!verify || (values["source-root"] && values["destination-root"] && values.destination), "Verification requires both roots and manifests.");
      requireValue(!values.resume || (verify && values.record && !values["rollback-from"]), "Resume requires verification and recording, without rollback reporting.");
      requireValue(!values["rollback-from"] || (verify && values.ledger), "Rollback reporting requires verification and a baseline ledger.");
      const source = await readManifest(values.source);
      const destination = values.destination ? await readManifest(values.destination) : null;
      report = planMigration(source, destination);
      if (values.ledger) ledger = new MigrationLedger(resolve(values.ledger), { record: Boolean(values.record) });
      const baseline = values["rollback-from"] ? ledger.get(values["rollback-from"]) : null;
      const resume = values.resume ? ledger.get(values.resume) : null;
      requireValue(!values["rollback-from"] || baseline, "Rollback baseline not found.");
      requireValue(!values.resume || resume, "Resume checkpoint not found.");
      if (verify) {
        report = await verifyMigration(source, destination, { sourceRoot: values["source-root"], destinationRoot: values["destination-root"], resume,
          checkpoint: values.record ? checkpoint => { ledger.recordReport(checkpoint); console.error(`Recorded checkpoint: ${checkpoint.fingerprint}`); } : undefined });
      }
      if (baseline) report = rollbackReport(baseline, report);
      if (values.record) report = ledger.recordReport(report);
    }
    console.log(JSON.stringify(report, null, 2));
    return report.counts?.blocked || report.entries.some(entry => entry.checkpoint === "blocked" || entry.outcome === "blocked") ? 2 : 0;
  } finally { ledger?.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await migrationCommand(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof MigrationError ? `Migration dry run stopped: ${error.message}`
      : "Migration dry run stopped: invalid arguments, unreadable/invalid manifests or unavailable/invalid ledger.");
    console.error("Check --help and the manifest contract; preserve existing files. No migration success is assumed.");
    process.exitCode = 1;
  }
}