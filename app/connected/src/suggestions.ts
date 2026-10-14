/** Private change suggestions on published solutions (`nx_solutionsuggestion`), through the PRISMA Custom APIs. */
import { recordServerAddressed, suggestionFeedbackKey } from "../../src/lib/feedbackSeen.ts";
type ApiResult = Promise<{ success: boolean; data: Record<string, unknown> }>;
export interface SuggestionApi {
  list: (solutionId: string) => ApiResult;
  send: (solutionId: string, text: string) => ApiResult;
  /** `nx_AddressSuggestion`, once registered and its client generated. */
  address?: (suggestionId: string, addressed: boolean) => ApiResult;
  /** `nx_GetMyOpenFeedback`, once registered and its client generated. */
  openFeedback?: () => ApiResult;
}

/** `addressedOn` is the server's `nx_addressedon` (null while open); absent from an older plug-in. */
export interface Suggestion { id: string; text: string; author: string; createdOn: string; addressedOn?: string | null }
/** `canRead` is true only for the owner, a contributor or the PRISMA Librarian; everyone else gets an empty list. */
export interface SuggestionList { canRead: boolean; suggestions: Suggestion[] }

/** Mirrors `SuggestionPolicy.MaxLength` on the server. */
export const SUGGESTION_MAX = 1000;

const guid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function response(result: { success: boolean; data: Record<string, unknown> }): Record<string, unknown> {
  if (!result.success || typeof result.data?.ResultJson !== "string") throw new Error("Dataverse did not confirm the suggestion operation.");
  const value: unknown = JSON.parse(result.data.ResultJson);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid suggestion response.");
  return value as Record<string, unknown>;
}

export function parseSuggestions(data: Record<string, unknown>): SuggestionList {
  if (typeof data.canRead !== "boolean" || !Array.isArray(data.suggestions)) throw new Error("Invalid suggestion list.");
  const suggestions = data.suggestions.map((entry: unknown) => {
    const row = entry as Record<string, unknown>;
    if (!row || typeof row.id !== "string" || !guid.test(row.id) || typeof row.text !== "string" || typeof row.author !== "string"
      || typeof row.createdOn !== "string" || Number.isNaN(Date.parse(row.createdOn))) throw new Error("Invalid suggestion.");
    if (row.addressedOn !== undefined && row.addressedOn !== null && (typeof row.addressedOn !== "string" || Number.isNaN(Date.parse(row.addressedOn)))) throw new Error("Invalid suggestion.");
    return { id: row.id.toLowerCase(), text: row.text, author: row.author, createdOn: row.createdOn, ...(row.addressedOn !== undefined ? { addressedOn: row.addressedOn as string | null } : {}) };
  });
  // A reader who may not read must never be shown rows, whatever the response says.
  return { canRead: data.canRead, suggestions: data.canRead ? suggestions : [] };
}

export async function loadSuggestions(api: SuggestionApi, solutionId: string, signal: AbortSignal): Promise<SuggestionList> {
  signal.throwIfAborted();
  const result = await api.list(solutionId);
  signal.throwIfAborted();
  const list = parseSuggestions(response(result));
  // A plug-in that knows addressing reports it on every row; that state then wins over this browser's record.
  recordServerAddressed(list.suggestions.filter(item => item.addressedOn !== undefined).map(item => ({ key: suggestionFeedbackKey(item.id), addressed: !!item.addressedOn })));
  return list;
}

/** Marks one suggestion addressed or open again in Dataverse; only the solution's owner or a contributor may. */
export async function addressSuggestion(api: SuggestionApi, suggestionId: string, addressed: boolean): Promise<void> {
  if (!api.address || !guid.test(suggestionId)) throw new Error("Addressing suggestions is not available.");
  const data = response(await api.address(suggestionId, addressed));
  if (typeof data.id !== "string" || data.id.toLowerCase() !== suggestionId.toLowerCase()) throw new Error("Dataverse did not confirm the suggestion.");
}

/** The caller's open feedback in one read: unaddressed suggestions on their published solutions, and returned drafts. */
export interface OpenFeedbackList { suggestions: { id: string; solutionId: string }[]; changesRequested: string[] }
export function parseOpenFeedback(data: Record<string, unknown>): OpenFeedbackList {
  if (!Array.isArray(data.suggestions) || !Array.isArray(data.changesRequested)) throw new Error("Invalid open feedback.");
  const suggestions = data.suggestions.map((entry: unknown) => {
    const row = entry as Record<string, unknown>;
    if (!row || typeof row.id !== "string" || !guid.test(row.id) || typeof row.solutionId !== "string" || !guid.test(row.solutionId)) throw new Error("Invalid open feedback.");
    return { id: row.id.toLowerCase(), solutionId: row.solutionId.toLowerCase() };
  });
  const changesRequested = data.changesRequested.map((id: unknown) => {
    if (typeof id !== "string" || !guid.test(id)) throw new Error("Invalid open feedback.");
    return id.toLowerCase();
  });
  return { suggestions, changesRequested };
}
export async function loadOpenFeedback(api: SuggestionApi, signal: AbortSignal): Promise<OpenFeedbackList> {
  if (!api.openFeedback) throw new Error("Open feedback is not available.");
  signal.throwIfAborted();
  const list = parseOpenFeedback(response(await api.openFeedback()));
  signal.throwIfAborted();
  return list;
}

/** Sends one suggestion; the server attributes it to the signed-in person. Returns the new suggestion's id. */
export async function sendSuggestion(api: SuggestionApi, solutionId: string, text: string, signal: AbortSignal): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > SUGGESTION_MAX) throw new Error(`Write a suggestion of up to ${SUGGESTION_MAX} characters.`);
  signal.throwIfAborted();
  const result = await api.send(solutionId, trimmed);
  signal.throwIfAborted();
  const data = response(result);
  if (typeof data.id !== "string" || !guid.test(data.id)) throw new Error("Dataverse did not confirm the suggestion.");
  return data.id.toLowerCase();
}
