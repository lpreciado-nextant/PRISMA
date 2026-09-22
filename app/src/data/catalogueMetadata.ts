import type { AreaMeta, BusinessCalendar, SpecializationArea } from "../types";

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

export const AREA_ORDER: SpecializationArea[] = ["ai", "data", "ibo"];