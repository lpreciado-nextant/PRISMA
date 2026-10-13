import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSuggestions, parseSuggestions, sendSuggestion, SUGGESTION_MAX, type SuggestionApi } from "./suggestions.ts";

const solutionId = "45dc1e23-1bb6-f111-aaac-6045bd049fba";
const entry = { id: "A1B2C3D4-1BB6-F111-AAAC-6045BD049FBA", text: "Add an export to Excel.", author: "Ana Gómez", createdOn: "2026-10-13T15:04:05.0000000Z" };
const ok = (value: unknown) => ({ success: true, data: { ResultJson: JSON.stringify(value) } });
const signal = () => new AbortController().signal;

test("readers get suggestions newest first as sent; everyone else gets none, whatever the response holds", async () => {
  const api: SuggestionApi = { list: async id => { assert.equal(id, solutionId); return ok({ canRead: true, suggestions: [entry] }); }, send: async () => ok({}) };
  const list = await loadSuggestions(api, solutionId, signal());
  assert.equal(list.canRead, true);
  assert.deepEqual(list.suggestions, [{ ...entry, id: entry.id.toLowerCase() }]);
  assert.deepEqual(parseSuggestions({ canRead: false, suggestions: [entry] }), { canRead: false, suggestions: [] });
  assert.throws(() => parseSuggestions({ canRead: true, suggestions: [{ ...entry, id: "nope" }] }), /Invalid suggestion/);
  assert.throws(() => parseSuggestions({ canRead: "yes", suggestions: [] }), /Invalid suggestion list/);
  await assert.rejects(loadSuggestions({ ...api, list: async () => ({ success: false, data: {} }) }, solutionId, signal()), /did not confirm/);
});

test("sending trims, enforces the server limit and returns the confirmed id", async () => {
  let sent = "";
  const api: SuggestionApi = { list: async () => ok({}), send: async (id, text) => { assert.equal(id, solutionId); sent = text; return ok({ id: entry.id }); } };
  assert.equal(await sendSuggestion(api, solutionId, "  Add an export to Excel.  ", signal()), entry.id.toLowerCase());
  assert.equal(sent, "Add an export to Excel.");
  await assert.rejects(sendSuggestion(api, solutionId, "   ", signal()), /up to 1000/);
  await assert.rejects(sendSuggestion(api, solutionId, "x".repeat(SUGGESTION_MAX + 1), signal()), /up to 1000/);
  await assert.rejects(sendSuggestion({ ...api, send: async () => ok({ id: "bad" }) }, solutionId, "Fine", signal()), /did not confirm/);
});
