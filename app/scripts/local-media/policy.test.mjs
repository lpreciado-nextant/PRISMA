import test from "node:test";
import assert from "node:assert/strict";
import { assertEditable, assertRead, assertResume, rangeLength, validateFile, MAX_SIZE, RANGE_SIZE } from "./policy.mjs";

const draft = { owner: "builder", version: 1, status: "draft", safe: false };
const file = { name: "fixture.mp4", size: 32, sha256: "a".repeat(64) };

test("local owner edits require Draft and the exact version", () => {
  assertEditable(draft, "builder", "1");
  assert.throws(() => assertEditable(draft, "other-builder", "1"), /owner/);
  assert.throws(() => assertEditable(draft, "builder", "0"), /Version/);
  assert.throws(() => assertEditable({ ...draft, status: "published" }, "builder", "1"), /owner/);
});

test("read modes fail closed for drafts, withdrawn assets and unknown identities", () => {
  assertRead(draft, "builder", "submission");
  assertRead(draft, "librarian", "submission");
  assert.throws(() => assertRead(draft, "reader", "submission"), /denied/);
  assert.throws(() => assertRead(draft, "builder", "present"), /unavailable/);
  assert.throws(() => assertRead(draft, "unknown", "submission"), /identity/);
  assert.throws(() => assertRead(draft, "builder", "anything"), /mode/);
  const published = { ...draft, status: "published" };
  assertRead(published, "reader", "published");
  assert.throws(() => assertRead(published, "reader", "present"), /cleared/);
  assertRead({ ...published, safe: true }, "reader", "present");
  assert.throws(() => assertRead({ ...published, status: "draft" }, "reader", "published"), /unavailable/);
});

test("resume binds name, size, digest and exact expiry", () => {
  const session = { ...file, complete: false, expires: 100 };
  assertResume(session, file, 99);
  for (const changed of [{ name: "other.mp4" }, { size: 33 }, { sha256: "b".repeat(64) }]) {
    assert.throws(() => assertResume(session, { ...file, ...changed }, 99), /exact file/);
  }
  assert.throws(() => assertResume(session, file, 100), /expired/);
  assert.throws(() => assertResume({ ...session, complete: true }, file, 99), /complete/);
});

test("file and range limits are enforced server-side", () => {
  validateFile({ ...file, size: MAX_SIZE });
  for (const changed of [{ name: "../fixture.mp4" }, { name: "fixture.exe" }, { size: MAX_SIZE + 1 }, { size: NaN }, { sha256: "A".repeat(64) }]) {
    assert.throws(() => validateFile({ ...file, ...changed }));
  }
  assert.equal(rangeLength(8, RANGE_SIZE, 12), 4);
  for (const [offset, count] of [[-1, 1], [12, 1], [0, RANGE_SIZE + 1], [0, 0], [0.5, 1]]) {
    assert.throws(() => rangeLength(offset, count, 12), /range/);
  }
});

test("documents and HTML derive their types and retain the 25 MiB limit", () => {
  for (const [extension, mime] of [["html", "text/html"], ["htm", "text/html"], ["pdf", "application/pdf"],
    ["ppt", "application/vnd.ms-powerpoint"], ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]]) {
    assert.equal(validateFile({ ...file, name: `fixture.${extension}`, size: 25 * 1024 * 1024 }).mime, mime);
    assert.throws(() => validateFile({ ...file, name: `fixture.${extension}`, size: 25 * 1024 * 1024 + 1 }), /limit/);
  }
  for (const name of ["fixture.html\n", "../fixture.pdf", "fixture.svg", "fixture.pptm", "fixture.docx"]) assert.throws(() => validateFile({ ...file, name }));
});