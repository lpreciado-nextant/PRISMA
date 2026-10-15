import { strict as assert } from "node:assert";
import { test } from "node:test";
import { COMPLEXITIES, COMPLEXITY_BY_CHOICE, effortSummary, estimatedHours, MAX_ESTIMATED_HOURS } from "./effort.ts";
import { SOLUTIONS } from "../data/solutions.ts";
import { matchesQuery } from "./search.ts";

test("the solution's estimate is optional whole hours within range", () => {
  for (const hours of [0, 1, 120, MAX_ESTIMATED_HOURS]) assert.equal(estimatedHours(hours), hours);
  assert.equal(estimatedHours(undefined), undefined);
  assert.equal(estimatedHours(null), undefined);
});

test("reject negative, fractional, non-finite and oversized estimates", () => {
  for (const hours of [-1, 1.5, NaN, Infinity, MAX_ESTIMATED_HOURS + 1]) assert.throws(() => estimatedHours(hours));
});

test("complexity maps to the live nx_complexity choice values and summarizes with the estimate", () => {
  assert.deepEqual(COMPLEXITIES.map(option => [option.value, option.choice]), [["Easy", 125060000], ["Medium", 125060001], ["Hard", 125060002]]);
  assert.equal(COMPLEXITY_BY_CHOICE[125060001], "Medium");
  assert.equal(effortSummary(120, "Medium"), "~120 h · Medium");
  assert.equal(effortSummary(undefined, "Hard"), "Hard");
  assert.equal(effortSummary(1200, undefined), "~1,200 h");
  assert.equal(effortSummary(undefined, undefined), "Not estimated");
});

test("mock solutions carry solution-level effort, no per-person hours, and searchable secondary builders", () => {
  for (const solution of SOLUTIONS) {
    assert(solution.contributors.length > 0);
    assert.equal(new Set(solution.contributors.map((entry) => entry.builtBy.id)).size, solution.contributors.length);
    assert(solution.complexity && COMPLEXITIES.some(option => option.value === solution.complexity), solution.id);
    assert.equal(estimatedHours(solution.estimatedMinimumHours), solution.estimatedMinimumHours);
    for (const entry of solution.contributors) {
      assert.deepEqual(Object.keys(entry).filter((key) => ["directHours", "startDate", "endDate", "allocation", "calendarId", "effortMode"].includes(key)), []);
    }
  }
  const solution = SOLUTIONS.find((entry) => entry.id === "bso-quota")!;
  assert(matchesQuery(solution, "Luis David Preciado"));
  assert.equal(solution.estimatedMinimumHours, 218);
  assert.equal(solution.complexity, "Hard");
});
