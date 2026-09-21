import type { Solution } from "../types.ts";
import { BUSINESS_CALENDARS } from "../data/solutions.ts";
import { calculateEffort, usesDirectHours } from "./effort.ts";

export interface SubmissionEntry {
  owner: string;
  solution: Solution;
}

export const REVIEW_COMMENT_LIMIT = 4000;
export const UNTITLED_SOLUTION = "Untitled solution";

export function assertSubmissionReady(solution: Solution): void {
  if (!solution.name.trim() || solution.name.trim() === UNTITLED_SOLUTION || solution.name.length > 100 || !solution.summary.trim() || solution.summary.length > 200) {
    throw new Error("Enter a solution name and summary within their character limits.");
  }
  if (solution.capabilities.length !== 1 || !solution.capabilities[0].trim()) throw new Error("Select exactly one capability.");
  if (!solution.safetyAcknowledged) throw new Error("Acknowledge the client-safety requirements.");
  if (solution.clientContext?.trim() && !solution.clientContextRedacted?.trim()) throw new Error("Provide anonymous presentation context for the named client.");
  if (!solution.images?.length || solution.images.length > 6 || solution.images.some((image) => !image.src)) throw new Error("Add one to six detail images.");
  const people = solution.contributors.map((contributor) => contributor.builtBy.id);
  if (!people.length || people.some((person) => !person) || new Set(people).size !== people.length) throw new Error("Select at least one contributor, with no duplicate people.");
  for (const contributor of solution.contributors) {
    calculateEffort({ ...contributor, effortMode: usesDirectHours(solution.status) ? "direct" : "calendar" }, BUSINESS_CALENDARS.find((calendar) => calendar.id === contributor.calendarId));
  }
}

export function migrateSubmission(entry: SubmissionEntry & { changesRequested?: boolean }): SubmissionEntry {
  const { solution } = entry;
  if (solution.reviewOutcome !== undefined) return { owner: entry.owner, solution };
  return {
    owner: entry.owner,
    solution: {
      ...solution,
      reviewOutcome: entry.changesRequested ? "Changes requested" : solution.publicationStatus === "Published" && solution.clientSafeReviewed ? "Approved" : "None",
      reviewComments: solution.reviewComments ?? (Object.hasOwn(entry, "changesRequested") ? solution.libraryNotes : undefined),
    },
  };
}

export function saveContribution(solution: Solution, status: "Draft" | "Pending review", previous?: Solution): Solution {
  if (status === "Pending review") assertSubmissionReady(solution);
  return {
    ...solution, publicationStatus: status, clientSafeReviewed: false,
    name: solution.name.trim() || UNTITLED_SOLUTION,
    reviewOutcome: previous?.reviewOutcome ?? "None",
    reviewComments: previous?.reviewComments,
    libraryNotes: previous?.libraryNotes,
  };
}

export function reviewContribution(solution: Solution, decision: "publish" | "return", comments: string, clientSafe: boolean): Solution {
  if (solution.publicationStatus !== "Pending review") throw new Error("Only pending submissions can be reviewed.");
  if (comments.length > REVIEW_COMMENT_LIMIT) throw new Error(`Review comments must be ${REVIEW_COMMENT_LIMIT} characters or fewer.`);
  if (decision === "return" && !comments.trim()) throw new Error("Add comments before requesting changes.");
  if (decision === "publish") {
    if (!clientSafe) throw new Error("Confirm the independent client-safety review.");
    assertSubmissionReady(solution);
  }
  return {
    ...solution,
    publicationStatus: decision === "publish" ? "Published" : "Draft",
    clientSafeReviewed: decision === "publish",
    safetyAcknowledged: decision === "publish" && solution.safetyAcknowledged,
    reviewOutcome: decision === "publish" ? "Approved" : "Changes requested",
    reviewComments: comments.trim() || undefined,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("prisma-submissions-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("submissions", { keyPath: "solution.id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Browser storage is unavailable. Your changes have not been saved."));
    request.onblocked = () => reject(new Error("Close other PRISMA tabs and try again."));
  });
}

export async function loadSubmissions(): Promise<SubmissionEntry[]> {
  const database = await openDatabase();
  try {
    return await new Promise<SubmissionEntry[]>((resolve, reject) => {
      const transaction = database.transaction("submissions", "readonly");
      const request = transaction.objectStore("submissions").getAll();
      transaction.oncomplete = () => resolve((request.result as SubmissionEntry[]).map(migrateSubmission));
      transaction.onabort = () => reject(new Error("Saved submissions could not be loaded. Reload to try again."));
      transaction.onerror = () => reject(new Error("Saved submissions could not be loaded. Reload to try again."));
    });
  } finally {
    database.close();
  }
}

export async function storeSubmission(entry: SubmissionEntry): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("submissions", "readwrite");
      transaction.objectStore("submissions").put(entry);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error("Could not save to browser storage. Keep this page open and try smaller attachments."));
      transaction.onerror = () => reject(new Error("Could not save to browser storage. Keep this page open and try smaller attachments."));
    });
  } finally {
    database.close();
  }
}