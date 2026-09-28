import test from "node:test";
import assert from "node:assert/strict";
import { planMigration, verifyMigration, rollbackReport, MigrationLedger } from "./media-migration.mjs";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const environmentId = "11111111-1111-1111-1111-111111111111";
const assetId = "22222222-2222-2222-2222-222222222222";
const solutionId = "33333333-3333-3333-3333-333333333333";
const sha256 = "a".repeat(64);
const contextSha256 = "b".repeat(64);
const source = () => ({ schemaVersion: 1, environmentId, complete: true, assets: [
  { assetId, solutionId, provider: "dataverse", version: "123:456:source", contextSha256, kind: "file", mime: "video/mp4", size: 24, sha256, complete: true },
] });
const destination = () => ({ schemaVersion: 1, environmentId, complete: true, provider: "local-blob", storeId: solutionId, assets: [
  { assetId, solutionId, sourceVersion: "123:456:source", contextSha256, container: "final", key: `media/${assetId}`, version: "etag-1", size: 24, sha256, mime: "video/mp4" },
] });

test("offline inventory distinguishes unobserved destinations, empty inventories and matched evidence without authorizing a switch", () => {
  assert.equal(planMigration(source()).entries[0].outcome, "destination-unobserved");
  assert.equal(planMigration(source(), { ...destination(), assets: [] }).entries[0].outcome, "copy-required");
  const report = planMigration(source(), destination());
  assert.equal(report.entries[0].outcome, "matched-evidence");
  assert.equal(report.canSwitch, false);
  assert.equal(report.sourceBytes, 24);
  assert.equal(report.entries[0].checkpoint, "dry-run");
  assert.deepEqual(planMigration(source(), destination()), report);
});

test("reconciliation blocks stale versions, changed context, corrupt bytes and missing source references", () => {
  for (const [field, value, reason] of [["sourceVersion", "older", "source-version-changed"], ["contextSha256", sha256, "source-context-changed"],
    ["solutionId", environmentId, "solution-changed"], ["size", 25, "size-mismatch"], ["sha256", contextSha256, "digest-mismatch"], ["mime", "text/html", "mime-mismatch"]]) {
    const target = destination(); target.assets[0][field] = value;
    const entry = planMigration(source(), target).entries[0];
    assert.equal(entry.outcome, "blocked"); assert.ok(entry.reasons.includes(reason));
  }
  const entry = planMigration({ ...source(), assets: [] }, destination()).entries[0];
  assert.deepEqual(entry.reasons, ["destination-not-in-source"]);
});

test("unfinished uploads and non-video assets stay on their original provider; missing verification evidence blocks the pilot", () => {
  for (const change of [{ complete: false }, { mime: "text/html" }, { kind: "external-link", size: null, sha256: null, mime: null }]) {
    const input = source(); Object.assign(input.assets[0], change);
    assert.equal(planMigration(input).entries[0].outcome, "deferred");
  }
  for (const change of [{ sha256: null }, { contextSha256: null }, { size: null }, { size: 11 }, { size: 500 * 1024 * 1024 + 1 }]) {
    const input = source(); Object.assign(input.assets[0], change);
    assert.equal(planMigration(input).entries[0].outcome, "blocked");
  }
  for (const change of [{ complete: false }, { kind: "external-link" }]) {
    const input = source(); Object.assign(input.assets[0], change);
    const entry = planMigration(input, destination()).entries[0];
    assert.equal(entry.outcome, "blocked"); assert.ok(entry.reasons.includes("unexpected-destination"));
  }
});

test("manifest validation rejects partial exports, duplicates, unknown fields, foreign environments and credential-bearing references", () => {
  for (const input of [{ ...source(), complete: false }, { ...source(), schemaVersion: 2 }, { ...source(), token: "secret" },
    { ...source(), assets: [source().assets[0], source().assets[0]] }]) assert.throws(() => planMigration(input));
  assert.throws(() => planMigration(source(), { ...destination(), environmentId: solutionId }));
  for (const key of ["https://account.blob.core.windows.net/final/key?sig=secret", "../key", "key?sig=secret"]) {
    const target = destination(); target.assets[0].key = key;
    assert.throws(() => planMigration(source(), target));
  }
  const input = source(); input.assets[0].provider = "unknown";
  assert.throws(() => planMigration(input));
  for (const field of ["assetId", "version", "sha256", "contextSha256", "mime"]) {
    const input = source(); input.assets[0][field] += "\n";
    assert.throws(() => planMigration(input));
  }
  for (const field of ["container", "key", "version"]) {
    const target = destination(); target.assets[0][field] += "\n";
    assert.throws(() => planMigration(source(), target));
  }
});

function workspace(context) {
  const directory = mkdtempSync(join(tmpdir(), "prisma-migration-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function byteSnapshots(context) {
  const directory = workspace(context);
  const sourceRoot = join(directory, "source-bytes");
  const destinationRoot = join(directory, "destination-bytes");
  mkdirSync(sourceRoot); mkdirSync(join(destinationRoot, "final", "media"), { recursive: true });
  const bytes = Buffer.alloc(2 * 1024 * 1024 + 24, 42);
  const input = source(); const target = destination();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  Object.assign(input.assets[0], { size: bytes.length, sha256 });
  Object.assign(target.assets[0], { size: bytes.length, sha256 });
  writeFileSync(join(sourceRoot, assetId), bytes);
  const targetPath = join(destinationRoot, "final", "media", assetId);
  writeFileSync(targetPath, bytes);
  return { directory, sourceRoot, destinationRoot, input, target, bytes, targetPath };
}

test("independent bounded snapshot reads reject corrupt bytes despite matching manifest hashes", async context => {
  const fixture = byteSnapshots(context);
  const checkpoints = [];
  const report = await verifyMigration(fixture.input, fixture.target, { ...fixture, checkpoint: report => checkpoints.push(report) });
  assert.equal(report.canSwitch, false);
  assert.equal(report.complete, true);
  assert.equal(report.entries[0].checkpoint, "destination-verified");
  assert.deepEqual(checkpoints.map(report => report.entries[0].checkpoint), ["pending", "source-verified", "destination-verified", "destination-verified"]);
  writeFileSync(fixture.targetPath, Buffer.alloc(fixture.bytes.length, 43));
  const corrupt = await verifyMigration(fixture.input, fixture.target, fixture);
  assert.equal(corrupt.entries[0].checkpoint, "blocked");
  assert.equal(corrupt.verificationCounts.blocked, 1);
  assert.equal(corrupt.entries[0].destinationBytes, null);
  rmSync(join(fixture.sourceRoot, assetId));
  const missing = await verifyMigration(fixture.input, fixture.target, fixture);
  assert.deepEqual(missing.entries[0].reasons, ["source-bytes-unverified"]);
});

test("verification bounds pilot inventory and rejects directory snapshots", async context => {
  const fixture = byteSnapshots(context);
  const input = { ...fixture.input, assets: Array.from({ length: 101 }, (_, index) => ({ ...fixture.input.assets[0], assetId: `22222222-2222-2222-2222-${String(index).padStart(12, "0")}` })) };
  await assert.rejects(verifyMigration(input, { ...fixture.target, assets: [] }, fixture), /limited to 100/);
  rmSync(join(fixture.sourceRoot, assetId)); mkdirSync(join(fixture.sourceRoot, assetId));
  const report = await verifyMigration(fixture.input, fixture.target, fixture);
  assert.equal(report.verificationCounts.blocked, 1);
});

test("a source edit between verification stages blocks reconciliation", async context => {
  const fixture = byteSnapshots(context);
  const report = await verifyMigration(fixture.input, fixture.target, { ...fixture, checkpoint: report => {
    if (report.entries[0].checkpoint === "source-verified") writeFileSync(join(fixture.sourceRoot, assetId), Buffer.alloc(fixture.bytes.length, 43));
  } });
  assert.equal(report.entries[0].checkpoint, "blocked");
  assert.equal(report.canSwitch, false);
});

test("durable verification checkpoints survive process exit and resume rechecks all bytes", async context => {
  const fixture = byteSnapshots(context);
  const path = join(fixture.directory, "checkpoints.sqlite");
  const moduleUrl = new URL("./media-migration.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { MigrationLedger, verifyMigration } from ${JSON.stringify(moduleUrl)};
    const ledger = new MigrationLedger(${JSON.stringify(path)}, {record:true});
    await verifyMigration(${JSON.stringify(fixture.input)}, ${JSON.stringify(fixture.target)}, {
      sourceRoot:${JSON.stringify(fixture.sourceRoot)}, destinationRoot:${JSON.stringify(fixture.destinationRoot)},
      checkpoint(report) { ledger.recordReport(report); if(report.entries[0].checkpoint === 'source-verified') process.exit(73); }
    });`], { encoding: "utf8" });
  assert.equal(child.status, 73, child.stderr);
  const ledger = new MigrationLedger(path, { record: true });
  try {
    const rows = ledger.database.prepare("SELECT fingerprint FROM reports ORDER BY rowid").all();
    assert.equal(rows.length, 2);
    const resume = ledger.get(rows[1].fingerprint);
    const report = await verifyMigration(fixture.input, fixture.target, { ...fixture, resume, checkpoint: report => ledger.recordReport(report) });
    assert.equal(report.entries[0].checkpoint, "destination-verified");
    const count = ledger.database.prepare("SELECT COUNT(*) AS count FROM reports").get().count;
    await verifyMigration(fixture.input, fixture.target, { ...fixture, resume, checkpoint: report => ledger.recordReport(report) });
    assert.equal(ledger.database.prepare("SELECT COUNT(*) AS count FROM reports").get().count, count);
    writeFileSync(join(fixture.sourceRoot, assetId), Buffer.alloc(fixture.bytes.length, 99));
    assert.equal((await verifyMigration(fixture.input, fixture.target, { ...fixture, resume })).entries[0].checkpoint, "blocked");
    const changed = structuredClone(fixture.input); changed.assets[0].version = "new";
    await assert.rejects(verifyMigration(changed, fixture.target, { ...fixture, resume }), /does not match/);
  } finally { ledger.close(); }
});

test("rollback reports require retained bytes and unchanged identities/context, never authorize switching", async context => {
  const fixture = byteSnapshots(context);
  const baseline = await verifyMigration(fixture.input, fixture.target, fixture);
  const report = rollbackReport(baseline, baseline);
  assert.equal(report.canRollback, false); assert.equal(report.canSwitch, false);
  assert.equal(report.entries[0].outcome, "candidate-for-authorized-restore");
  const changed = structuredClone(fixture.input); changed.assets[0].contextSha256 = "c".repeat(64);
  const current = await verifyMigration(changed, fixture.target, fixture);
  assert.equal(rollbackReport(baseline, current).entries[0].outcome, "blocked");
  const removed = await verifyMigration({ ...fixture.input, assets: [] }, { ...fixture.target, assets: [] }, fixture);
  assert.equal(rollbackReport(baseline, removed).entries[0].reason, "baseline-asset-missing");
  assert.equal(rollbackReport(removed, baseline).entries[0].outcome, "retain-current-provider");
  rmSync(join(fixture.sourceRoot, assetId));
  assert.equal(rollbackReport(baseline, await verifyMigration(fixture.input, fixture.target, fixture)).entries[0].outcome, "blocked");
  assert.throws(() => rollbackReport(planMigration(fixture.input), baseline), /completed verification/);
});

test("verification and rollback CLI are read-only by default and persist stages only explicitly", context => {
  const fixture = byteSnapshots(context);
  const input = join(fixture.directory, "source.json"); const target = join(fixture.directory, "destination.json");
  const ledger = join(fixture.directory, "migration.sqlite");
  writeFileSync(input, JSON.stringify(fixture.input)); writeFileSync(target, JSON.stringify(fixture.target));
  const executable = fileURLToPath(new URL("./media-migration.mjs", import.meta.url));
  const args = ["--source", input, "--destination", target, "--source-root", fixture.sourceRoot, "--destination-root", fixture.destinationRoot];
  const run = extra => spawnSync(process.execPath, [executable, ...args, ...extra], { encoding: "utf8" });
  const before = readdirSync(fixture.directory);
  let result = run([]); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(fixture.directory), before);
  const verified = JSON.parse(result.stdout);
  result = run(["--record", "--ledger", ledger]); assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Recorded checkpoint/);
  result = run(["--record", "--ledger", ledger, "--resume", verified.fingerprint]); assert.equal(result.status, 0, result.stderr);
  const saved = readFileSync(ledger);
  result = run(["--ledger", ledger, "--rollback-from", verified.fingerprint]); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).canRollback, false);
  assert.deepEqual(readFileSync(ledger), saved);
  writeFileSync(fixture.targetPath, Buffer.alloc(fixture.bytes.length, 0));
  assert.equal(run([]).status, 2);
  assert.equal(run(["--resume", verified.fingerprint]).status, 1);
});

test("ledger persists immutable reports, replays idempotently and appends changed evidence", context => {
  const path = join(workspace(context), "migration.sqlite");
  let ledger = new MigrationLedger(path, { record: true });
  const first = ledger.record(source(), destination());
  assert.deepEqual(ledger.record(source(), destination()), first);
  const changed = source(); changed.assets[0].version = "new-version";
  const second = ledger.record(changed, destination());
  assert.notEqual(second.fingerprint, first.fingerprint);
  assert.equal(second.counts.blocked, 1);
  assert.equal(ledger.database.prepare("SELECT COUNT(*) AS count FROM reports").get().count, 2);
  assert.throws(() => ledger.database.exec("DELETE FROM reports"), /immutable/);
  assert.throws(() => ledger.database.exec("UPDATE reports SET payload = '{}'"), /immutable/);
  ledger.close();
  ledger = new MigrationLedger(path);
  try {
    assert.deepEqual(ledger.get(first.fingerprint), first);
    assert.deepEqual(ledger.get(second.fingerprint), second);
    assert.throws(() => ledger.record(source()), /read-only/);
  } finally { ledger.close(); }
});

test("ledger rejects empty, corrupt, unrelated and future databases without resetting them", context => {
  const directory = workspace(context);
  for (const [name, content] of [["empty.sqlite", ""], ["corrupt.sqlite", "not a database"]]) {
    const path = join(directory, name); writeFileSync(path, content);
    assert.throws(() => new MigrationLedger(path, { record: true }));
    assert.equal(readFileSync(path, "utf8"), content);
  }
  for (const version of [0, 2]) {
    const path = join(directory, `version-${version}.sqlite`);
    const database = new DatabaseSync(path);
    database.exec(`CREATE TABLE unrelated (id INTEGER); PRAGMA user_version = ${version};`); database.close();
    const before = readFileSync(path);
    assert.throws(() => new MigrationLedger(path, { record: true }));
    assert.deepEqual(readFileSync(path), before);
  }
});

test("CLI defaults to read-only, records only explicitly, rejects secrets without echoing them and exposes blocked results", context => {
  const directory = workspace(context);
  const input = join(directory, "source.json"); const target = join(directory, "destination.json"); const ledger = join(directory, "migration.sqlite");
  writeFileSync(input, JSON.stringify(source())); writeFileSync(target, JSON.stringify(destination()));
  const executable = fileURLToPath(new URL("./media-migration.mjs", import.meta.url));
  const run = args => spawnSync(process.execPath, [executable, ...args], { encoding: "utf8" });
  const before = readFileSync(input);
  let result = run(["--source", input, "--destination", target]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.canSwitch, false);
  assert.deepEqual(readdirSync(directory).sort(), ["destination.json", "source.json"]);
  assert.deepEqual(readFileSync(input), before);
  assert.equal(run(["--source", input, "--ledger", ledger]).status, 1);
  result = run(["--source", input, "--destination", target, "--record", "--ledger", ledger]);
  assert.equal(result.status, 0, result.stderr);
  result = run(["--ledger", ledger, "--report", report.fingerprint]);
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), report);
  const changed = source(); changed.assets[0].sha256 = null; writeFileSync(input, JSON.stringify(changed));
  result = run(["--source", input]); assert.equal(result.status, 2); assert.equal(JSON.parse(result.stdout).counts.blocked, 1);
  writeFileSync(input, JSON.stringify({ ...source(), token: "DO-NOT-LOG-THIS" }));
  result = run(["--source", input, "--execute"]);
  assert.equal(result.status, 1); assert.ok(!`${result.stdout}${result.stderr}`.includes("DO-NOT-LOG-THIS"));
  result = run(["--source", input]);
  assert.equal(result.status, 1); assert.ok(!`${result.stdout}${result.stderr}`.includes("DO-NOT-LOG-THIS"));
});

test("report fingerprints ignore input ordering but bind store, object version and all source metadata evidence", () => {
  const input = source(); input.assets.push({ ...input.assets[0], assetId: environmentId });
  const expected = planMigration(input, destination());
  const reordered = Object.fromEntries(Object.entries({ ...input, assets: [...input.assets].reverse() }).reverse());
  assert.equal(planMigration(reordered, destination()).fingerprint, expected.fingerprint);
  for (const change of [{ storeId: environmentId }, { provider: "azure-blob" }]) {
    assert.notEqual(planMigration(input, { ...destination(), ...change }).fingerprint, expected.fingerprint);
  }
  const target = destination(); target.assets[0].version = "etag-2";
  assert.notEqual(planMigration(input, target).fingerprint, expected.fingerprint);
  target.assets.push({ ...target.assets[0], assetId: environmentId });
  assert.throws(() => planMigration(input, target), /shared/);
});

test("process exit before commit rolls back; exit after commit is recovered without duplicate ledger entries", context => {
  const path = join(workspace(context), "migration.sqlite");
  new MigrationLedger(path, { record: true }).close();
  const report = planMigration(source(), destination());
  const moduleUrl = new URL("./media-migration.mjs", import.meta.url).href;
  for (const committed of [false, true]) {
    const code = `import { MigrationLedger } from ${JSON.stringify(moduleUrl)};
      const ledger = new MigrationLedger(${JSON.stringify(path)}, {record: true});
      ${committed ? `ledger.record(${JSON.stringify(source())}, ${JSON.stringify(destination())});` : `
        ledger.database.exec('BEGIN IMMEDIATE');
        ledger.database.prepare('INSERT INTO reports (fingerprint, recorded_at, payload) VALUES (?, ?, ?)')
          .run(${JSON.stringify(report.fingerprint)}, new Date().toISOString(), ${JSON.stringify(JSON.stringify(report))});`}
      process.exit(73);`;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
    assert.equal(child.status, 73, child.stderr);
    const ledger = new MigrationLedger(path, { record: true });
    try {
      assert.deepEqual(ledger.get(report.fingerprint), committed ? report : null);
      if (committed) {
        assert.deepEqual(ledger.record(source(), destination()), report);
        assert.equal(ledger.database.prepare("SELECT COUNT(*) AS count FROM reports").get().count, 1);
      }
    } finally { ledger.close(); }
  }
});

test("tampered reports and future ledger versions fail closed without rewriting evidence", context => {
  const path = join(workspace(context), "migration.sqlite");
  const report = planMigration(source());
  const ledger = new MigrationLedger(path, { record: true });
  try {
    ledger.database.prepare("INSERT INTO reports (fingerprint, recorded_at, payload) VALUES (?, ?, ?)")
      .run(report.fingerprint, new Date().toISOString(), JSON.stringify({ ...report, canSwitch: true }));
    assert.throws(() => ledger.get(report.fingerprint), /Invalid stored report/);
    assert.throws(() => ledger.record(source()), /Invalid stored report/);
    assert.equal(ledger.database.prepare("SELECT COUNT(*) AS count FROM reports").get().count, 1);
    ledger.database.exec("PRAGMA user_version = 2");
  } finally { ledger.close(); }
  const before = readFileSync(path);
  assert.throws(() => new MigrationLedger(path, { record: true }), /supported initialized/);
  assert.deepEqual(readFileSync(path), before);
});