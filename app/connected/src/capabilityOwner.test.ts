import assert from "node:assert/strict";
import test from "node:test";
import { loadCapabilityOwner, resetCapabilityOwners } from "./capabilityOwner.ts";
import type { ReadRows } from "./catalogue.ts";

const ownerId = "44444444-4444-4444-4444-444444444444";
const capabilities = [
  { nx_capabilityname: "Data Engineering", _nx_capabilityowner_value: ownerId },
  { nx_capabilityname: "Automation", _nx_capabilityowner_value: null },
];

test("capability owner comes from nx_capability.nx_capabilityowner, never a stand-in", async () => {
  resetCapabilityOwners();
  const calls: [string, unknown][] = [];
  const read: ReadRows = async (table, options) => {
    calls.push([table, options]);
    if (table === "capabilities") return { success: true, data: capabilities };
    return { success: true, data: [{ cr6b0_consultantname: " Marta Ruiz ", cr6b0_email: "marta@nextant.com" }] };
  };
  const signal = new AbortController().signal;
  assert.deepEqual(await loadCapabilityOwner(read, "Data Engineering", signal), { name: "Marta Ruiz", email: "marta@nextant.com" });
  assert.equal(await loadCapabilityOwner(read, "Automation", signal), null);
  assert.equal(await loadCapabilityOwner(read, "Unknown capability", signal), undefined);
  // The capability list is read once; the owner is read by id, active consultants only.
  assert.equal(calls.filter(([table]) => table === "capabilities").length, 1);
  assert.match(JSON.stringify(calls.find(([table]) => table === "people")?.[1]), new RegExp(`cr6b0_consultantid eq ${ownerId} and statecode eq 0`));
});

test("a caller that unmounts does not cancel the shared read for the one still waiting (StrictMode)", async () => {
  resetCapabilityOwners();
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const read: ReadRows = async (table) => {
    if (table === "capabilities") { await gate; return { success: true, data: capabilities }; }
    return { success: true, data: [{ cr6b0_consultantname: "Marta Ruiz" }] };
  };
  const first = new AbortController();
  const abandoned = loadCapabilityOwner(read, "Data Engineering", first.signal);
  first.abort();
  const second = loadCapabilityOwner(read, "Data Engineering", new AbortController().signal);
  release();
  await assert.rejects(abandoned);
  assert.deepEqual(await second, { name: "Marta Ruiz" });
});

test("an inactive or missing owner is unknown, and a failed read can be retried", async () => {
  resetCapabilityOwners();
  let fail = true;
  const read: ReadRows = async (table) => {
    if (table === "capabilities") { if (fail) throw new Error("denied"); return { success: true, data: capabilities }; }
    return { success: true, data: [] };
  };
  const signal = new AbortController().signal;
  await assert.rejects(loadCapabilityOwner(read, "Data Engineering", signal));
  fail = false;
  assert.equal(await loadCapabilityOwner(read, "Data Engineering", signal), undefined);
});