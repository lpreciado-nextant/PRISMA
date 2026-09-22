import type { Solution, SolutionStatus, SpecializationArea } from "../../src/types.ts";
import type { IGetAllOptions } from "./generated/models/CommonModels.ts";

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
  "nx_businessvalue", "nx_usecase", "nx_status", "nx_publicationstatus",
  "nx_safetyacknowledged", "nx_clientsafereviewed", "nx_clientcontextredacted",
  "nx_dateadded", "_nx_specializationarea_value", "_nx_capability_value",
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

export async function loadCatalogue(read: ReadRows, present: boolean, signal: AbortSignal, readCredits?: (id: string, present: boolean, signal: AbortSignal) => Promise<string[]>): Promise<Solution[]> {
  const [solutions, areas, capabilities] = await Promise.all([
    readAll(read, "solutions", catalogueQuery(present), signal),
    readAll(read, "areas", { select: ["nx_specializationareaid", "nx_specializationareaname"], orderBy: ["nx_specializationareaid asc"] }, signal),
    readAll(read, "capabilities", { select: ["nx_capabilityid", "nx_capabilityname"], orderBy: ["nx_capabilityid asc"] }, signal),
  ]);
  const areaMap = new Map(areas.map(row => [id(row, "nx_specializationareaid"), text(row, "nx_specializationareaname", true)]));
  const capabilityMap = new Map(capabilities.map(row => [id(row, "nx_capabilityid"), text(row, "nx_capabilityname", true)]));
  const catalogue: Solution[] = [];
  const controller = new AbortController();
  const activeSignal = AbortSignal.any([signal, controller.signal]);
  const hydrate = async (row: object): Promise<Solution> => {
    activeSignal.throwIfAborted();
    if (value(row, "nx_publicationstatus") !== PUBLISHED) throw new Error("Dataverse returned a record outside the published catalogue.");
    const acknowledged = flag(row, "nx_safetyacknowledged");
    const cleared = flag(row, "nx_clientsafereviewed");
    if (present && (!acknowledged || !cleared)) throw new Error("Dataverse returned a record outside the presentation filter.");
    const solutionId = id(row, "nx_solutionid");
    const area = areaMap.get(id(row, "_nx_specializationarea_value"));
    if (area !== "ai" && area !== "data" && area !== "ibo") throw new Error("A solution has an unmapped specialization area.");
    const capability = capabilityMap.get(id(row, "_nx_capability_value"));
    if (!capability) throw new Error("A solution has an unreadable capability.");
    const maturityValue = value(row, "nx_status");
    const status = typeof maturityValue === "number" ? MATURITY[maturityValue] : undefined;
    if (!status) throw new Error("A solution has an unsupported maturity choice.");
    const [technologies, industries, contributorNames] = await Promise.all([
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
    activeSignal.throwIfAborted();
    if (contributorNames && contributorNames.some(name => typeof name !== "string" || !name.trim())) throw new Error("Invalid contributor search projection.");
    return {
      id: solutionId,
      name: text(row, "nx_solutionname", true),
      summary: text(row, "nx_onelinesummary", true),
      whatItDoes: text(row, "nx_whatitdoes"),
      businessValue: text(row, "nx_businessvalue"),
      useCase: text(row, "nx_usecase") || undefined,
      specializationArea: area as SpecializationArea,
      status,
      publicationStatus: "Published",
      safetyAcknowledged: acknowledged,
      clientSafeReviewed: cleared,
      clientContext: present ? undefined : text(row, "nx_clientcontext") || undefined,
      clientContextRedacted: text(row, "nx_clientcontextredacted") || undefined,
      searchKeywords: present ? "" : text(row, "nx_searchkeywords"),
      dateAdded: text(row, "nx_dateadded").slice(0, 10),
      capabilities: [capability],
      technologies: technologies.map(tag => text(tag, "nx_technologyname", true)),
      industries: industries.map(tag => text(tag, "nx_industryname", true)),
      contributors: [],
      ...(contributorNames ? { contributorNames } : {}),
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