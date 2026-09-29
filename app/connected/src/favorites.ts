export interface FavoriteApi {
  list: () => Promise<{ success: boolean; data: Record<string, unknown> }>;
  set: (solutionId: string, saved: boolean) => Promise<{ success: boolean; data: Record<string, unknown> }>;
  top: () => Promise<{ success: boolean; data: Record<string, unknown> }>;
}

/** Most solutions the Top 10 row shows. Mirrors `FavoriteRanking.TopCount` on the server. */
export const TOP_FAVORITES = 10;

const guid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid favorites response.");
  return value as Record<string, unknown>;
}

function response(result: { success: boolean; data: Record<string, unknown> }): Record<string, unknown> {
  if (!result.success || typeof result.data?.ResultJson !== "string") throw new Error("Dataverse did not confirm the favorite operation.");
  return record(JSON.parse(result.data.ResultJson));
}

/** The signed-in person's saved solution ids (lowercased GUIDs), scoped to their own `nx_solutionfavorite` rows. */
export async function loadFavorites(api: FavoriteApi, signal: AbortSignal): Promise<Set<string>> {
  signal.throwIfAborted();
  const result = await api.list();
  signal.throwIfAborted();
  const data = response(result);
  if (!Array.isArray(data.solutionIds) || data.solutionIds.some(id => typeof id !== "string" || !guid.test(id))) {
    throw new Error("Invalid favorites list.");
  }
  return new Set((data.solutionIds as string[]).map(id => id.toLowerCase()));
}

/** Saves or removes one favorite. Returns the confirmed saved state. */
export async function setFavorite(api: FavoriteApi, solutionId: string, saved: boolean, signal: AbortSignal): Promise<boolean> {
  signal.throwIfAborted();
  const result = await api.set(solutionId, saved);
  signal.throwIfAborted();
  const data = response(result);
  if (typeof data.saved !== "boolean") throw new Error("Dataverse did not confirm the favorite change.");
  return data.saved;
}

/**
 * The team's most-saved published solutions (lowercased GUIDs), best first. The server counts every
 * person's favorites and returns only the ranked ids, never who saved them or how often.
 */
export async function loadTopFavorites(api: FavoriteApi, signal: AbortSignal): Promise<string[]> {
  signal.throwIfAborted();
  const result = await api.top();
  signal.throwIfAborted();
  const data = response(result);
  const ids = data.solutionIds;
  if (!Array.isArray(ids) || ids.length > TOP_FAVORITES || ids.some(id => typeof id !== "string" || !guid.test(id))) {
    throw new Error("Invalid top favorites list.");
  }
  const ranked = (ids as string[]).map(id => id.toLowerCase());
  if (new Set(ranked).size !== ranked.length) throw new Error("Invalid top favorites list.");
  return ranked;
}
