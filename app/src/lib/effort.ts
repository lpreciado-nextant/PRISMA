/** Upper bound shared with the plug-in's `ContributorPolicy`. */
export const MAX_CONTRIBUTOR_HOURS = 1_000_000_000;

/**
 * Validates one person's hours: the minimum time they needed to work on the solution,
 * entered directly at every maturity. Returns the hours or throws a user-facing message.
 */
export function contributorHours(hours: number | null | undefined): number {
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0) {
    throw new Error("Enter hours of zero or more.");
  }
  if (hours > MAX_CONTRIBUTOR_HOURS) throw new Error("Hours exceed the supported limit.");
  if (Math.abs(hours * 100 - Math.round(hours * 100)) > 0.0000001) {
    throw new Error("Hours must have at most two decimal places.");
  }
  return hours;
}
