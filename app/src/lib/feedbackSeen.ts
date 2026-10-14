import { useSyncExternalStore } from "react";
import type { Solution } from "../types.ts";
import { submissionState } from "./submissionState.ts";

/**
 * Feedback the owner still has to address, item by item: the librarian's comment on a draft returned with Changes
 * requested (open until the owner resubmits; it has no check of its own), and each colleague's suggestion, which the
 * owner or a contributor marks addressed. Counts are open items and fall as items are addressed.
 *
 * Suggestions are addressed in Dataverse (`nx_solutionsuggestion.nx_addressedon`, through `nx_AddressSuggestion`) once
 * the connected app registers a writer; what the server reported overrides this browser's record. Until then (and in
 * the PoC) the record is kept in this browser: opaque keys only, never the feedback text.
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

/** The librarian's comment as an item while the draft is returned with Changes requested; resubmitting resolves it. */
export function reviewFeedbackKey(solution: Pick<Solution, "id" | "publicationStatus" | "reviewOutcome">): string | undefined {
  return submissionState(solution) === "Changes requested" ? `review:${solution.id.toLowerCase()}` : undefined;
}

export const suggestionFeedbackKey = (suggestionId: string) => `suggestion:${suggestionId.toLowerCase()}`;

/** Every feedback item on a solution: its librarian comment, if any, then its suggestions. */
export function feedbackKeys(solution: Pick<Solution, "id" | "publicationStatus" | "reviewOutcome">, suggestionIds: readonly string[] = []): string[] {
  const review = reviewFeedbackKey(solution);
  return [...(review ? [review] : []), ...suggestionIds.map(suggestionFeedbackKey)];
}

/** Addressed state the server reported (`nx_addressedon`), keyed like the items; it wins over this browser's record. */
const server = new Map<string, boolean>();
export function recordServerAddressed(entries: readonly { key: string; addressed: boolean }[]) {
  let changed = false;
  for (const entry of entries) if (server.get(entry.key) !== entry.addressed) { server.set(entry.key, entry.addressed); changed = true; }
  if (changed) notify();
}

/** Saves a suggestion's addressed state in Dataverse; registered by the connected app once `nx_AddressSuggestion` exists. */
let writer: ((suggestionId: string, addressed: boolean) => Promise<void>) | undefined;
export function setAddressWriter(next: typeof writer) { writer = next; }

export function isAddressed(key: string): boolean {
  return server.has(key) ? server.get(key)! : readAddressed().has(key);
}

export function openFeedback(keys: readonly string[]): string[] {
  const addressed = readAddressed();
  return keys.filter(key => !(server.has(key) ? server.get(key) : addressed.has(key)));
}

/**
 * Marks one suggestion addressed (or open again). With a writer it is saved in Dataverse, shown at once and rolled
 * back if the save fails; otherwise it is kept in this browser. The librarian's comment is never set here.
 */
export function setAddressed(key: string, addressed = true) {
  if (!key.startsWith("suggestion:")) return;
  if (writer) {
    const before = isAddressed(key);
    recordServerAddressed([{ key, addressed }]);
    void writer(key.slice("suggestion:".length), addressed).catch(() => recordServerAddressed([{ key, addressed: before }]));
    return;
  }
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
