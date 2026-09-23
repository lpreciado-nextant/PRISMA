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

/** `nx_role` Choice on `nx_solution` — placeholder options until the live choice list is confirmed. */
export type ClientRole =
  | "Chief Executive Officer"
  | "Chief of Staff"
  | "Chief Financial Officer"
  | "Chief Operating Officer"
  | "Chief Information Officer"
  | "Chief Data Officer"
  | "Head of Sales"
  | "Head of Operations";

export type PublicationStatus = "Draft" | "Pending review" | "Published" | "Retired";

export interface BusinessCalendar {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  holidays: string[];
}

/** Contributor role Choice on `nx_solutioncontributor` (logical name to confirm). */
export type ContributorRole = "CSM" | "Consultant";

export interface SolutionContributor {
  id: string;
  builtBy: { id: string; name: string; email: string };
  /** How this person contributed. Internal only, like the rest of the contributor row. */
  contributorRole?: ContributorRole;
  effortMode?: "direct" | "calendar";
  directHours?: number;
  startDate: string;
  endDate: string;
  allocation: number;
  calendarId: string;
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
  /** Proposed `nx_leadcsm` lookup → `cr6b0_consultant`. Internal only; stripped in present mode. */
  leadCsm?: { id: string; name: string; email: string };
  /** Proposed `nx_estimatedcost` (Currency, USD). Internal only; stripped in present mode. */
  estimatedCost?: number;
  /** `nx_role` — the primary client role this solution supports. Client-safe. */
  targetRole?: ClientRole;
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
  libraryNotes?: string;
  searchKeywords: string;
  /** Native N:N tags — `nx_capability` / `nx_technology` / `nx_industry`. */
  capabilities: string[];
  technologies: string[];
  industries: string[];
  /** Delivery evidence via `nx_solutionproject` — client names, never rendered in present mode. */
  projects?: SolutionProject[];
  assets: DemoAsset[];
}

export interface AreaMeta {
  id: SpecializationArea;
  name: string;
  short: string;
  note: string;
  cssVar: string;
}
