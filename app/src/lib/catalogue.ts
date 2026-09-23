import type { Solution } from "../types";

export function presentCatalogue(solutions: Solution[]): Solution[] {
  return solutions.filter((solution) => solution.publicationStatus === "Published" && solution.safetyAcknowledged && solution.clientSafeReviewed)
    .map((solution) => ({
      ...solution,
      clientContext: undefined,
      // Builder credit, effort, cost and Lead CSM are internal-only.
      contributors: [],
      contributorNames: undefined,
      leadCsm: undefined,
      estimatedCost: undefined,
      projects: undefined,
      libraryNotes: undefined,
      reviewOutcome: undefined,
      reviewComments: undefined,
    }));
}