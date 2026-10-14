import assert from "node:assert/strict";
import test from "node:test";
import { addressSuggestion, parseOpenFeedback, parseSuggestions, type SuggestionApi } from "./suggestions.ts";

const id = "11111111-1111-1111-1111-111111111111";
const solution = "22222222-2222-2222-2222-222222222222";

test("suggestions carry the server's addressedOn when the plug-in reports it, and reject a malformed one", () => {
  const row = { id, text: "Add an export.", author: "Ana", createdOn: "2026-10-14T10:00:00Z" };
  assert.equal(parseSuggestions({ canRead: true, suggestions: [row] }).suggestions[0].addressedOn, undefined);
  assert.equal(parseSuggestions({ canRead: true, suggestions: [{ ...row, addressedOn: null }] }).suggestions[0].addressedOn, null);
  assert.equal(parseSuggestions({ canRead: true, suggestions: [{ ...row, addressedOn: "2026-10-14T11:00:00Z" }] }).suggestions[0].addressedOn, "2026-10-14T11:00:00Z");
  assert.throws(() => parseSuggestions({ canRead: true, suggestions: [{ ...row, addressedOn: "yesterday" }] }));
});

test("open feedback parses ids and refuses anything else", () => {
  assert.deepEqual(parseOpenFeedback({ suggestions: [{ id: id.toUpperCase(), solutionId: solution }], changesRequested: [solution] }), { suggestions: [{ id, solutionId: solution }], changesRequested: [solution] });
  assert.throws(() => parseOpenFeedback({ suggestions: [{ id: "x", solutionId: solution }], changesRequested: [] }));
  assert.throws(() => parseOpenFeedback({ suggestions: [] }));
});

test("addressing needs the registered API and the server's confirmation", async () => {
  const base: SuggestionApi = { list: async () => ({ success: true, data: {} }), send: async () => ({ success: true, data: {} }) };
  await assert.rejects(addressSuggestion(base, id, true));
  const calls: [string, boolean][] = [];
  const api: SuggestionApi = { ...base, address: async (suggestionId, addressed) => { calls.push([suggestionId, addressed]); return { success: true, data: { ResultJson: JSON.stringify({ id: suggestionId, addressedOn: addressed ? "2026-10-14T11:00:00Z" : null }) } }; } };
  await addressSuggestion(api, id, true);
  assert.deepEqual(calls, [[id, true]]);
  const wrong: SuggestionApi = { ...base, address: async () => ({ success: true, data: { ResultJson: JSON.stringify({ id: solution }) } }) };
  await assert.rejects(addressSuggestion(wrong, id, true));
});