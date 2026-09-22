import type { BusinessCalendar, SolutionContributor, SolutionStatus } from "../types";

const DAY_MS = 86_400_000;

export function usBusinessCalendar(startYear: number, endYear: number): BusinessCalendar {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear < 2020 || endYear > 2035 || endYear < startYear) throw new Error("Effort dates must be within 2020-2035.");
  const holidays: string[] = [];
  const observed = (year: number, month: number, day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + (weekday === 6 ? -1 : weekday === 0 ? 1 : 0));
    holidays.push(date.toISOString().slice(0, 10));
  };
  const nth = (year: number, month: number, weekday: number, ordinal: number) => {
    const date = new Date(Date.UTC(year, month - 1, 1));
    date.setUTCDate(1 + (weekday - date.getUTCDay() + 7) % 7 + (ordinal - 1) * 7);
    holidays.push(date.toISOString().slice(0, 10));
  };
  for (let year = startYear - 1; year <= endYear + 1; year++) {
    observed(year, 1, 1);
    nth(year, 1, 1, 3);
    nth(year, 2, 1, 3);
    const memorial = new Date(Date.UTC(year, 4, 31));
    memorial.setUTCDate(31 - (memorial.getUTCDay() + 6) % 7);
    holidays.push(memorial.toISOString().slice(0, 10));
    if (year >= 2021) observed(year, 6, 19);
    observed(year, 7, 4);
    nth(year, 9, 1, 1);
    nth(year, 10, 1, 2);
    observed(year, 11, 11);
    nth(year, 11, 4, 4);
    observed(year, 12, 25);
  }
  return { id: "us-federal", name: "US business calendar", startDate: `${startYear}-01-01`, endDate: `${endYear}-12-31`, holidays };
}

export function usesDirectHours(status: SolutionStatus): boolean {
  return status === "Idea / concept" || status === "Working prototype";
}

function dateValue(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid start and end date.");
  }
  return timestamp;
}

export function calculateEffort(
  contributor: SolutionContributor,
  calendar: BusinessCalendar | undefined,
): { businessDays: number; hours: number } {
  if (contributor.effortMode === "direct") {
    const hours = contributor.directHours;
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0) {
      throw new Error("Enter hours of zero or more.");
    }
    if (Math.abs(hours * 100 - Math.round(hours * 100)) > 0.0000001) {
      throw new Error("Hours must have at most two decimal places.");
    }
    return { businessDays: 0, hours };
  }
  if (!calendar || calendar.id !== contributor.calendarId) {
    throw new Error("Select a business calendar.");
  }
  const start = dateValue(contributor.startDate);
  const end = dateValue(contributor.endDate);
  if (end < start) throw new Error("End date must be on or after start date.");
  if (start < dateValue(calendar.startDate) || end > dateValue(calendar.endDate)) {
    throw new Error("Dates must be within the selected calendar's coverage.");
  }
  if (!Number.isFinite(contributor.allocation) || contributor.allocation < 0 || contributor.allocation > 100) {
    throw new Error("Allocation must be between 0 and 100%.");
  }
  if (Math.abs(contributor.allocation * 100 - Math.round(contributor.allocation * 100)) > 0.0000001) {
    throw new Error("Allocation must have at most two decimal places.");
  }
  const days = (end - start) / DAY_MS + 1;
  let businessDays = Math.floor(days / 7) * 5;
  for (let offset = 0; offset < days % 7; offset++) {
    const weekday = new Date(start + offset * DAY_MS).getUTCDay();
    if (weekday !== 0 && weekday !== 6) businessDays++;
  }
  for (const holiday of new Set(calendar.holidays)) {
    const timestamp = dateValue(holiday);
    const weekday = new Date(timestamp).getUTCDay();
    if (timestamp >= start && timestamp <= end && weekday !== 0 && weekday !== 6) businessDays--;
  }
  return { businessDays, hours: Math.round(businessDays * 8 * contributor.allocation) / 100 };
}