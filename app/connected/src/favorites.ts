export interface FavoriteApi {
  list: () => Promise<{ success: boolean; data: Record<string, unknown> }>;
  set: (solutionId: string, saved: boolean) => Promise<{ success: boolean; data: Record<string, unknown> }>;
}

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
