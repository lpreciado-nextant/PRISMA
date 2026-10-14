import assert from "node:assert/strict";
import test from "node:test";
import { feedbackKeys, isAddressed, openFeedback, openFeedbackCount, recordServerAddressed, reviewFeedbackKey, setAddressWriter, setAddressed, setFeedbackItems, suggestionFeedbackKey } from "./feedbackSeen.ts";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
} });

const returned = { id: "S1", publicationStatus: "Draft" as const, reviewOutcome: "Changes requested" as const, reviewComments: "Blur the client logo." };

test("feedback items: a draft returned with Changes requested, and each suggestion", () => {
  assert.equal(reviewFeedbackKey({ ...returned, reviewOutcome: "None" }), undefined);
  // Retired reasons and approval notes are information, not work to do.
  assert.equal(reviewFeedbackKey({ id: "r", publicationStatus: "Retired", reviewOutcome: "Approved" }), undefined);
  assert.equal(reviewFeedbackKey({ id: "p", publicationStatus: "Published", reviewOutcome: "Approved" }), undefined);
  assert.deepEqual(feedbackKeys(returned, ["A", "b"]), ["review:s1", "suggestion:a", "suggestion:b"]);
});

test("without a writer, suggestions are addressed in this browser; the librarian comment cannot be checked off", () => {
  store.clear();
  setAddressWriter(undefined);
  const keys = feedbackKeys(returned, ["a", "b"]);
  setFeedbackItems(keys);
  assert.equal(openFeedbackCount(), 3);
  setAddressed(keys[1]);
  assert.equal(isAddressed(keys[1]), true);
  assert.equal(openFeedbackCount(), 2);
  setAddressed(keys[0]);
  assert.equal(isAddressed(keys[0]), false);
  setAddressed(keys[1], false);
  assert.deepEqual(openFeedback(keys), keys);
});

test("with a writer, Dataverse holds the state: shown at once, rolled back if the save fails, and it overrides the browser", async () => {
  store.clear();
  const calls: [string, boolean][] = [];
  let fail = false;
  setAddressWriter(async (id, addressed) => { calls.push([id, addressed]); if (fail) throw new Error("denied"); });
  const key = suggestionFeedbackKey("C");
  setAddressed(key);
  assert.equal(isAddressed(key), true);
  assert.deepEqual(calls, [["c", true]]);
  // Nothing was written to this browser.
  assert.equal(store.get("prisma.feedback.addressed"), undefined);
  fail = true;
  setAddressed(key, false);
  assert.equal(isAddressed(key), false);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(isAddressed(key), true);
  // What the server reports wins over anything kept locally.
  store.set("prisma.feedback.addressed", JSON.stringify([suggestionFeedbackKey("d")]));
  recordServerAddressed([{ key: suggestionFeedbackKey("d"), addressed: false }]);
  assert.equal(isAddressed(suggestionFeedbackKey("d")), false);
  setAddressWriter(undefined);
});
