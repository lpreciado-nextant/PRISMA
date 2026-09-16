/**
 * Shapes mirror the Dataverse schema in docs/data_model so the mock data layer
 * can be swapped for `@microsoft/power-apps` generated services without the UI
 * changing. See docs/data_model/nextant-solution-library-dataverse-schema.md.
 */

export type SpecializationArea = "ai" | "data" | "ibo";

export type SolutionStatus =
  | "Idea / concept"
  | "Working prototype"
  | "Client demo"
  | "Live in production"
  | "Retired";

export type PublicationStatus = "Draft" | "Pending review" | "Published" | "Retired";

export type Shareability = "Yes" | "Yes, with names removed" | "No – internal only";

export type SampleDataLevel =
  | "Yes – all data is invented"
  | "Partly – some real figures"
  | "No – contains real client data";

export type EffortLevel = "Days" | "Weeks" | "Months" | "Ongoing programme";

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

export interface Solution {
  id: string;
  name: string;
  summary: string;
  whatItDoes: string;
  businessValue: string;
  specializationArea: SpecializationArea;
  builtBy: { name: string; email: string };
  status: SolutionStatus;
  publicationStatus: PublicationStatus;
  shareable: Shareability;
  sampleDataLevel: SampleDataLevel;
  clientContext?: string;
  clientContextRedacted?: string;
  /** Data URL or image URL for the card poster; stands in for the Dataverse Image column. */
  thumbnail?: string;
  /** Additional screenshots shown on the detail page (`nx_solutionimage`, 1:N). */
  images?: SolutionImage[];
  effort: EffortLevel;
  dateAdded: string;
  libraryNotes?: string;
  searchKeywords: string;
  capabilities: string[];
  technologies: string[];
  industries: string[];
  assets: DemoAsset[];
}

export interface AreaMeta {
  id: SpecializationArea;
  name: string;
  short: string;
  note: string;
  cssVar: string;
}
