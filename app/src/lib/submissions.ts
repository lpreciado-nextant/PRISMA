import type { Solution } from "../types.ts";

export interface SubmissionEntry {
  owner: string;
  solution: Solution;
  changesRequested?: boolean;
}

export function saveContribution(solution: Solution, status: "Draft" | "Pending review"): Solution {
  return { ...solution, publicationStatus: status, clientSafeReviewed: false };
}

export function reviewContribution(solution: Solution, decision: "publish" | "return", comments: string, clientSafe: boolean): Solution {
  if (solution.publicationStatus !== "Pending review") throw new Error("Only pending submissions can be reviewed.");
  if (decision === "return" && !comments.trim()) throw new Error("Add comments before requesting changes.");
  if (decision === "publish" && (!clientSafe || !solution.safetyAcknowledged || !solution.images?.length)) {
    throw new Error("Confirm client safety and ensure the submission includes its acknowledgment and detail images.");
  }
  return {
    ...solution,
    publicationStatus: decision === "publish" ? "Published" : "Draft",
    clientSafeReviewed: decision === "publish",
    libraryNotes: comments.trim() || undefined,
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
      transaction.oncomplete = () => resolve(request.result as SubmissionEntry[]);
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