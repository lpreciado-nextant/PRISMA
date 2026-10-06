import type { Solution, SpecializationArea } from "../types";
import { solutionAreas } from "./areas.ts";
import { created } from "./sort.ts";

/** Rolling "added within" windows over the creation date the sort uses. */
export type AddedWindow = "any" | "7d" | "30d" | "90d" | "1y";
export const ADDED_WINDOWS: readonly AddedWindow[] = ["any", "7d", "30d", "90d", "1y"];
export const ADDED_LABELS: Record<AddedWindow, string> = {
  any: "Any time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last 12 months",
};
const ADDED_DAYS: Record<Exclude<AddedWindow, "any">, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };

/** Undated solutions only match "Any time". */
export function addedWithin(s: Solution, window: AddedWindow, now = Date.now()): boolean {
  if (window === "any") return true;
  const time = created(s);
  return time !== 0 && now - time <= ADDED_DAYS[window] * 86_400_000;
}

export interface Filters {
  q: string;
  area: SpecializationArea | "all";
  capabilities: string[];
  technologies: string[];
  industries: string[];
  /** Target client roles (`nx_role`). Single-valued per solution, so these match any-of. */
  roles: string[];
  /** How recently the solution was created. */
  added: AddedWindow;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  area: "all",
  capabilities: [],
  technologies: [],
  industries: [],
  roles: [],
  added: "any",
};

function haystack(s: Solution): string {
  return [
    s.name,
    s.summary,
    s.whatItDoes,
    s.businessValue,
    s.clientContext ?? "",
    s.clientContextRedacted ?? "",
    s.searchKeywords,
    ...s.contributors.map((contributor) => contributor.builtBy.name),
    ...(s.contributorNames ?? []),
    ...s.capabilities,
    ...s.technologies,
    ...s.industries,
    s.clientRole ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

const haystacks = new WeakMap<Solution, string>();

function cachedHaystack(s: Solution): string {
  let h = haystacks.get(s);
  if (!h) {
    h = haystack(s);
    haystacks.set(s, h);
  }
  return h;
}

/** Terms are ANDed, so each extra word narrows rather than widens. */
export function matchesQuery(s: Solution, q: string): boolean {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = cachedHaystack(s);
  return terms.every((t) => hay.includes(t));
}

function matchesFacets(s: Solution, f: Filters): boolean {
  return (
    (f.area === "all" || solutionAreas(s).includes(f.area)) &&
    f.capabilities.every((c) => s.capabilities.includes(c)) &&
    f.technologies.every((t) => s.technologies.includes(t)) &&
    f.industries.every((i) => s.industries.includes(i)) &&
    (f.roles.length === 0 || (s.clientRole !== undefined && f.roles.includes(s.clientRole))) &&
    addedWithin(s, f.added)
  );
}

export function filterSolutions(all: Solution[], f: Filters): Solution[] {
  return all.filter((s) => matchesFacets(s, f) && matchesQuery(s, f.q));
}

export type FacetKey = "capabilities" | "technologies" | "industries" | "roles";

function facetValues(s: Solution, key: FacetKey): string[] {
  if (key === "roles") return s.clientRole ? [s.clientRole] : [];
  return s[key];
}

/**
 * Counts are computed with the facet's own selection removed, so a CSM can see
 * what else is available in that dimension rather than a wall of zeroes.
 */
export function facetCounts(all: Solution[], f: Filters, key: FacetKey): Map<string, number> {
  const base = all.filter(
    (s) => matchesFacets(s, { ...f, [key]: [] }) && matchesQuery(s, f.q),
  );
  const counts = new Map<string, number>();
  for (const s of base) {
    for (const value of facetValues(s, key)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

/** Count per window with the window's own selection removed, like `facetCounts`. */
export function addedCounts(all: Solution[], f: Filters): Map<AddedWindow, number> {
  const base = all.filter((s) => matchesFacets(s, { ...f, added: "any" }) && matchesQuery(s, f.q));
  const now = Date.now();
  return new Map(ADDED_WINDOWS.map((window) => [window, base.filter((s) => addedWithin(s, window, now)).length]));
}

export function areaCounts(all: Solution[], f: Filters): Map<SpecializationArea | "all", number> {
  const base = all.filter(
    (s) => matchesFacets(s, { ...f, area: "all" }) && matchesQuery(s, f.q),
  );
  const counts = new Map<SpecializationArea | "all", number>([["all", base.length]]);
  for (const s of base) {
    for (const area of solutionAreas(s)) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return counts;
}

export function activeFacetCount(f: Filters): number {
  return f.capabilities.length + f.technologies.length + f.industries.length + f.roles.length;
}

export function activeChips(f: Filters): { key: FacetKey; value: string }[] {
  return [
    ...f.capabilities.map((value) => ({ key: "capabilities" as const, value })),
    ...f.technologies.map((value) => ({ key: "technologies" as const, value })),
    ...f.industries.map((value) => ({ key: "industries" as const, value })),
    ...f.roles.map((value) => ({ key: "roles" as const, value })),
  ];
}

export function filtersToQuery(f: Filters): Record<string, string | undefined> {
  return {
    q: f.q || undefined,
    area: f.area === "all" ? undefined : f.area,
    cap: f.capabilities.length ? f.capabilities.join("~") : undefined,
    tech: f.technologies.length ? f.technologies.join("~") : undefined,
    ind: f.industries.length ? f.industries.join("~") : undefined,
    role: f.roles.length ? f.roles.join("~") : undefined,
    added: f.added === "any" ? undefined : f.added,
  };
}

export function filtersFromQuery(params: URLSearchParams): Filters {
  const list = (key: string) => (params.get(key) ? params.get(key)!.split("~") : []);
  const area = params.get("area");
  const added = params.get("added") as AddedWindow | null;
  return {
    q: params.get("q") ?? "",
    area: area === "ai" || area === "data" || area === "ibo" ? area : "all",
    capabilities: list("cap"),
    technologies: list("tech"),
    industries: list("ind"),
    roles: list("role"),
    added: added && ADDED_WINDOWS.includes(added) ? added : "any",
  };
}
