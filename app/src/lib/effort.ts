import type { Complexity } from "../types.ts";

/** Upper bound shared with the plug-in's `DraftPolicy.MaxEstimatedHours` and `nx_estimatedminimumhours`. */
export const MAX_ESTIMATED_HOURS = 100_000;

/** `nx_complexity` choice values, in the order the form offers them. */
export const COMPLEXITIES: readonly { value: Complexity; choice: number; hint: string }[] = [
  { value: "Easy", choice: 125060000, hint: "Familiar work, few unknowns." },
  { value: "Medium", choice: 125060001, hint: "Some new ground or integration work." },
  { value: "Hard", choice: 125060002, hint: "New territory, many moving parts." },
];
export const COMPLEXITY_BY_CHOICE: Record<number, Complexity> = Object.fromEntries(COMPLEXITIES.map(option => [option.choice, option.value]));

/**
 * Validates the solution's estimated minimum hours: a whole-number estimate of the least time the whole solution took,
 * including preparation and discovery. Optional, so blank is undefined. Throws a user-facing message otherwise.
 */
export function estimatedHours(hours: number | null | undefined): number | undefined {
  if (hours === null || hours === undefined) return undefined;
  if (!Number.isInteger(hours) || hours < 0) throw new Error("Enter whole hours of zero or more.");
  if (hours > MAX_ESTIMATED_HOURS) throw new Error(`Enter at most ${MAX_ESTIMATED_HOURS.toLocaleString("en-US")} hours.`);
  return hours;
}

/** "~120 h · Medium", or the parts that exist. Internal only: never shown in present mode or exported. */
export function effortSummary(hours: number | undefined, complexity: Complexity | undefined): string {
  return [hours === undefined ? undefined : `~${hours.toLocaleString("en-US")} h`, complexity].filter(Boolean).join(" · ") || "Not estimated";
}
