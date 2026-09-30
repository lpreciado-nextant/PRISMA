import { buildHash, parseHash } from "../../src/lib/router.ts";
import { filtersFromQuery, filtersToQuery } from "../../src/lib/search.ts";

// The Power Apps player owns the address bar and never forwards its hash, so links carry the in-app route as ?route= on the play URL.
export const ROUTE_PARAM = "route";

export interface AppLocation {
  route?: string;
  appUrl?: string;
  appId?: string;
  environmentId?: string;
  tenantId?: string;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGES = new Set(["/my-submissions", "/review", "/favorites"]);

/** The in-app hash for a known PRISMA route, or undefined for anything else. */
export function routeHash(route: string | undefined): string | undefined {
  if (typeof route !== "string" || route.length > 2000) return;
  const { path, query } = parseHash(route.startsWith("#") ? route : `#${route}`);
  if (path === "/") return buildHash("/", filtersToQuery(filtersFromQuery(query)));
  if (PAGES.has(path)) return buildHash(path);
  if (path === "/submit") {
    const draft = query.get("draft");
    if (draft !== null && !GUID.test(draft)) return;
    return buildHash(path, { draft: draft?.toLowerCase() });
  }
  const match = /^\/(s|submission|review)\/([^/]+)(?:\/demo\/([^/]+))?$/.exec(path);
  if (!match || !GUID.test(match[2]) || (match[3] !== undefined && (match[1] !== "s" || !GUID.test(match[3])))) return;
  return `#${path.toLowerCase()}`;
}

/** A play URL that reopens `route`, or undefined when the host gave no usable app address. */
export function shareUrl(location: AppLocation, route: string): string | undefined {
  const hash = routeHash(route);
  const url = playerUrl(location);
  if (!hash || !url) return;
  // sourcetime pins the version the sharer happened to load.
  url.searchParams.delete("sourcetime");
  if (hash === "#/") url.searchParams.delete(ROUTE_PARAM);
  else url.searchParams.set(ROUTE_PARAM, hash.slice(1));
  url.hash = "";
  return url.toString();
}

function playerUrl({ appUrl, appId, environmentId, tenantId }: AppLocation): URL | undefined {
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      if (url.protocol === "https:" && url.pathname.startsWith("/play/")) return url;
    } catch { /* fall back to the published player address */ }
  }
  if (!appId || !environmentId || !tenantId || ![appId, environmentId, tenantId].every(id => GUID.test(id))) return;
  return new URL(`https://apps.powerapps.com/play/e/${environmentId}/app/${appId}?tenantId=${tenantId}`);
}
