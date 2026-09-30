import type { Solution } from "../types";

export type SortOrder = "newest" | "oldest";
export const SORT_ORDERS: readonly SortOrder[] = ["newest", "oldest"];
export const SORT_LABELS: Record<SortOrder, string> = { newest: "Newest first", oldest: "Oldest first" };

/** When the solution was created: Dataverse `createdon`, never Modified On. The PoC mock falls back to its date added. */
function created(solution: Solution): number {
  const time = Date.parse(solution.createdOn ?? solution.dateAdded ?? "");
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Short, glanceable age for a solution ("Today", "3d", "2w", "4mo", "1yr"), paired with the full
 * creation date for the tooltip/title. Mirrors `created()`'s createdOn → dateAdded fallback so the
 * label always matches what "Newest/Oldest first" actually sorted on. Returns null with no usable date.
 */
export function solutionAge(solution: Solution): { label: string; title: string } | null {
  const time = created(solution);
  if (time === 0) return null;
  const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
  const label =
    days < 1 ? "Today"
    : days < 7 ? `${days}d`
    : days < 30 ? `${Math.floor(days / 7)}w`
    : days < 365 ? `${Math.floor(days / 30)}mo`
    : `${Math.floor(days / 365)}yr`;
  const date = new Date(time).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return { label, title: `Created ${date}` };
}

/** Sorts by creation date; ties keep their incoming order. Solutions without a date go last either way. */
export function sortSolutions(solutions: Solution[], order: SortOrder): Solution[] {
  const direction = order === "newest" ? -1 : 1;
  return solutions
    .map((solution, index) => ({ solution, index, time: created(solution) }))
    .sort((a, b) => (a.time === 0) !== (b.time === 0) ? (a.time === 0 ? 1 : -1) : (a.time - b.time) * direction || a.index - b.index)
    .map((entry) => entry.solution);
}
