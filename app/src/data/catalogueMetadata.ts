import type { AreaMeta, BusinessCalendar, ClientRole, ContributorRole, SpecializationArea } from "../types";

export const DEFAULT_BUSINESS_CALENDAR_ID = "us-federal-2026";

export const BUSINESS_CALENDARS: BusinessCalendar[] = [
  {
    id: DEFAULT_BUSINESS_CALENDAR_ID, name: "US business calendar (2026)",
    startDate: "2026-01-01", endDate: "2026-12-31",
    holidays: [
      "2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25",
      "2026-06-19", "2026-07-03", "2026-09-07", "2026-10-12",
      "2026-11-11", "2026-11-26", "2026-12-25",
    ],
  },
];

export const AREAS: Record<SpecializationArea, AreaMeta> = {
  ai: {
    id: "ai", name: "AI & Automation", short: "AI",
    note: "Agents, copilots and automated workflows, built on Power Platform, Copilot Studio and Azure.",
    cssVar: "var(--sa-ai)",
  },
  data: {
    id: "data", name: "Data Solutions", short: "Data",
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

/** `nx_solutioncontributor.nx_role`. */
export const CONTRIBUTOR_ROLE_VALUES: Record<ContributorRole, number> = { CSM: 125060000, Consultant: 125060001 };

export const CONTRIBUTOR_ROLES = Object.keys(CONTRIBUTOR_ROLE_VALUES) as ContributorRole[];

export const AREA_ORDER: SpecializationArea[] = ["ai", "data", "ibo"];