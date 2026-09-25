import type { Solution, SpecializationArea } from "../types";

/** Maximum specialization areas per solution. Still an open question in SchemaV2 ("Still open"); 3 is the PoC assumption. */
export const MAX_AREAS = 3;

/**
 * Every specialization area tagged on a solution (native N:N). Rows without the
 * list, such as the PoC mock catalogue, fall back to the single primary area. An
 * empty list means no area, like a solution without industries: it shows under "All" only.
 */
export function solutionAreas(solution: Pick<Solution, "specializationArea" | "specializationAreas">): SpecializationArea[] {
  return solution.specializationAreas ?? [solution.specializationArea];
}
