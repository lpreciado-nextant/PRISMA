import type { DraftGraph } from "./draftGraph";
export type { DuplicateDecision } from "../../src/components/DuplicateTechnologies";

/**
 * The graph with the submitted technology swapped for the existing one. When the solution already carries the
 * existing technology, the submitted one is only removed. `undefined` when the submitted one is no longer linked.
 */
export function replaceTechnology(graph: DraftGraph, submittedId: string, existingId: string): DraftGraph | undefined {
  const submitted = submittedId.toLowerCase();
  const existing = existingId.toLowerCase();
  if (submitted === existing || !graph.technologyIds.some(id => id.toLowerCase() === submitted)) return undefined;
  const technologyIds = graph.technologyIds.flatMap(id => id.toLowerCase() !== submitted ? [id]
    : graph.technologyIds.some(other => other.toLowerCase() === existing) ? [] : [existingId]);
  return { ...graph, technologyIds };
}

const KEPT_KEY = "prisma.connected.kept-technologies";

/**
 * "Keep submitted" changes no data, so it is remembered in this browser only (solution ID → technology names), and the
 * warning stays resolved when the librarian reopens the review here. Unavailable storage just forgets it.
 */
export function readKept(storage: Pick<Storage, "getItem">, solutionId: string): string[] {
  try {
    const all = JSON.parse(storage.getItem(KEPT_KEY) ?? "{}") as unknown;
    const names = all && typeof all === "object" ? (all as Record<string, unknown>)[solutionId.toLowerCase()] : undefined;
    return Array.isArray(names) ? names.filter((name): name is string => typeof name === "string") : [];
  } catch { return []; }
}

export function writeKept(storage: Pick<Storage, "getItem" | "setItem">, solutionId: string, names: readonly string[]) {
  try {
    const parsed = JSON.parse(storage.getItem(KEPT_KEY) ?? "{}") as unknown;
    const all = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    const key = solutionId.toLowerCase();
    if (names.length) all[key] = [...new Set(names)]; else delete all[key];
    storage.setItem(KEPT_KEY, JSON.stringify(all));
  } catch { void 0; }
}
