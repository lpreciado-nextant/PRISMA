import assert from "node:assert/strict";
import test from "node:test";
import { readKept, replaceTechnology, writeKept } from "./technologyDuplicates.ts";
import type { DraftGraph } from "./draftGraph.ts";

const id = (value: number) => `${String(value).padStart(8, "0")}-0000-0000-0000-000000000000`;
const graph = (technologyIds: string[]): DraftGraph => ({ contributors: [{ id: id(90), personId: id(91) }], technologyIds, industryIds: [id(80)], projectIds: [], areaIds: [id(70)], clientRoleIds: [], secondaryCapabilityIds: [] });

test("use existing swaps the submitted technology in place and keeps the rest of the graph", () => {
  const next = replaceTechnology(graph([id(1), id(2), id(3)]), id(2), id(9));
  assert.deepEqual(next?.technologyIds, [id(1), id(9), id(3)]);
  assert.deepEqual(next?.industryIds, [id(80)]);
  assert.deepEqual(next?.contributors, [{ id: id(90), personId: id(91) }]);
});

test("use existing only removes the submitted technology when the existing one is already linked", () => {
  assert.deepEqual(replaceTechnology(graph([id(1), id(2), id(9)]), id(2), id(9))?.technologyIds, [id(1), id(9)]);
  assert.deepEqual(replaceTechnology(graph([id(1), id(2), id(9).toUpperCase()]), id(2).toUpperCase(), id(9))?.technologyIds, [id(1), id(9).toUpperCase()]);
});

test("use existing does nothing when the submitted technology is gone or is the existing one", () => {
  assert.equal(replaceTechnology(graph([id(1)]), id(2), id(9)), undefined);
  assert.equal(replaceTechnology(graph([id(2)]), id(2), id(2)), undefined);
});

test("kept technologies are remembered per solution and survive bad storage", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
  writeKept(storage, "ABC", ["Power-BI", "Power-BI", "OpenAI on Azure"]);
  writeKept(storage, "def", ["Kubernetes"]);
  assert.deepEqual(readKept(storage, "abc"), ["Power-BI", "OpenAI on Azure"]);
  writeKept(storage, "abc", []);
  assert.deepEqual(readKept(storage, "abc"), []);
  assert.deepEqual(readKept(storage, "def"), ["Kubernetes"]);
  values.set("prisma.connected.kept-technologies", "not json");
  assert.deepEqual(readKept(storage, "def"), []);
  const failing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(readKept(failing, "def"), []);
  assert.doesNotThrow(() => writeKept(failing, "def", ["Kubernetes"]));
});
