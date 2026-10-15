import type { Solution } from "../types";

export function presentCatalogue(solutions: Solution[]): Solution[] {
  return solutions.filter((solution) => solution.publicationStatus === "Published" && solution.safetyAcknowledged && solution.clientSafeReviewed)
    .map((solution) => ({
      ...solution,
      clientContext: undefined,
      challenges: undefined,
      lessonsLearned: undefined,
      // Builder credit, CSM rows, effort (estimate and complexity) and cost are internal-only.
      contributors: [],
      contributorNames: undefined,
      estimatedCost: undefined,
      estimatedMinimumHours: undefined,
      complexity: undefined,
      projects: undefined,
      libraryNotes: undefined,
      reviewOutcome: undefined,
      reviewComments: undefined,
    }));
}