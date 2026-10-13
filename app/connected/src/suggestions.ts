/** Private change suggestions on published solutions (`nx_solutionsuggestion`), through the PRISMA Custom APIs. */
export interface SuggestionApi {
  list: (solutionId: string) => Promise<{ success: boolean; data: Record<string, unknown> }>;
  send: (solutionId: string, text: string) => Promise<{ success: boolean; data: Record<string, unknown> }>;
}

export interface Suggestion { id: string; text: string; author: string; createdOn: string }
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
    return { id: row.id.toLowerCase(), text: row.text, author: row.author, createdOn: row.createdOn };
  });
  // A reader who may not read must never be shown rows, whatever the response says.
  return { canRead: data.canRead, suggestions: data.canRead ? suggestions : [] };
}

export async function loadSuggestions(api: SuggestionApi, solutionId: string, signal: AbortSignal): Promise<SuggestionList> {
  signal.throwIfAborted();
  const result = await api.list(solutionId);
  signal.throwIfAborted();
  return parseSuggestions(response(result));
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
