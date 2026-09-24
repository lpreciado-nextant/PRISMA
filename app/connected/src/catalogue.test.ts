import assert from "node:assert/strict";
import test from "node:test";
import { catalogueQuery, loadCatalogue, orderedAreas, readAll, type ReadRows } from "./catalogue.ts";
import { matchesQuery } from "../../src/lib/search.ts";

const solutionId = "11111111-1111-1111-1111-111111111111";
const areaId = "22222222-2222-2222-2222-222222222222";
const capabilityId = "33333333-3333-3333-3333-333333333333";
const record = {
  nx_solutionid: solutionId, nx_solutionname: "Fixture solution", nx_onelinesummary: "Fixture summary",
  nx_status: 125060004, nx_publicationstatus: 125060000,
  nx_safetyacknowledged: true, nx_clientsafereviewed: true,
  _nx_capability_value: capabilityId,
  nx_clientcontext: "Internal client", nx_clientcontextredacted: "Anonymous context",
  nx_searchkeywords: "Internal keyword", nx_reviewcomments: "Private feedback", nx_librarynote: "Private note",
};
const signal = () => new AbortController().signal;
function reader(overrides: object = {}): ReadRows {
  return async table => ({ success: true, data: {
    solutions: [{ ...record, ...overrides }],
    areas: [{ nx_specializationareaid: areaId, nx_specializationareaname: "ai", nx_sortordernumber: 10 }],
    capabilities: [{ nx_capabilityid: capabilityId, nx_capabilityname: "Automation" }],
    technologies: [{ nx_technologyname: "Dataverse" }],
    industries: [{ nx_industryname: "Technology" }],
  }[table] });
}

test("maps live names, numeric choices, lookups and N:N tag queries", async () => {
  const base = reader();
  const calls: Parameters<ReadRows>[] = [];
  const [result] = await loadCatalogue(async (...args) => { calls.push(args); return base(...args); }, false, signal());
  assert.equal(result.status, "Working prototype");
  assert.equal(result.specializationArea, "ai");
  assert.deepEqual(result.specializationAreas, ["ai"]);
  assert.deepEqual(result.capabilities, ["Automation"]);
  assert.deepEqual(result.technologies, ["Dataverse"]);
  assert.equal(result.clientContext, "Internal client");
  assert.equal(result.reviewComments, undefined);
  assert.equal(result.libraryNotes, undefined);
  assert.match(calls.find(([table]) => table === "technologies")![1].filter!, /nx_Solution_nx_Technology_nx_Technology\/any/);
  assert.match(calls.find(([table]) => table === "areas")![1].filter!, new RegExp(`nx_Solution_nx_SpecializationArea_nx_SpecializationArea/any.*${solutionId}`));
  assert(!catalogueQuery(false).select!.includes("_nx_specializationarea_value"));
  assert.match(calls.find(([table]) => table === "industries")![1].filter!, new RegExp(solutionId));
});

test("presentation filters on the server and projects no internal fields", async () => {
  const query = catalogueQuery(true);
  assert.match(query.filter!, /nx_publicationstatus eq 125060000/);
  assert.match(query.filter!, /nx_safetyacknowledged eq true and nx_clientsafereviewed eq true/);
  for (const field of ["nx_clientcontext", "nx_searchkeywords", "nx_reviewcomments", "nx_librarynote"]) {
    assert(!query.select!.includes(field));
  }
  const [result] = await loadCatalogue(reader(), true, signal());
  assert.equal(result.clientContext, undefined);
  assert.equal(result.searchKeywords, "");
  assert.equal(result.clientContextRedacted, "Anonymous context");
  assert(!JSON.stringify(result).includes("Private"));
  assert(!JSON.stringify(result).includes("Internal"));
});

test("multiple areas put the lowest sort order first and unmapped, duplicate or missing areas fail closed", () => {
  const area = (id: string, name: string, order: number | null) => ({ nx_specializationareaid: id, nx_specializationareaname: name, nx_sortordernumber: order });
  const data = "44444444-4444-4444-4444-444444444444";
  const ibo = "55555555-5555-5555-5555-555555555555";
  assert.deepEqual(orderedAreas([area(ibo, "ibo", 30), area(areaId, "ai", 10), area(data, "data", 20)]), ["ai", "data", "ibo"]);
  assert.deepEqual(orderedAreas([area(areaId, "ai", null), area(data, "data", 20)]), ["data", "ai"]);
  assert.throws(() => orderedAreas([]), /no specialization area/);
  assert.throws(() => orderedAreas([area(areaId, "other", 10)]), /unmapped/);
  assert.throws(() => orderedAreas([area(areaId, "ai", 10), area(data, "ai", 20)]), /duplicate/);
});

test("unknown choices, missing lookups and out-of-filter records fail closed", async () => {
  for (const overrides of [{ nx_status: 99 }, { _nx_capability_value: areaId }, { nx_publicationstatus: 125060003 }, { nx_clientsafereviewed: null }, { nx_clientsafereviewed: false }]) {
    await assert.rejects(loadCatalogue(reader(overrides), true, signal()));
  }
});

test("reads every page, preserves the query, and rejects repeated continuation tokens", async () => {
  const calls: Parameters<ReadRows>[] = [];
  const rows = await readAll(async (...args) => {
    calls.push(args);
    return { success: true, data: [{ page: calls.length }], skipToken: calls.length === 1 ? "next" : undefined };
  }, "solutions", catalogueQuery(true), signal());
  assert.equal(rows.length, 2);
  assert.equal(calls[1][1].skipToken, "next");
  assert.equal(calls[1][1].filter, calls[0][1].filter);
  await assert.rejects(readAll(async () => ({ success: true, data: [], skipToken: "same" }), "solutions", {}, signal()), /repeated/);
});

test("permission/network failures are not treated as an empty catalogue", async () => {
  await assert.rejects(loadCatalogue(async () => ({ success: false, data: [] }), false, signal()), /Unable to read/);
  await assert.rejects(loadCatalogue(async () => { throw new Error("Offline"); }, false, signal()), /Offline/);
  assert.deepEqual(await loadCatalogue(async () => ({ success: true, data: [] }), false, signal()), []);
});

test("cancellation discards late results without requesting further pages", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(readAll(async () => {
    calls++;
    controller.abort();
    return { success: true, data: [record], skipToken: "next" };
  }, "solutions", {}, controller.signal), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("authorized contributor names are searchable and late credits are discarded", async () => {
  const [solution] = await loadCatalogue(reader(), true, signal(), async (id, present) => { assert.equal(id, solutionId); assert.equal(present, true); return ["Fixture Builder"]; });
  assert.equal(matchesQuery(solution, "Builder"), true);
  assert.equal(matchesQuery(solution, "Internal client"), false);
  const controller = new AbortController();
  await assert.rejects(loadCatalogue(reader(), false, controller.signal, async () => { controller.abort(); return ["Late Builder"]; }), { name: "AbortError" });
});

test("catalogue hydration is bounded and preserves source order", async () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ ...record, nx_solutionid: `11111111-1111-1111-1111-${String(index + 1).padStart(12, "0")}`, nx_solutionname: `Fixture ${index}` }));
  const base = reader();
  let active = 0;
  let maximum = 0;
  const read: ReadRows = async (table, options) => {
    if (table === "solutions") return { success: true, data: rows };
    if (table !== "technologies" && table !== "industries") return base(table, options);
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return base(table, options);
  };
  const result = await loadCatalogue(read, false, signal(), async () => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return ["Builder"];
  });
  assert.equal(maximum, 12);
  assert.equal(active, 0);
  assert.deepEqual(result.map(item => item.id), rows.map(row => row.nx_solutionid));
});

test("a failed hydration batch cancels siblings and never starts the next batch", async () => {
  const rows = Array.from({ length: 8 }, (_, index) => ({ ...record, nx_solutionid: `11111111-1111-1111-1111-${String(index + 1).padStart(12, "0")}` }));
  const base = reader();
  const seen: string[] = [];
  let batchSignal: AbortSignal | undefined;
  await assert.rejects(loadCatalogue(async (table, options) => table === "solutions" ? { success: true, data: rows } : base(table, options), true, signal(), async (id, _present, currentSignal) => {
    seen.push(id); batchSignal = currentSignal;
    if (id === rows[0].nx_solutionid) throw new Error("Credit access denied");
    await new Promise(resolve => setImmediate(resolve));
    currentSignal.throwIfAborted();
    return ["Builder"];
  }), /Credit access denied/);
  assert.equal(seen.length, 4);
  assert.equal(batchSignal?.aborted, true);
});