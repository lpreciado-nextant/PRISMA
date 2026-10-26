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

/** Names of the `nx_clientrole` reference rows (PR-031; were the `nx_solution.nx_clientrole` choice labels). The mock's list is CLIENT_ROLES. */
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
}

/** `nx_complexity`: how hard the solution was to build. Required at submission; internal only. */
export type Complexity = "Easy" | "Medium" | "Hard";

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
  /** Original upload filename, separate from the display name. Absent on legacy assets and links. */
  fileName?: string;
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
  /** `nx_estimatedminimumhours`: whole-hour estimate of the least time the whole solution took. Optional; internal only. */
  estimatedMinimumHours?: number;
  /** `nx_complexity`. Required at submission; internal only (never in present mode or the presentation download). */
  complexity?: Complexity;
  /** `nx_clientrole` names through the native N:N: every client role this solution supports. May be empty. Client-safe. */
  clientRoles: string[];
  status: SolutionStatus;
  publicationStatus: PublicationStatus;
  reviewOutcome?: "None" | "Changes requested" | "Approved";
  reviewComments?: string;
  /** Proposed `nx_librarianeditedon` (ADR-0013): when a librarian last edited this solution. Owner-facing; never in present mode. */
  librarianEditedOn?: string;
  safetyAcknowledged: boolean;
  clientSafeReviewed: boolean;
  clientContext?: string;
  clientContextRedacted?: string;
  /** `nx_challenges` (multiline, 2000). Internal only: never read or shown in present mode. */
  challenges?: string;
  /** `nx_lessonslearned` (2000). Internal only: never read or shown in present mode. */
  lessonsLearned?: string;
  /** Data URL or image URL for the card poster; stands in for the Dataverse Image column. */
  thumbnail?: string;
  /** Additional screenshots shown on the detail page (`nx_solutionimage`, 1:N). */
  images?: SolutionImage[];
  dateAdded: string;
  /** System `createdon` (ISO). Drives "Newest/Oldest first"; the PoC mock falls back to `dateAdded`. */
  createdOn?: string;
  /** System `modifiedon` (ISO): the last change. Drives My submissions' "Recently updated"; absent until the API sends it. */
  updatedOn?: string;
  libraryNotes?: string;
  searchKeywords: string;
  /** Native N:N tags — `nx_capability` / `nx_technology` / `nx_industry`. A submission carries one capability: the main one (`nx_solution.nx_capability`). */
  capabilities: string[];
  /** Other capabilities involved (`nx_Solution_nx_SecondaryCapability`, N:N; one for now). Credit only; they never set the primary area. */
  secondaryCapabilities?: string[];
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
