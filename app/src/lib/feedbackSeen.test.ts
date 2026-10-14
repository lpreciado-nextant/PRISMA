import assert from "node:assert/strict";
import test from "node:test";
import { feedbackKeys, isAddressed, openFeedback, openFeedbackCount, reviewFeedbackKey, setAddressed, setFeedbackItems } from "./feedbackSeen.ts";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
} });

const returned = { id: "s1", publicationStatus: "Draft" as const, reviewOutcome: "Changes requested" as const, reviewComments: "Blur the client logo." };

test("feedback items: the librarian's comment on a returned or retired record, and each suggestion", () => {
  assert.equal(reviewFeedbackKey({ ...returned, reviewOutcome: "None", reviewComments: "" }), undefined);
  // An approval note on a published record is not feedback to address.
  assert.equal(reviewFeedbackKey({ id: "p", publicationStatus: "Published", reviewOutcome: "Approved", reviewComments: "Great work" }), undefined);
  assert.equal(feedbackKeys(returned, ["A", "b"]).length, 3);
  assert.equal(feedbackKeys({ id: "r", publicationStatus: "Retired", reviewOutcome: "Approved", reviewComments: "Replaced by v2" }).length, 1);
});

test("each item is confirmed on its own; counts fall as items are addressed; new librarian words are a new item", () => {
  store.clear();
  const keys = feedbackKeys(returned, ["a", "b"]);
  setFeedbackItems(keys);
  assert.equal(openFeedbackCount(), 3);
  setAddressed(keys[1]);
  assert.equal(isAddressed(keys[1]), true);
  assert.equal(openFeedbackCount(), 2);
  assert.deepEqual(openFeedback(keys), [keys[0], keys[2]]);
  setAddressed(keys[1], false);
  assert.equal(openFeedbackCount(), 3);
  setAddressed(keys[0]);
  assert.notEqual(reviewFeedbackKey({ ...returned, reviewComments: "Also anonymize the summary." }), keys[0]);
  // Keys never hold the feedback text.
  assert.doesNotMatch(store.get("prisma.feedback.addressed") ?? "", /Blur|logo/);
});
