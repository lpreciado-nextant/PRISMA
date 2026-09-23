import type { Solution } from "../types";

export function presentCatalogue(solutions: Solution[]): Solution[] {
  return solutions.filter((solution) => solution.publicationStatus === "Published" && solution.safetyAcknowledged && solution.clientSafeReviewed)
    .map((solution) => ({
      ...solution,
      clientContext: undefined,
      // Builder credit, CSM rows, effort and cost are internal-only.
      contributors: [],
      contributorNames: undefined,
      estimatedCost: undefined,
      projects: undefined,
      libraryNotes: undefined,
      reviewOutcome: undefined,
      reviewComments: undefined,
    }));
}