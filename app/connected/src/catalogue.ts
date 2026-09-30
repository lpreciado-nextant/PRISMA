import type { ClientRole, Solution, SolutionStatus, SpecializationArea } from "../../src/types.ts";
import { CLIENT_ROLE_BY_VALUE } from "../../src/data/catalogueMetadata.ts";
import type { IGetAllOptions } from "./generated/models/CommonModels.ts";
import { parseMediaItem, type MediaItem } from "./media.ts";

export type CatalogueTable = "solutions" | "areas" | "capabilities" | "technologies" | "industries" | "people" | "projects";
export type ReadRows = (table: CatalogueTable, options: IGetAllOptions) => Promise<{
  success: boolean;
  data: object[];
  skipToken?: string;
}>;

const PUBLISHED = 125060000;
const MATURITY: Record<number, SolutionStatus> = {
  125060000: "Live in production",
  125060001: "Idea / concept",
  125060002: "Client demo",
  125060003: "Retired",
  125060004: "Working prototype",
};
const SOLUTION_COLUMNS = [
  "nx_solutionid", "nx_solutionname", "nx_onelinesummary", "nx_whatitdoes",
  "nx_businessvalue", "nx_status", "nx_publicationstatus",
  "nx_safetyacknowledged", "nx_clientsafereviewed", "nx_clientcontextredacted",
  "nx_dateadded", "_nx_capability_value", "nx_clientrole", "createdon",
];

function value(row: object, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

function text(row: object, key: string, required = false): string {
  const result = value(row, key);
  if (result === undefined || result === null) {
    if (!required) return "";
  } else if (typeof result === "string" && (!required || result.trim())) {
    return result;
  }
  throw new Error(`Dataverse returned a missing or invalid ${key} value.`);
}

function id(row: object, key: string): string {
  const result = text(row, key, true).toLowerCase();
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/.test(result)) {
    throw new Error(`Dataverse returned an invalid ${key} identifier.`);
  }
  return result;
}

const AREA_KEYS: readonly string[] = ["ai", "data", "ibo"];

/** Areas linked through the native N:N, primary first: lowest Sort Order, unordered rows last, ties by id. May be empty, like industries. */
export function orderedAreas(rows: object[]): SpecializationArea[] {
  const areas = rows.map(row => {
    const order = value(row, "nx_sortordernumber");
    const name = text(row, "nx_specializationareaname", true);
    if (!AREA_KEYS.includes(name)) throw new Error("A solution has an unmapped specialization area.");
    return { id: id(row, "nx_specializationareaid"), name: name as SpecializationArea, order: typeof order === "number" ? order : Number.POSITIVE_INFINITY };
  });
  if (new Set(areas.map(area => area.name)).size !== areas.length) throw new Error("A solution has a duplicate specialization area.");
  return areas.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)).map(area => area.name);
}

/** `nx_clientrole` is optional; an unknown choice value means the app is out of date with Dataverse. */
function clientRole(row: object): ClientRole | undefined {
  const result = value(row, "nx_clientrole");
  if (result === undefined || result === null) return undefined;
  const role = typeof result === "number" ? CLIENT_ROLE_BY_VALUE[result] : undefined;
  if (!role) throw new Error("A solution has an unsupported client role choice.");
  return role;
}

function flag(row: object, key: string): boolean {
  const result = value(row, key);
  if (typeof result !== "boolean") throw new Error(`Dataverse did not return a readable ${key} value.`);
  return result;
}

export function catalogueQuery(present: boolean): IGetAllOptions {
  return {
    select: [...SOLUTION_COLUMNS, ...(present ? [] : ["nx_clientcontext", "nx_searchkeywords"])],
    filter: `statecode eq 0 and nx_publicationstatus eq ${PUBLISHED}${present ? " and nx_safetyacknowledged eq true and nx_clientsafereviewed eq true" : ""}`,
    orderBy: ["nx_solutionname asc", "nx_solutionid asc"],
  };
}

export async function readAll(read: ReadRows, table: CatalogueTable, options: IGetAllOptions, signal: AbortSignal): Promise<object[]> {
  const rows: object[] = [];
  const tokens = new Set<string>();
  let skipToken: string | undefined;
  do {
    signal.throwIfAborted();
    const page = await read(table, { ...options, maxPageSize: 250, skipToken });
    signal.throwIfAborted();
    if (!page.success || !Array.isArray(page.data)) {
      throw new Error(`Unable to read ${table}. Check your Dataverse access and connection.`);
    }
    rows.push(...page.data);
    skipToken = page.skipToken;
    if (skipToken) {
      if (tokens.has(skipToken)) throw new Error(`Dataverse repeated a ${table} page. Retry the request.`);
      tokens.add(skipToken);
    }
  } while (skipToken);
  return rows;
}

/** `null`: the graph confirmed no thumbnail. Absent: unknown (older plug-in or per-solution read), so the card reads the detail. */
export type CatalogueGraphEntry = { areas: SpecializationArea[]; technologies: string[]; industries: string[]; contributors?: string[]; thumbnail?: MediaItem | null };
export type CatalogueSolution = Solution & { cardThumbnail?: MediaItem | null };
export type ReadCatalogueGraph = (present: boolean, signal: AbortSignal) => Promise<Map<string, CatalogueGraphEntry>>;

function graphThumbnail(value: unknown): MediaItem {
  const item = parseMediaItem(value);
  if (item.kind !== "thumbnail" || !item.complete || item.storage || item.linkedAsset || item.size !== item.received) throw new Error("Invalid catalogue graph thumbnail.");
  return item;
}

/** Parses `nx_GetCatalogueGraph`. Present mode must carry no builder credits; every name must be readable. */
export function parseCatalogueGraph(result: { success: boolean; data: Record<string, unknown> }, present: boolean): Map<string, CatalogueGraphEntry> {
  if (!result.success || typeof result.data?.ResultJson !== "string") throw new Error("Dataverse did not return the catalogue graph.");
  const parsed = JSON.parse(result.data.ResultJson) as { solutions?: unknown; thumbnails?: unknown };
  const solutions = parsed?.solutions;
  if (!Array.isArray(solutions) || (parsed.thumbnails !== undefined && typeof parsed.thumbnails !== "boolean")) throw new Error("Invalid catalogue graph.");
  const graph = new Map<string, CatalogueGraphEntry>();
  for (const entry of solutions) {
    if (!entry || typeof entry !== "object") throw new Error("Invalid catalogue graph.");
    const solutionId = id(entry, "id");
    if (graph.has(solutionId)) throw new Error("The catalogue graph repeated a solution.");
    const names = (key: string) => {
      const list = value(entry, key);
      if (!Array.isArray(list) || list.some(name => typeof name !== "string" || !name.trim())) throw new Error(`Invalid catalogue graph ${key}.`);
      return list as string[];
    };
    const areas = value(entry, "areas");
    if (!Array.isArray(areas) || areas.some(area => !area || typeof area !== "object")) throw new Error("Invalid catalogue graph areas.");
    if (present && value(entry, "contributors") !== undefined) throw new Error("The presentation catalogue returned builder credits.");
    const thumbnail = value(entry, "thumbnail");
    if (thumbnail !== undefined && parsed.thumbnails !== true) throw new Error("Invalid catalogue graph thumbnail.");
    graph.set(solutionId, {
      areas: orderedAreas(areas), technologies: names("technologies"), industries: names("industries"), ...(present ? {} : { contributors: names("contributors") }),
      ...(parsed.thumbnails === true ? { thumbnail: thumbnail === undefined ? null : graphThumbnail(thumbnail) } : {}),
    });
  }
  return graph;
}

export async function loadCatalogue(read: ReadRows, present: boolean, signal: AbortSignal, readCredits?: (id: string, present: boolean, signal: AbortSignal) => Promise<string[]>, readGraph?: ReadCatalogueGraph): Promise<CatalogueSolution[]> {
  const [solutions, capabilities, graph] = await Promise.all([
    readAll(read, "solutions", catalogueQuery(present), signal),
    readAll(read, "capabilities", { select: ["nx_capabilityid", "nx_capabilityname"], orderBy: ["nx_capabilityid asc"] }, signal),
    // One bulk read replaces several requests per solution; if it fails, the per-solution reads still work.
    readGraph?.(present, signal).catch(() => { signal.throwIfAborted(); return undefined; }),
  ]);
  const capabilityMap = new Map(capabilities.map(row => [id(row, "nx_capabilityid"), text(row, "nx_capabilityname", true)]));
  const catalogue: CatalogueSolution[] = [];
  const controller = new AbortController();
  const activeSignal = AbortSignal.any([signal, controller.signal]);
  const readTags = async (solutionId: string): Promise<CatalogueGraphEntry> => {
    const [areas, technologies, industries, contributors] = await Promise.all([
      readAll(read, "areas", {
        select: ["nx_specializationareaid", "nx_specializationareaname", "nx_sortordernumber"],
        filter: `nx_Solution_nx_SpecializationArea_nx_SpecializationArea/any(solution:solution/nx_solutionid eq ${solutionId})`,
        orderBy: ["nx_specializationareaid asc"],
      }, activeSignal),
      readAll(read, "technologies", {
        select: ["nx_technologyid", "nx_technologyname"],
        filter: `nx_Solution_nx_Technology_nx_Technology/any(solution:solution/nx_solutionid eq ${solutionId})`,
        orderBy: ["nx_technologyid asc"],
      }, activeSignal),
      readAll(read, "industries", {
        select: ["nx_industryid", "nx_industryname"],
        filter: `nx_Solution_nx_Industry_nx_Industry/any(solution:solution/nx_solutionid eq ${solutionId})`,
        orderBy: ["nx_industryid asc"],
      }, activeSignal),
      readCredits?.(solutionId, present, activeSignal),
    ]);
    return {
      areas: orderedAreas(areas),
      technologies: technologies.map(tag => text(tag, "nx_technologyname", true)),
      industries: industries.map(tag => text(tag, "nx_industryname", true)),
      contributors,
    };
  };
  const hydrate = async (row: object): Promise<CatalogueSolution> => {
    activeSignal.throwIfAborted();
    if (value(row, "nx_publicationstatus") !== PUBLISHED) throw new Error("Dataverse returned a record outside the published catalogue.");
    const acknowledged = flag(row, "nx_safetyacknowledged");
    const cleared = flag(row, "nx_clientsafereviewed");
    if (present && (!acknowledged || !cleared)) throw new Error("Dataverse returned a record outside the presentation filter.");
    const solutionId = id(row, "nx_solutionid");
    const capability = capabilityMap.get(id(row, "_nx_capability_value"));
    if (!capability) throw new Error("A solution has an unreadable capability.");
    const maturityValue = value(row, "nx_status");
    const status = typeof maturityValue === "number" ? MATURITY[maturityValue] : undefined;
    if (!status) throw new Error("A solution has an unsupported maturity choice.");
    // A solution published after the bulk read is absent from it and is read on its own.
    const bulk = graph?.get(solutionId);
    const tags = bulk ? { ...bulk, contributors: present ? [] : bulk.contributors } : await readTags(solutionId);
    activeSignal.throwIfAborted();
    const { areas: specializationAreas, technologies, industries, contributors: contributorNames, thumbnail } = tags;
    if (contributorNames && contributorNames.some(name => typeof name !== "string" || !name.trim())) throw new Error("Invalid contributor search projection.");
    return {
      id: solutionId,
      name: text(row, "nx_solutionname", true),
      summary: text(row, "nx_onelinesummary", true),
      whatItDoes: text(row, "nx_whatitdoes"),
      businessValue: text(row, "nx_businessvalue"),
      // A solution with no linked area (legacy or test data) still loads; "ai" only supplies the card colour.
      specializationArea: specializationAreas[0] ?? "ai",
      specializationAreas,
      status,
      publicationStatus: "Published",
      safetyAcknowledged: acknowledged,
      clientSafeReviewed: cleared,
      clientContext: present ? undefined : text(row, "nx_clientcontext") || undefined,
      clientContextRedacted: text(row, "nx_clientcontextredacted") || undefined,
      searchKeywords: present ? "" : text(row, "nx_searchkeywords"),
      dateAdded: text(row, "nx_dateadded").slice(0, 10),
      createdOn: text(row, "createdon") || undefined,
      capabilities: [capability],
      technologies,
      industries,
      clientRole: clientRole(row),
      contributors: [],
      ...(contributorNames ? { contributorNames } : {}),
      ...(thumbnail !== undefined ? { cardThumbnail: thumbnail } : {}),
      assets: [],
    };
  };
  try {
    for (let offset = 0; offset < solutions.length; offset += 4) {
      activeSignal.throwIfAborted();
      catalogue.push(...await Promise.all(solutions.slice(offset, offset + 4).map(hydrate)));
    }
    return catalogue;
  } catch (error) {
    controller.abort();
    throw error;
  }
}