import type { Solution } from "../types";

export function presentCatalogue(solutions: Solution[]): Solution[] {
  return solutions.filter((solution) => solution.publicationStatus === "Published" && solution.safetyAcknowledged && solution.clientSafeReviewed)
    .map((solution) => ({
      ...solution,
      clientContext: undefined,
      projects: undefined,
      libraryNotes: undefined,
      reviewOutcome: undefined,
      reviewComments: undefined,
    }));
}