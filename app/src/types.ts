import type { AssetPurpose, DemoKind } from "./lib/assetPurpose";
/**
 * Shapes mirror the Dataverse schema in docs/data_model so the mock data layer
 * can be swapped for `@microsoft/power-apps` generated services without the UI
 * changing. See docs/data_model/SchemaV2.md.
 */

export type SpecializationArea = "ai" | "data" | "ibo";

export type SolutionStatus =
  | "Idea / concept"
  | "Working prototype"
  | "Client demo"
  | "Live in production"
  | "Retired";

/** `nx_solution.nx_clientrole` local choice labels (live 2026-09-23). Values are in CLIENT_ROLE_VALUES. */
export type ClientRole =
  | "Chief of Staff"
  | "Chief Executive Officer (CEO)"
  | "Chief Information Officer (CIO)"
  | "Chief Operating Officer (COO)"
  | "Chief Financial Officer (CFO)"
  | "Enterprise Architect"
  | "Solution Architect"
  | "Product Owner"
  | "Project Manager"
  | "Business Unit Leader"
  | "Operation Manager"
  | "IT Manager"
  | "Director"
  | "Other";

export type PublicationStatus = "Draft" | "Pending review" | "Published" | "Retired";

export interface SolutionContributor {
  id: string;
  /** The `cr6b0_consultant` row; `level` is its `cr6b0_consultantlevel`, read from the directory, never entered here. */
  builtBy: { id: string; name: string; email: string; level?: string };
  /** `nx_directhours` — the minimum hours this person needed to work on the solution, at every maturity. */
  directHours?: number;
}

export type AssetType =
  | "Self-contained HTML file"
  | "Hosted web app (URL)"
  | "Power Apps"
  | "Power BI"
  | "Desktop app or script"
  | "Video walkthrough only"
  | "Client-ready one-pager / slide";

export interface DemoAsset {
  id: string;
  name: string;
  assetType: AssetType;
  fileData?: string;
  htmlContent?: string;
  externalUrl?: string;
  embedHint?: string;
  allowsEmbedding: boolean;
  sortOrder: number;
  /** `nx_assetpurpose` (ADR-0011). Absent on older rows, which read their format default. */
  purpose?: AssetPurpose;
}

/** A gallery row from `nx_solutionimage` — screenshots beyond the card thumbnail. */
export interface SolutionImage {
  id: string;
  src: string;
  caption?: string;
}

/** A delivery-evidence link — an `nx_solutionproject` row joined with its `nx_project`. */
export interface SolutionProject {
  id: string;
  /** Primary name of the linked `nx_project` row — a client engagement, internal-only. */
  projectName: string;
  projectOwner?: string;
}

export interface Solution {
  id: string;
  name: string;
  summary: string;
  whatItDoes: string;
  businessValue: string;
  /** Primary area: the first tagged area. Drives the card colour, poster and viewer accent. */
  specializationArea: SpecializationArea;
  /** Native N:N `nx_Solution_nx_SpecializationArea_nx_SpecializationArea`, in tag order. Absent rows fall back to the primary area. */
  specializationAreas?: SpecializationArea[];
  contributors: SolutionContributor[];
  contributorNames?: string[];
  /** Proposed `nx_estimatedcost` (Currency, USD). Internal only; stripped in present mode. */
  estimatedCost?: number;
  /** `nx_clientrole` — the primary client role this solution supports. Optional, no default. Client-safe. */
  clientRole?: ClientRole;
  status: SolutionStatus;
  publicationStatus: PublicationStatus;
  reviewOutcome?: "None" | "Changes requested" | "Approved";
  reviewComments?: string;
  safetyAcknowledged: boolean;
  clientSafeReviewed: boolean;
  clientContext?: string;
  clientContextRedacted?: string;
  /** Data URL or image URL for the card poster; stands in for the Dataverse Image column. */
  thumbnail?: string;
  /** Additional screenshots shown on the detail page (`nx_solutionimage`, 1:N). */
  images?: SolutionImage[];
  dateAdded: string;
  /** System `createdon` (ISO). Drives "Newest/Oldest first"; the PoC mock falls back to `dateAdded`. */
  createdOn?: string;
  libraryNotes?: string;
  searchKeywords: string;
  /** Native N:N tags — `nx_capability` / `nx_technology` / `nx_industry`. */
  capabilities: string[];
  technologies: string[];
  industries: string[];
  /** Delivery evidence via `nx_solutionproject` — client names, never rendered in present mode. */
  projects?: SolutionProject[];
  assets: DemoAsset[];
  /** The demo kinds the catalogue reports for this solution (from `nx_GetCatalogueGraph` counts), when assets are not loaded. Not a column. */
  demoKinds?: DemoKind[];
}

export interface AreaMeta {
  id: SpecializationArea;
  name: string;
  short: string;
  note: string;
  cssVar: string;
}
