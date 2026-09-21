import { useSyncExternalStore } from "react";

/**
 * Hash routing, not path routing: a published code app is served from
 * /play/e/{environmentId}/a/{appId}, so the app never owns the path segment.
 * The hash is ours, survives a refresh, and keeps filter state pasteable.
 */

export interface Route {
  path: string;
  query: URLSearchParams;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getSnapshot() {
  return window.location.hash || "#/";
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [path, search = ""] = raw.split("?");
  return { path: path || "/", query: new URLSearchParams(search) };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return parseHash(hash);
}

export function buildHash(path: string, query?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return `#${path}${search ? `?${search}` : ""}`;
}

export function navigate(path: string, query?: Record<string, string | undefined>) {
  window.location.hash = buildHash(path, query);
}

export function replaceQuery(path: string, query: Record<string, string | undefined>) {
  const next = buildHash(path, query);
  if (next === window.location.hash) return;
  window.history.replaceState(null, "", next);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
