import type { Solution } from "../types.ts";

/** Contributor-facing review state. "Changes requested" is a returned Draft, not a publication status of its own. */
export type SubmissionState = "Draft" | "Pending review" | "Changes requested" | "Published" | "Retired";

export const submissionState = (solution: Pick<Solution, "publicationStatus" | "reviewOutcome">): SubmissionState =>
  solution.publicationStatus === "Draft" && solution.reviewOutcome === "Changes requested" ? "Changes requested" : solution.publicationStatus;
