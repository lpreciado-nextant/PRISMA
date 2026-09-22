import { MATURITY_OPTIONS, snapshot, type SavedDraft } from "./drafts.ts";
import type { Solution } from "../../src/types.ts";
import { parseGraph, type GraphSnapshot, type Contributor } from "./draftGraph.ts";
import { parseMedia, type MediaItem } from "./media.ts";
import { readAll, type ReadRows } from "./catalogue.ts";

export const PUBLICATIONS: Record<number, string> = { 125060000: "Published", 125060001: "Retired", 125060002: "Pending review", 125060003: "Draft" };
export type Submission = { core: SavedDraft; publication: number; outcome: number; comments: string; cleared: boolean; owner?: string; dateAdded?: string; imageCount?: number; attachmentCount?: number; libraryNotes?: string };
export type SubmissionDetail = { record: Submission; graph: GraphSnapshot; media: MediaItem[]; librarian: boolean };
export type PublishedDetail = { id: string; rowVersion: string; contributors: { name: string; hours: number | null; email?: string; effort?: Contributor }[]; totalHours: number; projects: string[]; media: MediaItem[]; libraryNotes?: string };
export function mediaAsset(item: MediaItem, index: number): Solution["assets"][number] {
  return { id: item.id, name: item.name, assetType: item.mime === "text/html" ? "Self-contained HTML file" : item.mime.startsWith("video/") ? "Video walkthrough only" : "Client-ready one-pager / slide", allowsEmbedding: item.mime === "text/html" || item.mime.startsWith("video/"), sortOrder: index };
}
export function submissionSolution(record: Submission, names: Record<string, string>): Solution {
  const core = record.core;
  const area = names[core.areaId];
  if (area !== "ai" && area !== "data" && area !== "ibo") throw new Error("Submission specialization unavailable.");
  return {
    id: core.id, name: core.name, summary: core.summary, whatItDoes: core.whatItDoes, businessValue: core.businessValue, useCase: core.useCase,
    specializationArea: area, status: MATURITY_OPTIONS.find(option => option.value === core.maturity)!.label as Solution["status"], publicationStatus: PUBLICATIONS[record.publication] as Solution["publicationStatus"],
    reviewOutcome: record.outcome === 125060001 ? "Changes requested" : record.outcome === 125060002 ? "Approved" : "None", reviewComments: record.comments,
    safetyAcknowledged: core.safetyAcknowledged, clientSafeReviewed: record.cleared, clientContext: core.clientContext || undefined, clientContextRedacted: core.clientContextRedacted || undefined,
    dateAdded: record.dateAdded ?? "", libraryNotes: record.libraryNotes, searchKeywords: "", contributors: [], assets: [], technologies: [], industries: [], capabilities: core.capabilityId ? [names[core.capabilityId] ?? "Unavailable capability"] : [],
  };
}
export type WorkflowApi = {
  list: (review: boolean, page: number, cookie?: string) => Promise<unknown>;
  read: (id: string) => Promise<unknown>;
  transition: (id: string, version: string, action: string, comments: string, cleared: boolean) => Promise<unknown>;
  published: (id: string, present: boolean) => Promise<unknown>;
};
export async function loadSubmissionCardDetails(api: Pick<WorkflowApi, "read">, read: ReadRows, id: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const detail = parseSubmission(await api.read(id));
  signal.throwIfAborted();
  if (detail.record.core.id !== id) throw new Error("Mismatched card detail.");
  const graph = detail.graph.graph;
  const definitions = [
    { table: "people", key: "cr6b0_consultantid", label: "cr6b0_consultantname", ids: graph.contributors.map(person => person.personId) },
    { table: "technologies", key: "nx_technologyid", label: "nx_technologyname", ids: graph.technologyIds },
  ] as const;
  const [names, technologies] = await Promise.all(definitions.map(async definition => {
    if (!definition.ids.length) return [];
    const rows = await readAll(read, definition.table, { select: [definition.key, definition.label], filter: definition.ids.map(identifier => `${definition.key} eq ${identifier}`).join(" or ") }, signal);
    const labels = new Map(rows.map(value => { const row = value as Record<string, unknown>; return [row[definition.key], row[definition.label]]; }));
    return definition.ids.map(identifier => {
      const label = labels.get(identifier);
      if (typeof label !== "string" || !label.trim()) throw new Error("Card reference unavailable.");
      return label;
    });
  }));
  signal.throwIfAborted();
  return { media: detail.media, names, technologies };
}
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid workflow response."); return value as Record<string, unknown>; };
const wrap = (data: unknown) => ({ success: true, data: { ResultJson: JSON.stringify(data) } });
export function workflowData(value: unknown) {
  const result = object(value);
  const data = object(result.data);
  if (result.success !== true || typeof data.ResultJson !== "string") throw new Error("Workflow operation was not confirmed.");
  return object(JSON.parse(data.ResultJson));
}

export async function deleteSubmission(api: WorkflowApi, core: Pick<SavedDraft, "id" | "rowVersion">, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const data = workflowData(await api.transition(core.id, core.rowVersion, "delete", "", false));
  signal.throwIfAborted();
  if (data.deleted !== true || data.id !== core.id) throw new Error("Deletion was not confirmed. Refresh submissions before retrying.");
}
function submission(value: unknown): Submission {
  const row = object(value);
  if (typeof row.publication !== "number" || !PUBLICATIONS[row.publication] || ![125060000, 125060001, 125060002].includes(row.outcome as number) || typeof row.comments !== "string" || typeof row.cleared !== "boolean") throw new Error("Invalid submission state.");
  const metadata: Pick<Submission, "owner" | "dateAdded" | "imageCount" | "attachmentCount" | "libraryNotes"> = {};
  for (const key of ["owner", "dateAdded", "libraryNotes"] as const) if (row[key] !== undefined) { if (typeof row[key] !== "string") throw new Error("Invalid submission metadata."); metadata[key] = row[key]; }
  for (const key of ["imageCount", "attachmentCount"] as const) if (row[key] !== undefined) { if (typeof row[key] !== "number" || !Number.isInteger(row[key]) || row[key] < 0 || row[key] > 6) throw new Error("Invalid submission media count."); metadata[key] = row[key]; }
  return { core: snapshot(row.core), publication: row.publication, outcome: row.outcome as number, comments: row.comments, cleared: row.cleared, ...metadata };
}
export function parseSubmission(value: unknown): SubmissionDetail {
  const data = workflowData(value);
  const record = submission(data.record);
  const graph = parseGraph(wrap(data.graph));
  const media = parseMedia(wrap({ id: record.core.id, rowVersion: record.core.rowVersion, sessionId: null, blockSize: 524288, media: data.media })).media;
  if (typeof data.librarian !== "boolean" || graph.id !== record.core.id || graph.rowVersion !== record.core.rowVersion) throw new Error("Mismatched submission response.");
  return { record, graph, media, librarian: data.librarian };
}
export async function loadSubmissions(api: WorkflowApi, review: boolean, signal: AbortSignal) {
  const records: Submission[] = [];
  const cookies = new Set<string>();
  let cookie: string | undefined;
  for (let page = 1; page <= 10000; page++) {
    signal.throwIfAborted();
    const data = workflowData(await api.list(review, page, cookie));
    signal.throwIfAborted();
    if (!Array.isArray(data.records) || typeof data.moreRecords !== "boolean" || typeof data.librarian !== "boolean") throw new Error("Invalid submissions page.");
    records.push(...data.records.map(submission));
    if (new Set(records.map(item => item.core.id)).size !== records.length) throw new Error("Submission list changed. Retry.");
    if (!data.moreRecords) return { records, librarian: data.librarian };
    if (typeof data.pagingCookie !== "string" || !data.pagingCookie || cookies.has(data.pagingCookie)) throw new Error("Invalid submission page token.");
    cookie = data.pagingCookie;
    cookies.add(cookie);
  }
  throw new Error("Submission page limit exceeded.");
}
export function parsePublished(value: unknown, id: string, present: boolean): PublishedDetail {
  const data = workflowData(value);
  const media = parseMedia(wrap({ ...data, sessionId: null, blockSize: 524288 })).media;
  if (present && data.libraryNotes !== undefined) throw new Error("Internal notes in presentation projection.");
  if (data.libraryNotes !== undefined && typeof data.libraryNotes !== "string") throw new Error("Invalid notes projection.");
  if (data.id !== id || !Array.isArray(data.contributors) || !Array.isArray(data.projects) || data.projects.some(project => typeof project !== "string") || (present && data.projects.length)) throw new Error("Invalid published projection.");
  const contributors = data.contributors.map(value => {
    const row = object(value);
    if (typeof row.name !== "string" || (present ? row.hours !== null : typeof row.hours !== "number" || !Number.isFinite(row.hours) || row.hours < 0)) throw new Error("Invalid contributor credit.");
    if (present && (row.email !== undefined || row.effort !== undefined)) throw new Error("Internal contributor credit in presentation projection.");
    if (row.email !== undefined && typeof row.email !== "string") throw new Error("Invalid contributor email.");
    const effort = row.effort === undefined ? undefined : parseGraph(wrap({ id, rowVersion: data.rowVersion, graph: { contributors: [row.effort], technologyIds: [], industryIds: [], projectIds: [] }, hours: [row.hours] })).graph.contributors[0];
    return { name: row.name, hours: row.hours as number | null, ...(row.email === undefined ? {} : { email: row.email }), ...(effort ? { effort } : {}) };
  });
  if (typeof data.totalHours !== "number" || !Number.isFinite(data.totalHours) || data.totalHours < 0) throw new Error("Invalid effort total.");
  if (media.some(item => !item.complete)) throw new Error("Published media is incomplete.");
  return { id, rowVersion: data.rowVersion as string, contributors, totalHours: data.totalHours, projects: data.projects as string[], media, ...(data.libraryNotes === undefined ? {} : { libraryNotes: data.libraryNotes as string }) };
}
export async function createTechnology(api: WorkflowApi, core: Pick<SavedDraft, "id" | "rowVersion">, name: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const response = await api.transition(core.id, core.rowVersion, "technology", name, false);
  signal.throwIfAborted();
  const data = workflowData(response);
  if (data.id !== core.id || typeof data.rowVersion !== "string" || !/^\d+$/.test(data.rowVersion) || data.rowVersion === core.rowVersion || typeof data.technologyId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.technologyId) || typeof data.name !== "string" || !data.name.trim() || data.name.length > 100) throw new Error("Technology was not confirmed.");
  return { rowVersion: data.rowVersion, option: { id: data.technologyId, name: data.name } };
}