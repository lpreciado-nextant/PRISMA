import type { AreaMeta, ClientRole, SpecializationArea } from "../types";

export const AREAS: Record<SpecializationArea, AreaMeta> = {
  ai: {
    id: "ai", name: "AI & Automation", short: "AI",
    note: "Agents, copilots and automated workflows, built on Power Platform, Copilot Studio and Azure.",
    cssVar: "var(--sa-ai)",
  },
  data: {
    id: "data", name: "Data Solutions", short: "DS",
    note: "Data platforms, models and reporting — the work that makes the numbers trustworthy before anything is built on them.",
    cssVar: "var(--sa-data)",
  },
  ibo: {
    id: "ibo", name: "Intelligent Business Operations", short: "IBO",
    note: "Process redesign and the systems that run the operation day to day.",
    cssVar: "var(--sa-ibo)",
  },
};

/**
 * `nx_clientrole` in live display order. Values are not ordinal (COO/CFO sit after CIO), so map by value, never
 * by position. The live "Director" label has a trailing space; compare values, not labels.
 */
export const CLIENT_ROLE_VALUES: Record<ClientRole, number> = {
  "Chief of Staff": 125060000,
  "Chief Executive Officer (CEO)": 125060001,
  "Chief Information Officer (CIO)": 125060002,
  "Chief Operating Officer (COO)": 125060008,
  "Chief Financial Officer (CFO)": 125060009,
  "Enterprise Architect": 125060003,
  "Solution Architect": 125060004,
  "Product Owner": 125060005,
  "Project Manager": 125060006,
  "Business Unit Leader": 125060007,
  "Operation Manager": 125060010,
  "IT Manager": 125060011,
  Director: 125060012,
  Other: 125060013,
};

export const CLIENT_ROLES = Object.keys(CLIENT_ROLE_VALUES) as ClientRole[];

/** Reverse of `CLIENT_ROLE_VALUES`, for a connected app that stores the numeric choice value. */
export const CLIENT_ROLE_BY_VALUE: Record<number, ClientRole> = Object.fromEntries(
  Object.entries(CLIENT_ROLE_VALUES).map(([label, value]) => [value, label]),
) as Record<number, ClientRole>;

export const AREA_ORDER: SpecializationArea[] = ["ai", "data", "ibo"];