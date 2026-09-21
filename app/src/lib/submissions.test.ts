import assert from "node:assert/strict";
import test from "node:test";
import type { Solution } from "../types.ts";
import { migrateSubmission, REVIEW_COMMENT_LIMIT, reviewContribution, saveContribution } from "./submissions.ts";
import { presentCatalogue } from "./catalogue.ts";

const solution: Solution = {
  id: "submission", name: "Test solution", summary: "Summary", whatItDoes: "Description", businessValue: "Value",
  specializationArea: "ai", contributors: [{ id: "contributor", builtBy: { id: "builder", name: "Builder", email: "builder@example.com" }, effortMode: "direct", directHours: 12, startDate: "", endDate: "", allocation: 100, calendarId: "us-federal-2026" }], status: "Working prototype", publicationStatus: "Draft",
  safetyAcknowledged: true, clientSafeReviewed: false, dateAdded: "2026-09-21", searchKeywords: "",
  capabilities: ["AI & agents"], technologies: [], industries: [], assets: [], images: [{ id: "image", src: "data:image/png;base64,test" }],
};

test("draft, return, resubmit and publish preserve the record and media", () => {
  const pending = saveContribution(solution, "Pending review");
  const returned = reviewContribution(pending, "return", "  Please improve the screenshot.  ", false);
  assert.equal(returned.publicationStatus, "Draft");
  assert.equal(returned.reviewComments, "Please improve the screenshot.");
  assert.equal(returned.reviewOutcome, "Changes requested");
  assert.equal(returned.clientSafeReviewed, false);
  assert.equal(returned.safetyAcknowledged, false);
  const resubmitted = saveContribution({ ...returned, safetyAcknowledged: true }, "Pending review", returned);
  assert.equal(resubmitted.reviewComments, returned.reviewComments);
  assert.equal(resubmitted.reviewOutcome, "Changes requested");
  const published = reviewContribution(resubmitted, "publish", "Cleared.", true);
  assert.equal(published.reviewOutcome, "Approved");
  assert.equal(published.id, solution.id);
  assert.deepEqual(published.images, solution.images);
  assert.equal(presentCatalogue([published]).length, 1);
  assert.equal(presentCatalogue([published])[0].reviewComments, undefined);
  assert.equal(presentCatalogue([published])[0].reviewOutcome, undefined);
  const edited = saveContribution(published, "Draft", published);
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
  assert.throws(() => reviewContribution(pending, "return", "x".repeat(REVIEW_COMMENT_LIMIT + 1), false));
  assert.equal(reviewContribution(pending, "return", "x".repeat(REVIEW_COMMENT_LIMIT), false).reviewComments?.length, REVIEW_COMMENT_LIMIT);
});

test("contributor saves cannot replace protected review fields or editorial notes", () => {
  const previous = { ...solution, reviewOutcome: "Changes requested" as const, reviewComments: "Fix the image.", libraryNotes: "Editorial note" };
  const forged = { ...previous, reviewOutcome: "Approved" as const, reviewComments: "Cleared", libraryNotes: "Changed", clientSafeReviewed: true };
  const saved = saveContribution(forged, "Draft", previous);
  assert.equal(saved.reviewOutcome, previous.reviewOutcome);
  assert.equal(saved.reviewComments, previous.reviewComments);
  assert.equal(saved.libraryNotes, previous.libraryNotes);
  assert.equal(saved.clientSafeReviewed, false);
  const created = saveContribution(forged, "Draft");
  assert.equal(created.reviewOutcome, "None");
  assert.equal(created.reviewComments, undefined);
  const reviewed = reviewContribution({ ...previous, publicationStatus: "Pending review" }, "return", "New feedback", false);
  assert.equal(reviewed.libraryNotes, "Editorial note");
});

test("legacy browser feedback migrates without deleting notes, media or identity", () => {
  const legacy = { owner: "builder@example.com", changesRequested: true, solution: { ...solution, libraryNotes: "Please revise." } };
  const migrated = migrateSubmission(legacy);
  assert.equal(migrated.solution.reviewOutcome, "Changes requested");
  assert.equal(migrated.solution.reviewComments, "Please revise.");
  assert.equal(migrated.solution.libraryNotes, "Please revise.");
  assert.equal(migrated.owner, legacy.owner);
  assert.deepEqual(migrated.solution.images, legacy.solution.images);
  assert.equal(Object.hasOwn(migrated, "changesRequested"), false);
  assert.deepEqual(migrateSubmission(migrated), migrated);
  const ambiguous = migrateSubmission({ owner: legacy.owner, solution: legacy.solution });
  assert.equal(ambiguous.solution.reviewOutcome, "None");
  assert.equal(ambiguous.solution.reviewComments, undefined);
  assert.equal(ambiguous.solution.libraryNotes, "Please revise.");
});

test("incomplete drafts save, but submit and approval require complete valid data", () => {
  const incomplete = { ...solution, name: "", summary: "", capabilities: [], contributors: [], images: [], safetyAcknowledged: false };
  assert.equal(saveContribution(incomplete, "Draft").name, "Untitled solution");
  const invalid: Solution[] = [
    incomplete, { ...solution, name: "Untitled solution" }, { ...solution, summary: "" },
    { ...solution, capabilities: [] }, { ...solution, capabilities: ["AI & agents", "Data platform"] },
    { ...solution, clientContext: "Internal client", clientContextRedacted: "" },
    { ...solution, contributors: [] }, { ...solution, contributors: [...solution.contributors, ...solution.contributors] },
    { ...solution, contributors: [{ ...solution.contributors[0], directHours: undefined }] },
    { ...solution, status: "Client demo" },
  ];
  for (const candidate of invalid) {
    assert.doesNotThrow(() => saveContribution(candidate, "Draft"));
    assert.throws(() => saveContribution(candidate, "Pending review"));
    assert.throws(() => reviewContribution({ ...candidate, publicationStatus: "Pending review" }, "publish", "", true));
  }
});