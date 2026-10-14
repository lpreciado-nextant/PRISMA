import assert from "node:assert/strict";
import test from "node:test";
import { submissionFeedbackFields, submissionSolution, type Submission } from "./workflow.ts";
import { feedbackKeys } from "../../src/lib/feedbackSeen.ts";

// Only the fields feedback tracking reads; the rest of the record is irrelevant here.
const record = { core: { id: "11111111-1111-1111-1111-111111111111" }, areaIds: ["22222222-2222-2222-2222-222222222222"], publication: 125060003, outcome: 125060001, comments: "Blur the client logo.", cleared: false } as unknown as Submission;

test("feedback tracking reads a submission without reference names (the masthead's count on entry)", () => {
  // The full card mapping needs area names and refuses without them; the feedback fields never do.
  assert.throws(() => submissionSolution(record, {}));
  assert.deepEqual(submissionFeedbackFields(record), { id: record.core.id, publicationStatus: "Draft", reviewOutcome: "Changes requested", reviewComments: "Blur the client logo." });
  assert.equal(feedbackKeys(submissionFeedbackFields(record), ["a"]).length, 2);
});