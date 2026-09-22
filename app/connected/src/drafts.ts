import { readAll, type ReadRows } from "./catalogue.ts";

export const MATURITY_OPTIONS = [
  { value: 125060001, label: "Idea / concept" },
  { value: 125060004, label: "Working prototype" },
  { value: 125060002, label: "Client demo" },
  { value: 125060000, label: "Live in production" },
] as const;

export interface CoreDraft {
  name: string;
  summary: string;
  areaId: string;
  capabilityId: string;
  maturity: number;
  whatItDoes: string;
  businessValue: string;
  clientContext: string;
  clientContextRedacted: string;
  safetyAcknowledged: boolean;
}

export interface SavedDraft extends CoreDraft { id: string; rowVersion: string }
export interface DraftOption { id: string; name: string }
export interface DraftReferences { areas: DraftOption[]; capabilities: DraftOption[] }
export interface DraftResult { success: boolean; data: Record<string, unknown> }
export interface DraftApi {
  list: (page: number, cookie?: string) => Promise<DraftResult>;
  save: (json: string, id?: string, rowVersion?: string) => Promise<DraftResult>;
}

export const EMPTY_DRAFT: CoreDraft = {
  name: "", summary: "", areaId: "", capabilityId: "", maturity: 125060004,
  whatItDoes: "", businessValue: "", clientContext: "",
  clientContextRedacted: "", safetyAcknowledged: false,
};

const GUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const TEXT_FIELDS = ["name", "summary", "areaId", "capabilityId", "whatItDoes", "businessValue", "clientContext", "clientContextRedacted"] as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid draft response.");
  return value as Record<string, unknown>;
}

function response(result: DraftResult): Record<string, unknown> {
  if (!result.success || typeof result.data?.ResultJson !== "string") throw new Error("Dataverse did not confirm the draft operation.");
  return record(JSON.parse(result.data.ResultJson));
}

export function snapshot(value: unknown): SavedDraft {
  const row = record(value);
  if (typeof row.id !== "string" || !GUID.test(row.id) || typeof row.rowVersion !== "string" || !/^\d+$/.test(row.rowVersion)) {
    throw new Error("Invalid draft identifier or version.");
  }
  if (TEXT_FIELDS.some(field => typeof row[field] !== "string") || typeof row.safetyAcknowledged !== "boolean"
    || !MATURITY_OPTIONS.some(option => option.value === row.maturity)
    || !GUID.test(row.areaId as string) || (row.capabilityId !== "" && !GUID.test(row.capabilityId as string))) {
    throw new Error("Invalid core draft fields.");
  }
  return { ...coreFields(row as unknown as CoreDraft), id: row.id, rowVersion: row.rowVersion };
}

export function coreFields(draft: CoreDraft): CoreDraft {
  return {
    name: draft.name, summary: draft.summary, areaId: draft.areaId, capabilityId: draft.capabilityId,
    maturity: draft.maturity, whatItDoes: draft.whatItDoes, businessValue: draft.businessValue,
    clientContext: draft.clientContext, clientContextRedacted: draft.clientContextRedacted,
    safetyAcknowledged: draft.safetyAcknowledged,
  };
}

export async function loadDrafts(api: DraftApi, signal: AbortSignal): Promise<SavedDraft[]> {
  const drafts: SavedDraft[] = [];
  const cookies = new Set<string>();
  const identifiers = new Set<string>();
  let cookie: string | undefined;
  for (let page = 1; page <= 10000; page++) {
    signal.throwIfAborted();
    const result = await api.list(page, cookie);
    signal.throwIfAborted();
    const data = response(result);
    if (!Array.isArray(data.records) || typeof data.moreRecords !== "boolean") throw new Error("Invalid draft page.");
    for (const item of data.records) {
      const draft = snapshot(item);
      if (identifiers.has(draft.id)) throw new Error("Draft list changed while loading. Retry.");
      identifiers.add(draft.id);
      drafts.push(draft);
    }
    if (!data.moreRecords) return drafts;
    if (typeof data.pagingCookie !== "string" || !data.pagingCookie || cookies.has(data.pagingCookie)) throw new Error("Invalid draft page token.");
    cookie = data.pagingCookie;
    cookies.add(cookie);
  }
  throw new Error("Draft page limit exceeded.");
}

export async function saveDraft(api: DraftApi, draft: CoreDraft, saved: SavedDraft | undefined, signal: AbortSignal): Promise<SavedDraft> {
  signal.throwIfAborted();
  const result = await api.save(JSON.stringify(coreFields(draft)), saved?.id, saved?.rowVersion);
  signal.throwIfAborted();
  const next = snapshot(response(result));
  if (saved && (next.id !== saved.id || next.rowVersion === saved.rowVersion)) throw new Error("Dataverse did not return the updated draft version.");
  return next;
}

export async function loadDraftReferences(read: ReadRows, signal: AbortSignal): Promise<DraftReferences> {
  const definitions = [
    { table: "areas", id: "nx_specializationareaid", name: "nx_specializationareaname" },
    { table: "capabilities", id: "nx_capabilityid", name: "nx_capabilityname" },
  ] as const;
  const [areas, capabilities] = await Promise.all(definitions.map(async definition => {
    const rows = await readAll(read, definition.table, {
      select: [definition.id, definition.name], filter: "statecode eq 0", orderBy: [`${definition.name} asc`],
    }, signal);
    return rows.map(item => {
      const row = record(item);
      const identifier = row[definition.id];
      const name = row[definition.name];
      if (typeof identifier !== "string" || !GUID.test(identifier) || typeof name !== "string" || !name.trim()) throw new Error("Invalid draft reference data.");
      return { id: identifier, name };
    });
  }));
  if (!areas.length) throw new Error("No specialization areas are available.");
  return { areas, capabilities };
}