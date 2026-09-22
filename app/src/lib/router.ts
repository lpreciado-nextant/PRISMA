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

let acceptedHash = typeof window === "undefined" ? "#/" : window.location.hash || "#/";
let navigationGuard: ((hash: string) => boolean) | undefined;
let requestedHash: string | undefined;

export function guardNavigation(guard: (hash: string) => boolean) {
  navigationGuard = guard;
  return () => { if (navigationGuard === guard) navigationGuard = undefined; };
}

function subscribe(onChange: () => void) {
  const changed = () => {
    const next = window.location.hash || "#/";
    if (next !== acceptedHash) {
      if (next !== requestedHash && navigationGuard && !navigationGuard(next)) { window.history.replaceState(null, "", acceptedHash); return; }
      acceptedHash = next;
    }
    requestedHash = undefined;
    onChange();
  };
  window.addEventListener("hashchange", changed);
  return () => window.removeEventListener("hashchange", changed);
}

function getSnapshot() {
  return acceptedHash;
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
  const next = buildHash(path, query);
  if (next === acceptedHash || (navigationGuard && !navigationGuard(next))) return;
  requestedHash = next;
  window.location.hash = next;
}

export function replaceQuery(path: string, query: Record<string, string | undefined>) {
  const next = buildHash(path, query);
  if (next === window.location.hash) return;
  if (navigationGuard && !navigationGuard(next)) return;
  requestedHash = next;
  window.history.replaceState(null, "", next);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
