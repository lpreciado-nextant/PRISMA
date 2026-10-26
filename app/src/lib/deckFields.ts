import type { Solution, SolutionStatus } from "../types.ts";
import { AREAS } from "../data/catalogueMetadata.ts";
import { markdownText } from "./markdown.ts";

/**
 * Maps a solution to the fields of the PRISMA × Nextant presentation template.
 * Field names, limits and sources: tools/pptx-template/PRISMA_Field_Map.md.
 *
 * Export rules (do not relax):
 * - Only solutions with Client review = Cleared can be exported.
 * - Never export effort (hours or complexity), builder names or contributor rows, projects or library notes.
 * - The redacted client context is the only client-facing text; the deck never reads `clientContext`.
 */

export type DeckVariant = "dark" | "light";

export interface DeckFields {
  /** Primary specialization area: the cover badge. */
  area_name: string;
  /** Every specialization area, primary first (slide 4). */
  area_names: string;
  capability: string;
  /** The redacted client context, the only client-facing client text (slide 4); empty hides the field. */
  client_context: string;
  maturity_label: string;
  solution_title: string;
  tagline: string;
  presenter_name: string;
  presentation_date: string;
  description: string;
  business_value: string;
  industries: string;
  cta_headline: string;
  /** Full PRISMA link to the solution, in the notes; never truncated. */
  prisma_href: string;
  /** PRISMA's library, behind slide 6's "Explore the Library"; the solution link when the app has none. */
  library_href: string;
  /** Technologies joined for the speaker notes. */
  tech_list: string;
  csm_name: string;
  csm_email: string;
  /** Up to two initials of the contact, in slide 6's ring. */
  csm_initials: string;
  [key: string]: string;
}

/** `action`: the row's button label (Play, Open or Download); the template's own label stays when absent. */
export interface DeckDemo { title: string; url?: string; action?: "Play" | "Open" | "Download" }

export interface DeckInput {
  solution: Solution;
  /** The signed-in user who downloads the deck (Entra ID). */
  presenter: { name: string; role?: string; email?: string };
  /** Absolute link to the solution page in PRISMA. */
  prismaUrl: string;
  /** Absolute link to PRISMA's library. */
  libraryUrl?: string;
  /** Readable titles and links for the demos; titles come from the app, never from file names. */
  videos?: DeckDemo[];
  interactives?: DeckDemo[];
  supporting?: DeckDemo[];
  /** CSM of the solution, when the caller has it (Cleared rows only expose the CSM, never builders). Without one, the presenter is the contact. */
  csm?: { name: string; email?: string };
  now?: Date;
}

export const DECK_LIMITS: Record<string, number> = {
  solution_title: 60, tagline: 170, presenter_name: 30, presentation_date: 20,
  description: 520, business_value: 200, industries: 60,
  tech: 30, demo_title: 40, cta_headline: 60, csm_name: 28, csm_email: 35,
  area_names: 90, capability: 40, client_context: 60,
};

export const CTA_HEADLINE = "Let's build this together";
export const MAX_TECH = 8;
export const MAX_VIDEOS = 3;
export const MAX_INTERACTIVES = 2;
export const MAX_SUPPORTING = 3;
export const MAX_SHOTS = 6;

const MATURITY_LABEL: Record<SolutionStatus, string | undefined> = {
  "Idea / concept": "Idea / Concept",
  "Working prototype": "Working prototype",
  "Client demo": "Working prototype",
  "Live in production": "Live",
  Retired: undefined,
};

export class DeckNotExportableError extends Error {}

/** True when the CSM may download the deck: published and client-reviewed. */
export function canExportDeck(solution: Pick<Solution, "clientSafeReviewed" | "publicationStatus" | "status">): boolean {
  return solution.clientSafeReviewed === true && solution.publicationStatus === "Published" && MATURITY_LABEL[solution.status] !== undefined;
}

/** Cuts at a word boundary with an ellipsis; the template has fixed boxes, so overflow must never reach it. */
export function fit(text: string | undefined, limit: number): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** Initials of the first and last word of a name ("Juliana Castelblanco" -> "JC"). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "").slice(0, 2)).toUpperCase();
}

function monthYear(date: Date): string {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();
}

export function buildDeckFields(input: DeckInput): DeckFields {
  const { solution, presenter, prismaUrl, videos = [], interactives = [], supporting = [], csm } = input;
  if (!canExportDeck(solution)) throw new DeckNotExportableError("Only published solutions with Client review = Cleared can be exported.");
  const areaName = AREAS[solution.specializationArea].name;
  const areas = (solution.specializationAreas?.length ? solution.specializationAreas : [solution.specializationArea]).map((area) => AREAS[area].name);
  const contact = csm?.name || presenter.name;
  const fields: DeckFields = {
    area_name: areaName,
    area_names: fit(areas.join(" · "), DECK_LIMITS.area_names),
    capability: fit(solution.capabilities[0], DECK_LIMITS.capability),
    client_context: fit(solution.clientContextRedacted, DECK_LIMITS.client_context),
    maturity_label: MATURITY_LABEL[solution.status] ?? "",
    solution_title: fit(solution.name, DECK_LIMITS.solution_title),
    tagline: fit(solution.summary, DECK_LIMITS.tagline),
    presenter_name: fit(presenter.name, DECK_LIMITS.presenter_name),
    presentation_date: monthYear(input.now ?? new Date()),
    description: fit(markdownText(solution.whatItDoes), DECK_LIMITS.description),
    business_value: fit(markdownText(solution.businessValue), DECK_LIMITS.business_value),
    industries: fit(solution.industries.join(" · "), DECK_LIMITS.industries),
    cta_headline: CTA_HEADLINE,
    prisma_href: prismaUrl,
    library_href: input.libraryUrl || prismaUrl,
    tech_list: solution.technologies.join(", "),
    csm_name: fit(contact, DECK_LIMITS.csm_name),
    csm_email: fit(csm?.name ? csm.email : presenter.email, DECK_LIMITS.csm_email),
    csm_initials: initials(contact),
  };
  solution.technologies.slice(0, MAX_TECH).forEach((tech, index) => { fields[`tech_${index + 1}`] = fit(tech, DECK_LIMITS.tech); });
  const demos = (kind: "video" | "interactive" | "supporting", list: DeckDemo[], max: number) => list.filter((demo) => demo.title.trim()).slice(0, max).forEach((demo, index) => {
    fields[`${kind}_${index + 1}_title`] = fit(demo.title, DECK_LIMITS.demo_title);
    if (demo.url) fields[`${kind}_${index + 1}_url`] = demo.url;
    if (demo.action) fields[`${kind}_${index + 1}_action`] = demo.action;
  });
  demos("video", videos, MAX_VIDEOS);
  demos("interactive", interactives, MAX_INTERACTIVES);
  demos("supporting", supporting, MAX_SUPPORTING);
  return fields;
}

/** Image keys the template expects, from the solution's own images. Callers resolve each key to bytes. */
export function deckImageKeys(solution: Pick<Solution, "thumbnail" | "images">): { key: string; src: string }[] {
  const shots = (solution.images ?? []).map((image) => image.src).filter(Boolean).slice(0, MAX_SHOTS);
  const cover = solution.thumbnail ?? shots[0];
  const feature = shots[0] ?? solution.thumbnail;
  const out: { key: string; src: string }[] = [];
  if (cover) out.push({ key: "cover_image", src: cover });
  if (feature) out.push({ key: "feature_image", src: feature });
  shots.forEach((src, index) => out.push({ key: `shot_${index + 1}`, src }));
  return out;
}

export function deckFileName(solution: Pick<Solution, "name">, variant: DeckVariant): string {
  const slug = solution.name.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "solution";
  return `PRISMA-${slug}-${variant === "dark" ? "Dark" : "Light"}.pptx`;
}
