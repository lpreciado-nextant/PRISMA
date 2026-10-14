import { useSyncExternalStore } from "react";
import type { Solution } from "../types.ts";
import { submissionState } from "./submissionState.ts";

/**
 * Feedback the owner still has to address, one item at a time: the librarian's comment on a returned or retired
 * record, and each colleague's suggestion. Every item is confirmed on its own ("Mark as addressed"), so counts show how
 * many items are open and fall as they are confirmed; new words from the librarian are a new item.
 *
 * What has been addressed is a per-viewer convenience kept in this browser (no Dataverse column exists for it):
 * opaque keys only, never the feedback text. Blocked or cleared storage only means items show as new again.
 */
const KEY = "prisma.feedback.addressed";
const listeners = new Set<() => void>();
let version = 0;

function readAddressed(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch { return new Set(); }
}

function notify() {
  version++;
  listeners.forEach(listener => listener());
}

/** A short, stable fingerprint of a text (djb2), so a key never holds the feedback itself. */
function fingerprint(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return (hash >>> 0).toString(36);
}

/** The librarian's comment as an item, when the record was returned or retired with one. */
export function reviewFeedbackKey(solution: Pick<Solution, "id" | "publicationStatus" | "reviewOutcome" | "reviewComments">): string | undefined {
  const state = submissionState(solution);
  const comment = (state === "Changes requested" || state === "Retired") ? solution.reviewComments?.trim() ?? "" : "";
  return comment ? `review:${solution.id}:${fingerprint(comment)}` : undefined;
}

export const suggestionFeedbackKey = (suggestionId: string) => `suggestion:${suggestionId.toLowerCase()}`;

/** Every feedback item on a solution: its librarian comment, if any, then its suggestions. */
export function feedbackKeys(solution: Pick<Solution, "id" | "publicationStatus" | "reviewOutcome" | "reviewComments">, suggestionIds: readonly string[] = []): string[] {
  const review = reviewFeedbackKey(solution);
  return [...(review ? [review] : []), ...suggestionIds.map(suggestionFeedbackKey)];
}

export function isAddressed(key: string): boolean {
  return readAddressed().has(key);
}

export function openFeedback(keys: readonly string[]): string[] {
  const addressed = readAddressed();
  return keys.filter(key => !addressed.has(key));
}

/** Confirms (or reopens) one feedback item. */
export function setAddressed(key: string, addressed = true) {
  try {
    const current = readAddressed();
    if (current.has(key) === addressed) return;
    if (addressed) current.add(key); else current.delete(key);
    localStorage.setItem(KEY, JSON.stringify([...current]));
  } catch { void 0; }
  notify();
}

/**
 * The owner's feedback items for the session, so the masthead can flag open feedback without reading anything itself.
 * Set once on entry and again whenever My submissions has fresh data.
 */
let items: string[] = [];
export function setFeedbackItems(next: readonly string[]) {
  if (next.length === items.length && next.every((key, index) => key === items[index])) return;
  items = [...next];
  notify();
}

/** How many feedback items, across the owner's solutions, are still open. */
export function openFeedbackCount(): number {
  return openFeedback(items).length;
}

/** Re-renders the caller whenever an item is confirmed (in this tab or another) or the session items change. */
export function useFeedbackSeen(): number {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    const other = (event: StorageEvent) => { if (event.key === KEY) { version++; listener(); } };
    window.addEventListener("storage", other);
    return () => { listeners.delete(listener); window.removeEventListener("storage", other); };
  }, () => version, () => 0);
}
