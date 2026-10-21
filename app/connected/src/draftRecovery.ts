import { coreFields, EMPTY_DRAFT, MATURITY_OPTIONS, type CoreDraft } from "./drafts.ts";
import { emptyGraph, type DraftGraph } from "./draftGraph.ts";
import { COMPLEXITY_BY_CHOICE, MAX_ESTIMATED_HOURS } from "../../src/lib/effort.ts";

const prefix = "prisma.connected.recovery:";
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type DraftRecovery = { version: 1; owner: string; id: string; rowVersion: string; draft: CoreDraft; graph: DraftGraph; step: number; uncertain: boolean };
export const recoveryKey = (owner: string, id?: string) => `${prefix}${owner.toLowerCase()}:${id ?? "new"}`;
export function clearRecoveries(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index--) { const key = storage.key(index); if (key?.startsWith(prefix)) storage.removeItem(key); }
}
export function recoveryPayload(owner: string, id: string | undefined, rowVersion: string | undefined, draft: CoreDraft, graph: DraftGraph, step: number, uncertain = false): string {
  return JSON.stringify({ version: 1, owner: owner.toLowerCase(), id: id ?? "new", rowVersion: rowVersion ?? "", draft: coreFields(draft),
    graph: { contributors: graph.contributors.map(person => ({ id: person.id, personId: person.personId })), technologyIds: graph.technologyIds, industryIds: graph.industryIds, projectIds: graph.projectIds, areaIds: graph.areaIds, clientRoleIds: graph.clientRoleIds }, step, uncertain });
}
export function parseRecovery(text: string, owner: string, id?: string): DraftRecovery {
  if (text.length > 200000) throw new Error("Recovery is oversized.");
  const value = JSON.parse(text) as DraftRecovery;
  if (value?.version !== 1 || value.owner !== owner.toLowerCase() || value.id !== (id ?? "new") || typeof value.rowVersion !== "string" || (id ? !/^\d+$/.test(value.rowVersion) : value.rowVersion !== "") || !Number.isInteger(value.step) || value.step < 0 || value.step > 5) throw new Error("Invalid recovery identity.");
  if (value.uncertain !== undefined && typeof value.uncertain !== "boolean") throw new Error("Invalid recovery operation state.");
  const draft = value.draft;
  // Recoveries written before challenges and lessons learned existed have neither field.
  if (draft && typeof draft === "object") { draft.challenges ??= ""; draft.lessonsLearned ??= ""; }
  if (!draft || Object.keys(EMPTY_DRAFT).some(key => typeof draft[key as keyof CoreDraft] !== typeof EMPTY_DRAFT[key as keyof CoreDraft]) || !MATURITY_OPTIONS.some(option => option.value === draft.maturity)) throw new Error("Invalid recovery draft.");
  for (const [key, limit] of Object.entries({ name: 100, summary: 200, whatItDoes: 4000, businessValue: 4000, clientContext: 200, clientContextRedacted: 200, challenges: 2000, lessonsLearned: 2000 })) if ((draft[key as keyof CoreDraft] as string).length > limit) throw new Error("Invalid recovery text.");
  if (draft.capabilityId && !guid.test(draft.capabilityId)) throw new Error("Invalid recovery reference.");
  if ((draft.estimatedMinimumHours != null && (!Number.isInteger(draft.estimatedMinimumHours) || draft.estimatedMinimumHours < 0 || draft.estimatedMinimumHours > MAX_ESTIMATED_HOURS))
    || (draft.complexityValue != null && !COMPLEXITY_BY_CHOICE[draft.complexityValue])) throw new Error("Invalid recovery effort.");
  const graph = value.graph;
  if (!graph || !Array.isArray(graph.contributors) || graph.contributors.length > 100) throw new Error("Invalid recovery contributors.");
  for (const person of graph.contributors) {
    if (!person || (person.personId !== "" && !guid.test(person.personId)) || (person.id !== null && !guid.test(person.id))) throw new Error("Invalid recovery person.");
    // Older recoveries carry per-person hours, dates, allocation or a role; re-serializing below drops them.
  }
  // Recoveries written before specialization areas moved to the graph carry no areaIds; they restore with none selected.
  if (graph.areaIds === undefined) graph.areaIds = [];
  // Likewise recoveries written before client roles became N:N (PR-031).
  if (graph.clientRoleIds === undefined) graph.clientRoleIds = [];
  for (const key of ["technologyIds", "industryIds", "projectIds", "areaIds", "clientRoleIds"] as const) if (!Array.isArray(graph[key]) || graph[key].length > 100 || graph[key].some(identifier => typeof identifier !== "string" || !guid.test(identifier))) throw new Error("Invalid recovery tags.");
  return JSON.parse(recoveryPayload(owner, id, value.rowVersion, { ...draft, safetyAcknowledged: false }, { ...emptyGraph(), ...graph }, value.step, value.uncertain ?? true)) as DraftRecovery;
}