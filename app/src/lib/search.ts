import type { Solution, SpecializationArea } from "../types";

export interface Filters {
  q: string;
  area: SpecializationArea | "all";
  capabilities: string[];
  technologies: string[];
  industries: string[];
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  area: "all",
  capabilities: [],
  technologies: [],
  industries: [],
};

function haystack(s: Solution): string {
  return [
    s.name,
    s.summary,
    s.whatItDoes,
    s.businessValue,
    s.searchKeywords,
    s.builtBy.name,
    ...s.capabilities,
    ...s.technologies,
    ...s.industries,
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
    (f.area === "all" || s.specializationArea === f.area) &&
    f.capabilities.every((c) => s.capabilities.includes(c)) &&
    f.technologies.every((t) => s.technologies.includes(t)) &&
    f.industries.every((i) => s.industries.includes(i))
  );
}

export function filterSolutions(all: Solution[], f: Filters): Solution[] {
  return all.filter((s) => matchesFacets(s, f) && matchesQuery(s, f.q));
}

export type FacetKey = "capabilities" | "technologies" | "industries";

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
    for (const value of s[key]) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

export function areaCounts(all: Solution[], f: Filters): Map<SpecializationArea | "all", number> {
  const base = all.filter(
    (s) => matchesFacets(s, { ...f, area: "all" }) && matchesQuery(s, f.q),
  );
  const counts = new Map<SpecializationArea | "all", number>([["all", base.length]]);
  for (const s of base) {
    counts.set(s.specializationArea, (counts.get(s.specializationArea) ?? 0) + 1);
  }
  return counts;
}

export function activeChips(f: Filters): { key: FacetKey; value: string }[] {
  return [
    ...f.capabilities.map((value) => ({ key: "capabilities" as const, value })),
    ...f.technologies.map((value) => ({ key: "technologies" as const, value })),
    ...f.industries.map((value) => ({ key: "industries" as const, value })),
  ];
}

export function filtersToQuery(f: Filters): Record<string, string | undefined> {
  return {
    q: f.q || undefined,
    area: f.area === "all" ? undefined : f.area,
    cap: f.capabilities.length ? f.capabilities.join("~") : undefined,
    tech: f.technologies.length ? f.technologies.join("~") : undefined,
    ind: f.industries.length ? f.industries.join("~") : undefined,
  };
}

export function filtersFromQuery(params: URLSearchParams): Filters {
  const list = (key: string) => (params.get(key) ? params.get(key)!.split("~") : []);
  const area = params.get("area");
  return {
    q: params.get("q") ?? "",
    area: area === "ai" || area === "data" || area === "ibo" ? area : "all",
    capabilities: list("cap"),
    technologies: list("tech"),
    industries: list("ind"),
  };
}
