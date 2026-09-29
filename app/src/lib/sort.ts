import type { Solution } from "../types";

export type SortOrder = "newest" | "oldest";
export const SORT_ORDERS: readonly SortOrder[] = ["newest", "oldest"];
export const SORT_LABELS: Record<SortOrder, string> = { newest: "Newest first", oldest: "Oldest first" };

/** When the solution was created: Dataverse `createdon`, never Modified On. The PoC mock falls back to its date added. */
function created(solution: Solution): number {
  const time = Date.parse(solution.createdOn ?? solution.dateAdded ?? "");
  return Number.isNaN(time) ? 0 : time;
}

/** Sorts by creation date; ties keep their incoming order. Solutions without a date go last either way. */
export function sortSolutions(solutions: Solution[], order: SortOrder): Solution[] {
  const direction = order === "newest" ? -1 : 1;
  return solutions
    .map((solution, index) => ({ solution, index, time: created(solution) }))
    .sort((a, b) => (a.time === 0) !== (b.time === 0) ? (a.time === 0 ? 1 : -1) : (a.time - b.time) * direction || a.index - b.index)
    .map((entry) => entry.solution);
}
