import type { Solution } from "../types";

/** Whether a solution may appear in present mode: Published, acknowledged by its contributor and cleared by review. */
export function presentable(solution: Pick<Solution, "publicationStatus" | "safetyAcknowledged" | "clientSafeReviewed">): boolean {
  return solution.publicationStatus === "Published" && solution.safetyAcknowledged && solution.clientSafeReviewed;
}

export function presentCatalogue(solutions: Solution[]): Solution[] {
  return solutions.filter(presentable)
    .map((solution) => ({
      ...solution,
      clientContext: undefined,
      challenges: undefined,
      lessonsLearned: undefined,
      // Builder credit, CSM rows and effort (estimate and complexity) are internal-only.
      contributors: [],
      contributorNames: undefined,
      estimatedMinimumHours: undefined,
      complexity: undefined,
      projects: undefined,
      libraryNotes: undefined,
      reviewOutcome: undefined,
      reviewComments: undefined,
    }));
}