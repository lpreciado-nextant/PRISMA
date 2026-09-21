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