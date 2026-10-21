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
 * The mock's `nx_clientrole` reference rows (PR-031), in the order the old choice showed them. The connected app reads
 * the live table instead, where an administrator can add a role.
 */
export const CLIENT_ROLES: ClientRole[] = [
  "Chief of Staff", "Chief Executive Officer (CEO)", "Chief Information Officer (CIO)", "Chief Operating Officer (COO)",
  "Chief Financial Officer (CFO)", "Enterprise Architect", "Solution Architect", "Product Owner", "Project Manager",
  "Business Unit Leader", "Operation Manager", "IT Manager", "Director", "Other",
];

export const AREA_ORDER: SpecializationArea[] = ["ai", "data", "ibo"];