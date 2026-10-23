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

/**
 * The mock's `nx_capability` rows as live in Nextant Pulse on 2026-10-23, in `nx_sortordernumber` order, each with the
 * `nx_specializationarea` it belongs to and its owner's name (`nx_capabilityowner`; no email in the bundle). A solution's
 * areas are derived from its capabilities.
 */
export const CAPABILITIES: { name: string; area: SpecializationArea; owner?: string }[] = [
  { name: "Analytics Consulting", area: "data", owner: "Lucia Bustillo" },
  { name: "Governance & Security", area: "data", owner: "Gerson Salinas" },
  { name: "Business Aplications Engineering", area: "ai", owner: "Mauricio Cubillos" },
  { name: "Data Modeling & Architecture", area: "data", owner: "Juan Pablo Sarmiento" },
  { name: "AI-Enabled Data Solutions", area: "data", owner: "Antonio Alvarez" },
  { name: "Data Engineering", area: "data", owner: "Jorge Isaias Ardila" },
  { name: "Process Automation & Integration", area: "ai", owner: "Andres Perez" },
  { name: "AI & Agent Engineering", area: "ai", owner: "Shashank Saxena" },
  { name: "Responsible AI & Platform Governance", area: "ai", owner: "Patricia Méndez" },
  { name: "Program & Project Leadership", area: "ibo", owner: "Jessica Wilson" },
  { name: "Operational Transformation", area: "ibo", owner: "Catalina Vasquez" },
  { name: "Change Management & Adoption", area: "ibo", owner: "Mary Thomason" },
  { name: "AI-Enabled Operations & Governance", area: "ibo", owner: "Valentina Velosa" },
];