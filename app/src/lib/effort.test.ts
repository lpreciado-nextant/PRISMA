import { strict as assert } from "node:assert";
import { test } from "node:test";
import { contributorHours, MAX_CONTRIBUTOR_HOURS } from "./effort.ts";
import { SOLUTIONS } from "../data/solutions.ts";
import { matchesQuery } from "./search.ts";

test("every maturity takes the minimum hours each person needed, with no allocation", () => {
  for (const hours of [0, 0.25, 5, 12.34, MAX_CONTRIBUTOR_HOURS]) assert.equal(contributorHours(hours), hours);
});

test("reject missing, negative, non-finite, oversized and over-precise hours", () => {
  for (const hours of [undefined, null, -1, NaN, Infinity, MAX_CONTRIBUTOR_HOURS + 1, 1.234]) {
    assert.throws(() => contributorHours(hours));
  }
});

test("all mock contributions are valid and secondary builders are searchable", () => {
  for (const solution of SOLUTIONS) {
    assert(solution.contributors.length > 0);
    assert.equal(new Set(solution.contributors.map((entry) => entry.builtBy.id)).size, solution.contributors.length);
    for (const entry of solution.contributors) {
      assert.deepEqual(Object.keys(entry).filter((key) => ["startDate", "endDate", "allocation", "calendarId", "effortMode"].includes(key)), []);
      assert(contributorHours(entry.directHours) >= 0);
    }
  }
  const solution = SOLUTIONS.find((entry) => entry.id === "bso-quota")!;
  assert(matchesQuery(solution, "Luis David Preciado"));
  assert.equal(solution.contributors.reduce((total, entry) => total + contributorHours(entry.directHours), 0), 218);
});
