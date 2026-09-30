import test from "node:test";
import assert from "node:assert/strict";
import { createPublishedDetails } from "./publishedDetails.ts";

const id = "4b7a3f2e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const result = (data: unknown) => ({ success: true, data: { ResultJson: JSON.stringify(data) } });
const detail = (projects: string[] = []) => result({ id, rowVersion: "1", contributors: [], totalHours: 0, projects, media: [] });

test("published details share in-flight and recent reads per projection", async () => {
  let clock = 0;
  const calls: boolean[] = [];
  const details = createPublishedDetails(async (_id, present) => { calls.push(present); return detail(present ? [] : ["Internal project"]); }, 1000, 10, () => clock);
  const [first, second] = await Promise.all([details.load(id, false), details.load(id, false)]);
  assert.equal(first, second);
  assert.deepEqual(calls, [false]);
  assert.deepEqual(details.peek(id, false)?.projects, ["Internal project"]);
  // Present mode never reuses the internal projection.
  assert.equal(details.peek(id, true), undefined);
  assert.deepEqual((await details.load(id, true)).projects, []);
  clock = 1000;
  await details.load(id, false);
  assert.deepEqual(calls, [false, true, false]);
});

test("published details refresh always reads and forget failures", async () => {
  let fail = false;
  let calls = 0;
  const details = createPublishedDetails(async () => { calls++; if (fail) throw new Error("Access denied"); return detail(); });
  await details.load(id, false);
  await details.refresh(id, false);
  assert.equal(calls, 2);
  fail = true;
  await assert.rejects(details.refresh(id, false), /Access denied/);
  assert.equal(details.peek(id, false), undefined);
  fail = false;
  await details.load(id, false);
  assert.equal(calls, 4);
});

test("published details reject an invalid projection without caching it", async () => {
  const details = createPublishedDetails(async () => result({ id, rowVersion: "1", contributors: [], totalHours: 0, projects: [], media: [], libraryNotes: "Internal" }));
  await assert.rejects(details.load(id, true), /projection/);
  assert.equal(details.peek(id, true), undefined);
});

test("published details stay bounded", async () => {
  const other = "5b7a3f2e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
  const details = createPublishedDetails(async requested => result({ id: requested, rowVersion: "1", contributors: [], totalHours: 0, projects: [], media: [] }), 1000, 1);
  await details.load(id, false);
  await details.load(other, false);
  assert.equal(details.peek(id, false), undefined);
  assert.equal(details.peek(other, false)?.id, other);
});
