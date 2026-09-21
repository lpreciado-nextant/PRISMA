import assert from "node:assert/strict";
import test from "node:test";
import type { Solution } from "../types.ts";
import { reviewContribution, saveContribution } from "./submissions.ts";
import { presentCatalogue } from "./catalogue.ts";

const solution: Solution = {
  id: "submission", name: "Test solution", summary: "Summary", whatItDoes: "Description", businessValue: "Value",
  specializationArea: "ai", contributors: [], status: "Working prototype", publicationStatus: "Draft",
  safetyAcknowledged: true, clientSafeReviewed: false, dateAdded: "2026-09-21", searchKeywords: "",
  capabilities: [], technologies: [], industries: [], assets: [], images: [{ id: "image", src: "data:image/png;base64,test" }],
};

test("draft, return, resubmit and publish preserve the record and media", () => {
  const pending = saveContribution(solution, "Pending review");
  const returned = reviewContribution(pending, "return", "  Please improve the screenshot.  ", false);
  assert.equal(returned.publicationStatus, "Draft");
  assert.equal(returned.libraryNotes, "Please improve the screenshot.");
  assert.equal(returned.clientSafeReviewed, false);
  const published = reviewContribution(saveContribution(returned, "Pending review"), "publish", "", true);
  assert.equal(published.id, solution.id);
  assert.deepEqual(published.images, solution.images);
  assert.equal(presentCatalogue([published]).length, 1);
  const edited = saveContribution(published, "Draft");
  assert.equal(edited.clientSafeReviewed, false);
  assert.equal(presentCatalogue([edited]).length, 0);
  assert.equal(published.publicationStatus, "Published");
});

test("review requires a pending record, return comments, and explicit safety clearance", () => {
  assert.throws(() => reviewContribution(solution, "publish", "", true));
  const pending = saveContribution(solution, "Pending review");
  assert.throws(() => reviewContribution(pending, "return", "  ", false));
  assert.throws(() => reviewContribution(pending, "publish", "", false));
  assert.throws(() => reviewContribution({ ...pending, safetyAcknowledged: false }, "publish", "", true));
  assert.throws(() => reviewContribution({ ...pending, images: [] }, "publish", "", true));
});