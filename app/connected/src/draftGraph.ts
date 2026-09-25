import { coreFields, saveDraft, type CoreDraft, type DraftApi, type DraftResult, type SavedDraft } from "./drafts.ts";
import { readAll, type ReadRows } from "./catalogue.ts";
import { calculateEffort, usBusinessCalendar } from "../../src/lib/effort.ts";
import { CONTRIBUTOR_ROLE_VALUES, CONTRIBUTOR_ROLE_BY_VALUE } from "../../src/data/catalogueMetadata.ts";

const CONTRIBUTOR_ROLE_VALUE_SET = new Set(Object.values(CONTRIBUTOR_ROLE_VALUES));

const calendar = usBusinessCalendar(2020, 2035);
export function contributorEffort(person: Contributor, maturity: number) {
  try {
    if (!person.personId) throw new Error("Select a contributor.");
    if (person.directHours !== null && person.directHours > 1_000_000_000) throw new Error("Hours exceed the supported limit.");
    const result = calculateEffort({
      id: person.id ?? "", builtBy: { id: person.personId, name: "", email: "" },
      effortMode: maturity === 125060001 || maturity === 125060004 ? "direct" : "calendar",
      directHours: person.directHours ?? undefined, startDate: person.startDate ?? "", endDate: person.endDate ?? "",
      allocation: person.allocation ?? NaN, calendarId: calendar.id,
    }, calendar);
    return { ...result, error: "" };
  } catch (error) {
    return { businessDays: 0, hours: 0, error: error instanceof Error ? error.message : "Check contributor effort." };
  }
}

export type GraphReferences = Record<"people" | "technologies" | "industries" | "projects", { id: string; name: string; email?: string }[] | null>;
export function initialContributor(references: GraphReferences, owner: string): DraftGraph {
  const people = references.people?.filter(person => person.email?.trim().toLowerCase() === owner.trim().toLowerCase()) ?? [];
  return { ...emptyGraph(), contributors: people.length === 1 ? [{ id: null, personId: people[0].id, directHours: null, allocation: 100, startDate: null, endDate: null, roleValue: null }] : [] };
}
export async function loadGraphReferences(read: ReadRows, signal: AbortSignal): Promise<GraphReferences> {
  const definitions = [
    { table: "people", id: "cr6b0_consultantid", name: "cr6b0_consultantname" },
    { table: "technologies", id: "nx_technologyid", name: "nx_technologyname" },
    { table: "industries", id: "nx_industryid", name: "nx_industryname" },
    { table: "projects", id: "cr6b0_projectid", name: "cr6b0_projecttitle" },
  ] as const;
  const lists = await Promise.all(definitions.map(async definition => {
    try {
      const rows = await readAll(read, definition.table, { select: [definition.id, definition.name, ...(definition.table === "people" ? ["cr6b0_email", "statecode", "cr6b0_employeestatus"] : [])], filter: definition.table === "people" ? "statecode eq 0 and cr6b0_employeestatus eq true" : "statecode eq 0", orderBy: [`${definition.name} asc`] }, signal);
      return rows.filter(row => definition.table !== "people" || ((row as Record<string, unknown>).statecode === 0 && (row as Record<string, unknown>).cr6b0_employeestatus === true)).map(row => {
        const values = row as Record<string, unknown>;
        const identifier = values[definition.id];
        const title = values[definition.name];
        if (typeof identifier !== "string" || (definition.table !== "projects" && typeof title !== "string")) throw new Error("Invalid reference.");
        return { id: identifier, name: typeof title === "string" && title.trim() ? title : `Untitled project (${identifier.slice(0, 8)})`, ...(definition.table === "people" && typeof values.cr6b0_email === "string" ? { email: values.cr6b0_email } : {}) };
      });
    } catch { return null; }
  }));
  signal.throwIfAborted();
  return Object.fromEntries(definitions.map((definition, index) => [definition.table, lists[index]])) as GraphReferences;
}

export interface Contributor {
  id: string | null;
  personId: string;
  directHours: number | null;
  startDate: string | null;
  endDate: string | null;
  allocation: number | null;
  /** `nx_solutioncontributor.nx_role` numeric choice value: 125060000 CSM, 125060001 Consultant. */
  roleValue: number | null;
}
export interface DraftGraph {
  contributors: Contributor[];
  technologyIds: string[];
  industryIds: string[];
  projectIds: string[];
  areaIds: string[];
}
export interface GraphSnapshot { id: string; rowVersion: string; graph: DraftGraph; hours: (number | null)[] }
export interface GraphApi {
  read: (id: string) => Promise<DraftResult>;
  save: (id: string, version: string, json: string) => Promise<DraftResult>;
}
export const emptyGraph = (): DraftGraph => ({ contributors: [], technologyIds: [], industryIds: [], projectIds: [], areaIds: [] });

export function isEmptyContributor(person: Contributor): boolean {
  return !person.id && !person.personId && person.directHours === null && !person.startDate && !person.endDate && (person.allocation === null || person.allocation === 100) && !person.roleValue;
}

export async function persistDraftGraph(coreApi: DraftApi, graphApi: GraphApi, draft: CoreDraft, saved: SavedDraft | undefined, graph: DraftGraph, baseline: DraftGraph, signal: AbortSignal, onConfirmed: (core: SavedDraft, graph: DraftGraph) => void) {
  signal.throwIfAborted();
  graph = { ...graph, contributors: graph.contributors.filter(person => !isEmptyContributor(person)) };
  if (graph.contributors.some(person => !person.personId)) throw new Error("Select a contributor before saving their effort.");
  const graphChanged = graphPayload(graph) !== graphPayload(baseline) || (!!saved && saved.maturity !== draft.maturity);
  let current = saved;
  let confirmedGraph = baseline;
  const fields = { ...draft, safetyAcknowledged: graphChanged ? false : draft.safetyAcknowledged };
  if (!current || JSON.stringify(coreFields(current)) !== JSON.stringify(coreFields(fields))) {
    current = await saveDraft(coreApi, fields, current, signal);
    onConfirmed(current, confirmedGraph);
  }
  if (graphChanged) {
    signal.throwIfAborted();
    const next = parseGraph(await graphApi.save(current.id, current.rowVersion, graphPayload(graph)));
    signal.throwIfAborted();
    if (next.id !== current.id || next.rowVersion === current.rowVersion) throw new Error("Unconfirmed graph version.");
    current = { ...current, rowVersion: next.rowVersion, safetyAcknowledged: false };
    confirmedGraph = next.graph;
    onConfirmed(current, confirmedGraph);
  }
  if (draft.safetyAcknowledged && !current.safetyAcknowledged) {
    current = await saveDraft(coreApi, { ...coreFields(current), safetyAcknowledged: true }, current, signal);
    onConfirmed(current, confirmedGraph);
  }
  return { core: current, graph: confirmedGraph };
}
const guid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid graph response.");
  return value as Record<string, unknown>;
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(identifier => typeof identifier !== "string" || !guid.test(identifier)) || new Set(value).size !== value.length) throw new Error("Invalid related identifiers.");
  return value;
}
export function parseGraph(result: DraftResult): GraphSnapshot {
  if (!result.success || typeof result.data?.ResultJson !== "string") throw new Error("Dataverse did not confirm the graph operation.");
  const data = object(JSON.parse(result.data.ResultJson));
  if (typeof data.id !== "string" || !guid.test(data.id) || typeof data.rowVersion !== "string" || !/^\d+$/.test(data.rowVersion)) throw new Error("Invalid graph version.");
  const graph = object(data.graph);
  if (!Array.isArray(graph.contributors) || !Array.isArray(data.hours) || data.hours.length !== graph.contributors.length || data.hours.some(hours => hours !== null && (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0))) throw new Error("Invalid contributors or hours.");
  const contributors = graph.contributors.map(value => {
    const person = object(value);
    if (typeof person.id !== "string" || !guid.test(person.id) || typeof person.personId !== "string" || !guid.test(person.personId)) throw new Error("Invalid contributor identifier.");
    for (const field of ["directHours", "allocation"]) {
      const number = person[field];
      if (number !== null && (typeof number !== "number" || !Number.isFinite(number) || number < 0)) throw new Error("Invalid effort number.");
    }
    for (const field of ["startDate", "endDate"]) if (person[field] !== null && (typeof person[field] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(person[field] as string))) throw new Error("Invalid effort date.");
    if (person.roleValue !== null && person.roleValue !== undefined && !CONTRIBUTOR_ROLE_VALUE_SET.has(person.roleValue as number)) throw new Error("Invalid contributor role.");
    return { id: person.id, personId: person.personId, directHours: person.directHours as number | null, allocation: person.allocation as number | null, startDate: person.startDate as string | null, endDate: person.endDate as string | null, roleValue: (person.roleValue as number | null) ?? null };
  });
  if (new Set(contributors.map(person => person.personId)).size !== contributors.length) throw new Error("Duplicate contributor.");
  return { id: data.id, rowVersion: data.rowVersion, graph: { contributors, technologyIds: ids(graph.technologyIds), industryIds: ids(graph.industryIds), projectIds: ids(graph.projectIds), areaIds: ids(graph.areaIds) }, hours: data.hours as (number | null)[] };
}
export function graphPayload(graph: DraftGraph): string {
  return JSON.stringify({
    contributors: graph.contributors.map(person => ({ id: person.id, personId: person.personId, directHours: person.directHours, startDate: person.startDate, endDate: person.endDate, allocation: person.allocation, roleValue: person.roleValue })),
    technologyIds: graph.technologyIds, industryIds: graph.industryIds, projectIds: graph.projectIds, areaIds: graph.areaIds,
  });
}

export function contributorCredit(person: Contributor, maturity: number, name: string, hours: number | null, email?: string) {
  const preview = contributorEffort(person, maturity);
  return { name, hours, email, effortMode: maturity === 125060001 || maturity === 125060004 ? "direct" as const : "calendar" as const,
    startDate: person.startDate, endDate: person.endDate, allocation: person.allocation, businessDays: preview.error ? null : preview.businessDays,
    contributorRole: person.roleValue != null ? CONTRIBUTOR_ROLE_BY_VALUE[person.roleValue] : undefined };
}