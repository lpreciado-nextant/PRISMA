import { strict as assert } from "node:assert";
import { test } from "node:test";
import { presentCatalogue } from "./catalogue.ts";
import { SOLUTIONS } from "../data/solutions.ts";
import { matchesQuery } from "./search.ts";

test("present catalogue requires publication, acknowledgment and independent review", () => {
  const example = SOLUTIONS[0];
  assert.equal(presentCatalogue([{ ...example, publicationStatus: "Pending review" }]).length, 0);
  assert.equal(presentCatalogue([{ ...example, safetyAcknowledged: false }]).length, 0);
  assert.equal(presentCatalogue([{ ...example, clientSafeReviewed: false }]).length, 0);
  assert.equal(presentCatalogue([example]).length, 1);
  assert(!presentCatalogue(SOLUTIONS).some((solution) => ["kairo", "field-ops-companion"].includes(solution.id)));
});

test("client identity is searchable internally but absent from present catalogue", () => {
  const example = SOLUTIONS[0];
  const presented = presentCatalogue([example])[0];
  assert(matchesQuery(example, "Contoso"));
  assert(!matchesQuery(presented, "Contoso"));
  assert.equal(presented.clientContext, undefined);
  assert.equal(presented.projects, undefined);
  assert.equal(presented.libraryNotes, undefined);
  assert.equal(presented.clientContextRedacted, example.clientContextRedacted);
  assert(example.clientContext);
});
test("builders, CSM rows, effort and cost are absent from present catalogue", () => {
  const example = SOLUTIONS[0];
  const presented = presentCatalogue([example])[0];
  assert(example.contributors.some((contributor) => contributor.contributorRole === "CSM") && example.estimatedCost);
  assert.deepEqual(presented.contributors, []);
  assert.equal(presented.contributorNames, undefined);
  assert.equal(presented.estimatedCost, undefined);
  assert(!matchesQuery(presented, example.contributors[0].builtBy.name));
});

test("a solution tagged with several specialization areas is found and counted under each", async () => {
  const { filterSolutions, areaCounts, EMPTY_FILTERS } = await import("./search.ts");
  const multi = SOLUTIONS.find((solution) => solution.id === "bso-quota")!;
  assert.deepEqual(multi.specializationAreas, ["ai", "data"]);
  assert.equal(multi.specializationArea, "ai");
  for (const area of ["ai", "data"] as const) {
    assert(filterSolutions(SOLUTIONS, { ...EMPTY_FILTERS, area }).includes(multi));
  }
  assert(!filterSolutions(SOLUTIONS, { ...EMPTY_FILTERS, area: "ibo" }).includes(multi));
  const counts = areaCounts(SOLUTIONS, EMPTY_FILTERS);
  assert.equal(counts.get("all"), SOLUTIONS.length);
  assert(SOLUTIONS.reduce((total, solution) => total + (solution.specializationAreas?.length ?? 1), 0) === ["ai", "data", "ibo"].reduce((total, area) => total + (counts.get(area as "ai") ?? 0), 0));
});

test("target client role filters any-of, survives the URL and is counted in the facet rail", async () => {
  const { filterSolutions, facetCounts, filtersFromQuery, filtersToQuery, EMPTY_FILTERS } = await import("./search.ts");
  const roles = ["Chief of Staff", "Business Unit Leader"];
  const matched = filterSolutions(SOLUTIONS, { ...EMPTY_FILTERS, roles });
  assert(matched.length > 0);
  assert(matched.every((solution) => solution.clientRole && roles.includes(solution.clientRole)));
  assert.equal(matched.length, SOLUTIONS.filter((solution) => solution.clientRole && roles.includes(solution.clientRole)).length);
  const query = new URLSearchParams(Object.entries(filtersToQuery({ ...EMPTY_FILTERS, roles })).filter((entry): entry is [string, string] => entry[1] !== undefined));
  assert.deepEqual(filtersFromQuery(query).roles, roles);
  assert.equal(facetCounts(SOLUTIONS, EMPTY_FILTERS, "roles").get("Chief of Staff"), SOLUTIONS.filter((solution) => solution.clientRole === "Chief of Staff").length);
});

test("role choices mirror the live nx_clientrole and nx_role values", async () => {
  const { CLIENT_ROLE_VALUES, CLIENT_ROLES, CONTRIBUTOR_ROLE_VALUES } = await import("../data/catalogueMetadata.ts");
  assert.equal(CLIENT_ROLES.length, 14);
  assert.equal(CLIENT_ROLES[0], "Chief of Staff");
  assert.equal(CLIENT_ROLE_VALUES["Chief Financial Officer (CFO)"], 125060009);
  assert.equal(new Set(Object.values(CLIENT_ROLE_VALUES)).size, 14);
  assert.deepEqual(CONTRIBUTOR_ROLE_VALUES, { CSM: 125060000, Consultant: 125060001 });
  assert(SOLUTIONS.every((solution) => !solution.clientRole || CLIENT_ROLES.includes(solution.clientRole)));
});

test("the CSM is a contributor row with nx_role = CSM and adds no effort in the mock", async () => {
  const { calculateEffort } = await import("./effort.ts");
  const { BUSINESS_CALENDARS } = await import("../data/catalogueMetadata.ts");
  for (const solution of SOLUTIONS) {
    const csms = solution.contributors.filter((contributor) => contributor.contributorRole === "CSM");
    assert.equal(csms.length, 1, solution.id);
    assert(solution.contributors.some((contributor) => contributor.contributorRole === "Consultant"), solution.id);
    assert.equal(calculateEffort(csms[0], BUSINESS_CALENDARS.find((calendar) => calendar.id === csms[0].calendarId)).hours, 0);
  }
});
