import type { Solution, SpecializationArea } from "../types";

/** Maximum specialization areas per solution. Still an open question in SchemaV2 ("Still open"); 3 is the PoC assumption. */
export const MAX_AREAS = 3;

/**
 * Every specialization area tagged on a solution (native N:N). Rows without the
 * list, such as the connected catalogue, fall back to the single primary area.
 */
export function solutionAreas(solution: Pick<Solution, "specializationArea" | "specializationAreas">): SpecializationArea[] {
  return solution.specializationAreas?.length ? solution.specializationAreas : [solution.specializationArea];
}
