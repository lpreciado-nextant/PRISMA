import assert from "node:assert/strict";
import test from "node:test";
import { sortSolutions } from "./sort.ts";
import type { Solution } from "../types.ts";

const solution = (id: string, createdOn?: string, dateAdded = "") => ({ id, createdOn, dateAdded }) as Solution;
const ids = (list: Solution[]) => list.map((entry) => entry.id);

test("sorts by created on, newest or oldest first", () => {
  const list = [solution("b", "2026-05-02T10:00:00Z"), solution("a", "2026-01-15T10:00:00Z"), solution("c", "2026-09-20T10:00:00Z")];
  assert.deepEqual(ids(sortSolutions(list, "newest")), ["c", "b", "a"]);
  assert.deepEqual(ids(sortSolutions(list, "oldest")), ["a", "b", "c"]);
  assert.deepEqual(ids(list), ["b", "a", "c"]);
});

test("falls back to date added, keeps ties stable and puts undated solutions last", () => {
  const list = [solution("undated"), solution("same-1", "2026-03-01"), solution("mock", undefined, "2026-06-01"), solution("same-2", "2026-03-01")];
  assert.deepEqual(ids(sortSolutions(list, "newest")), ["mock", "same-1", "same-2", "undated"]);
  assert.deepEqual(ids(sortSolutions(list, "oldest")), ["same-1", "same-2", "mock", "undated"]);
});
