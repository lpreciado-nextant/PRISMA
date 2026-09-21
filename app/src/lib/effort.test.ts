import { strict as assert } from "node:assert";
import { test } from "node:test";
import { calculateEffort } from "./effort.ts";
import type { BusinessCalendar, SolutionContributor } from "../types.ts";
import { BUSINESS_CALENDARS, DEFAULT_BUSINESS_CALENDAR_ID, SOLUTIONS } from "../data/solutions.ts";
import { matchesQuery } from "./search.ts";

const calendar: BusinessCalendar = {
  id: "test", name: "Test calendar", startDate: "2026-01-01", endDate: "2026-12-31",
  holidays: ["2026-09-07", "2026-09-07", "2026-09-12"],
};
const contributor: SolutionContributor = {
  id: "contribution", builtBy: { id: "person", name: "Test Person", email: "test@example.com" },
  startDate: "2026-09-07", endDate: "2026-09-18", allocation: 50, calendarId: "test",
};

test("inclusive weekdays exclude unique holidays, not weekends twice", () => {
  assert.deepEqual(calculateEffort(contributor, calendar), { businessDays: 9, hours: 36 });
});

test("same-day work, weekend-only ranges, and zero allocation", () => {
  assert.equal(calculateEffort({ ...contributor, startDate: "2026-09-18" }, calendar).hours, 4);
  assert.equal(calculateEffort({ ...contributor, startDate: "2026-09-12", endDate: "2026-09-13" }, calendar).hours, 0);
  assert.equal(calculateEffort({ ...contributor, allocation: 0 }, calendar).hours, 0);
  assert.equal(calculateEffort({ ...contributor, allocation: 100 }, calendar).hours, 72);
  assert.equal(calculateEffort({ ...contributor, allocation: 33.33 }, calendar).hours, 24);
});

test("reject invalid dates, reversed ranges, missing coverage, and invalid allocation", () => {
  for (const startDate of ["", "2026-02-30", "2026-9-01", "2026-09-19", "2025-12-31"]) {
    assert.throws(() => calculateEffort({ ...contributor, startDate }, calendar));
  }
  for (const allocation of [-1, 101, NaN, Infinity, 33.333]) {
    assert.throws(() => calculateEffort({ ...contributor, allocation }, calendar));
  }
  assert.throws(() => calculateEffort(contributor, undefined));
  assert.throws(() => calculateEffort(contributor, { ...calendar, id: "other" }));
  assert.throws(() => calculateEffort({ ...contributor, endDate: "2027-01-01" }, calendar));
});

test("date-only arithmetic is stable across DST and leap days", () => {
  const leapCalendar = { ...calendar, startDate: "2024-01-01", holidays: [] };
  assert.deepEqual(calculateEffort({ ...contributor, startDate: "2024-02-28", endDate: "2024-03-01" }, leapCalendar), { businessDays: 3, hours: 12 });
  assert.deepEqual(calculateEffort({ ...contributor, startDate: "2026-03-06", endDate: "2026-03-09" }, calendar), { businessDays: 2, hours: 8 });
});

test("all mock contributions are valid and secondary builders are searchable", () => {
  for (const solution of SOLUTIONS) {
    assert(solution.contributors.length > 0);
    assert.equal(new Set(solution.contributors.map((entry) => entry.builtBy.id)).size, solution.contributors.length);
    for (const entry of solution.contributors) {
      assert.equal(entry.calendarId, DEFAULT_BUSINESS_CALENDAR_ID);
      assert(calculateEffort(entry, BUSINESS_CALENDARS.find((item) => item.id === entry.calendarId)).hours >= 0);
    }
  }
  const solution = SOLUTIONS.find((entry) => entry.id === "bso-quota")!;
  assert(matchesQuery(solution, "Luis David Preciado"));
  assert.equal(solution.contributors.reduce((total, entry) => total + calculateEffort(entry, BUSINESS_CALENDARS.find((item) => item.id === entry.calendarId)).hours, 0), 218);
});

test("each selected calendar controls holidays at inclusive boundaries", () => {
  const entry = { ...contributor, startDate: "2026-09-07", endDate: "2026-09-07", allocation: 100 };
  assert.equal(calculateEffort(entry, calendar).hours, 0);
  assert.equal(calculateEffort(entry, { ...calendar, holidays: [] }).hours, 8);
  assert.deepEqual(calculateEffort({ ...entry, startDate: "2026-09-04" }, calendar), { businessDays: 1, hours: 8 });
});

test("US default excludes all 2026 federal holidays and observed Independence Day", () => {
  assert.equal(BUSINESS_CALENDARS.length, 1);
  const usCalendar = BUSINESS_CALENDARS.find((entry) => entry.id === DEFAULT_BUSINESS_CALENDAR_ID);
  assert(usCalendar);
  assert.equal(usCalendar.id, "us-federal-2026");
  assert.deepEqual(usCalendar.holidays, [
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25",
    "2026-06-19", "2026-07-03", "2026-09-07", "2026-10-12",
    "2026-11-11", "2026-11-26", "2026-12-25",
  ]);
  const entry = { ...contributor, calendarId: usCalendar.id, allocation: 100 };
  assert.deepEqual(calculateEffort({ ...entry, startDate: "2026-07-02", endDate: "2026-07-06" }, usCalendar), { businessDays: 2, hours: 16 });
  assert.deepEqual(calculateEffort({ ...entry, startDate: "2026-01-01", endDate: "2026-12-31" }, usCalendar), { businessDays: 250, hours: 2000 });
});