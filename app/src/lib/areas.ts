import type { Solution, SpecializationArea } from "../types";
import { CAPABILITIES } from "../data/catalogueMetadata.ts";

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

/**
 * A solution's areas, derived from its capabilities: the main capability's area first (the primary area, which sets
 * the card colour), then the areas of the secondary capabilities, each once. Unknown capabilities add none.
 */
export function capabilityAreas(main: string | undefined, secondary: string[] = []): SpecializationArea[] {
  const areas = [main, ...secondary].flatMap(name => CAPABILITIES.find(capability => capability.name === name)?.area ?? []);
  return [...new Set(areas)];
}
