import { useSyncExternalStore } from "react";

/**
 * Local stand-in for `nx_solutionfavorite`: one saved row per person per solution
 * (alternate key `nx_solution` + `nx_user`), newest first. It lives in this browser
 * only; the real table is UserOwned, so favorites stay private per person.
 */
const STORAGE_KEY = "prisma.favorites.v1";

let favorites: string[] = read();
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string"))] : [];
  } catch {
    return [];
  }
}

function publish(next: string[]) {
  favorites = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage blocked: keep the in-memory list */ }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    favorites = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

/** Saving adds a row and un-saving removes it; rows are never updated. */
export function toggleFavorite(id: string) {
  publish(favorites.includes(id) ? favorites.filter((entry) => entry !== id) : [id, ...favorites]);
}

/** Current saved ids, newest first. */
export function favoritesSnapshot(): string[] {
  return favorites;
}

export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, favoritesSnapshot, favoritesSnapshot);
}
