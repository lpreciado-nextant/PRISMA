import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_DRAFT, coreFields, snapshot, loadDrafts, saveDraft, type DraftApi, type SavedDraft } from "./drafts.ts";
import { contributorEffort, emptyGraph, graphPayload, initialContributor, isEmptyContributor, loadGraphReferences, parseGraph, persistDraftGraph, type DraftGraph, type GraphApi } from "./draftGraph.ts";
import { hasCaptionChanges, imageDataUrl, mediaRequest, parseMedia, parseUploadProgress, saveMediaCaptions, saveMediaOrder, uploadMedia, type MediaApi } from "./media.ts";
import { createTechnology, deleteSubmission, mediaAsset, parseSubmission, parsePublished, loadSubmissions, loadSubmissionCardDetails, saveLinkedAsset, submissionSolution, type WorkflowApi } from "./workflow.ts";
import { parseRecovery, recoveryPayload } from "./draftRecovery.ts";
import { validateLinkedAsset, type LinkedAssetInput } from "../../src/lib/linkedAssets.ts";

test("protected image URLs preserve bytes and reject unsupported, oversized or cancelled images", async () => {
  const bytes = Uint8Array.from({ length: 70000 }, (_, index) => index % 256);
  for (const type of ["image/png", "image/jpeg"]) {
    const url = await imageDataUrl(new Blob([bytes], { type }));
    assert.equal(url, `data:${type};base64,${Buffer.from(bytes).toString("base64")}`);
  }
  for (const type of ["image/svg+xml", "text/html", "video/mp4", ""]) await assert.rejects(imageDataUrl(new Blob([bytes], { type })), /Unsupported/);
  await assert.rejects(imageDataUrl(new Blob([new Uint8Array(20 * 1024 * 1024 + 1)], { type: "image/png" })), /Unsupported/);
  await assert.rejects(imageDataUrl(new Blob([bytes], { type: "image/png" }), AbortSignal.abort()), { name: "AbortError" });
  const controller = new AbortController();
  const pending = imageDataUrl(new Blob([bytes], { type: "image/png" }), controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("linked assets require safe URLs and honest desktop guidance", () => {
  const input: LinkedAssetInput = { name: " Demo ", assetType: "Hosted web app (URL)", externalUrl: "https://example.com/demo", allowsEmbedding: true, embedHint: "" };
  assert.equal(validateLinkedAsset(input).name, "Demo");
  for (const externalUrl of ["javascript:alert(1)", "http://example.com", "data:text/html,test", "https://user:password@example.com", "https://example.com/\nsecret", "https://example.com\\path"]) assert.throws(() => validateLinkedAsset({ ...input, externalUrl }));
  for (const assetType of ["Power Apps", "Power BI"] as const) {
    assert.throws(() => validateLinkedAsset({ ...input, assetType }));
    assert.equal(validateLinkedAsset({ ...input, assetType, allowsEmbedding: false }).externalUrl, input.externalUrl);
  }
  assert.throws(() => validateLinkedAsset({ ...input, assetType: "Desktop app or script", externalUrl: "", allowsEmbedding: false }));
  const desktop = validateLinkedAsset({ ...input, assetType: "Desktop app or script", externalUrl: "", allowsEmbedding: false, embedHint: "Contact the builder to arrange a demonstration." });
  assert.equal(desktop.externalUrl, "");
  assert.throws(() => validateLinkedAsset({ ...input, name: "x".repeat(101) }));
});

test("media reorder preserves captions and confirms exact versions and complete permutations", async () => {
  const first = { id: draft.id, sessionId: draft.id, kind: "image" as const, name: "first.png", mime: "image/png", size: 1, received: 1, nextBlock: 1, complete: true, caption: "First", sortOrder: 0 };
  const second = { ...first, id: spare, sessionId: spare, caption: "Second", sortOrder: 1 };
  const api = { metadata: async (id: string, version: string, json: string) => {
    assert.equal(version, draft.rowVersion);
    assert.deepEqual(JSON.parse(json), [{ id: second.id, caption: "Second", sortOrder: 0 }, { id: first.id, caption: "First", sortOrder: 1 }]);
    return result({ id, rowVersion: "90071992547409932", sessionId: null, blockSize: 524288, media: [{ ...first, sortOrder: 1 }, { ...second, sortOrder: 0 }] });
  } };
  const saved = await saveMediaOrder(api, draft, [first, second], [second.id, first.id], signal());
  assert.deepEqual(saved.media.map(item => item.caption), ["Second", "First"]);
  for (const ids of [[first.id], [first.id, first.id], [first.id, "unknown"]]) await assert.rejects(saveMediaOrder(api, draft, [first, second], ids, signal()), /exactly once/);
  await assert.rejects(saveMediaOrder(api, draft, [{ ...first, complete: false }, second], [second.id, first.id], signal()), /exactly once/);
  await assert.rejects(saveMediaOrder({ metadata: async () => result({ id: draft.id, rowVersion: draft.rowVersion, sessionId: null, blockSize: 524288, media: [first, second] }) }, draft, [first, second], [second.id, first.id], signal()), /confirmed/);
});

test("consultant picker requires active employee status on every page, not VActive", async () => {
  const calls: Parameters<Parameters<typeof loadGraphReferences>[0]>[] = [];
  const person = { cr6b0_consultantid: "active", cr6b0_consultantname: "Active Consultant", cr6b0_email: "active@example.com", statecode: 0, cr6b0_employeestatus: true, cr6b0_vactive: false };
  const references = await loadGraphReferences(async (table, options) => {
    calls.push([table, options]);
    if (table !== "people") return { success: true, data: [] };
    if (options.skipToken) return { success: true, data: [{ ...person, cr6b0_consultantid: "second", cr6b0_consultantname: "Second Active" }] };
    return { success: true, skipToken: "next", data: [person,
      { ...person, cr6b0_consultantid: "inactive-employee", cr6b0_employeestatus: false, cr6b0_vactive: true },
      { ...person, cr6b0_consultantid: "inactive-record", statecode: 1 },
      { ...person, cr6b0_consultantid: "unknown", cr6b0_employeestatus: null },
      { ...person, cr6b0_consultantid: "missing", cr6b0_employeestatus: undefined },
    ] };
  }, signal());
  assert.deepEqual(references.people?.map(option => option.id), ["active", "second"]);
  for (const [, options] of calls.filter(([table]) => table === "people")) {
    assert.equal(options.filter, "statecode eq 0 and cr6b0_employeestatus eq true");
    assert.ok(options.select?.includes("cr6b0_employeestatus"));
    assert.ok(options.select?.includes("statecode"));
  }
  assert.equal(initialContributor(references, "active@example.com").contributors.length, 0);
});

test("linked URL limits preserve complete application links without truncation", () => {
  const prefix = "https://example.com/";
  for (const length of [100, 101, 163, 230, 2000]) {
    const externalUrl = prefix + "a".repeat(length - prefix.length);
    assert.equal(validateLinkedAsset({ name: "Application", assetType: "Power Apps", externalUrl, allowsEmbedding: false, embedHint: "" }).externalUrl, externalUrl);
  }
  const externalUrl = "https://apps.powerapps.com/play/e/example/a/example?tenantId=example&source=one%20two#view";
  assert.equal(validateLinkedAsset({ name: "Application", assetType: "Power Apps", externalUrl, allowsEmbedding: false, embedHint: "" }).externalUrl, externalUrl);
  assert.throws(() => validateLinkedAsset({ name: "Application", assetType: "Power Apps", externalUrl: prefix + "a".repeat(2001 - prefix.length), allowsEmbedding: false, embedHint: "" }));
});

test("linked asset create and edit confirm type and exact versions without file uploads", async () => {
  const input: LinkedAssetInput = { name: "Demo", assetType: "Power Apps", externalUrl: "https://apps.powerapps.com/play/demo", allowsEmbedding: false, embedHint: "Sign in with your work account." };
  const item = { id: spare, sessionId: spare, kind: "attachment" as const, name: input.name, mime: "application/vnd.prisma.link", size: 0, received: 0, nextBlock: 0, complete: true, linkedAsset: input };
  const state = { id: draft.id, rowVersion: "90071992547409932", sessionId: null, blockSize: 524288, media: [item] };
  const api = { transition: async (id: string, version: string, action: string, json: string, cleared: boolean) => {
    assert.equal(id, draft.id); assert.equal(version, draft.rowVersion); assert.equal(action, "asset"); assert.equal(cleared, false);
    assert.deepEqual(JSON.parse(json), input);
    return result(state);
  } };
  const created = await saveLinkedAsset(api, draft, [], input, signal());
  assert.equal(mediaAsset(created.media[0], 0).assetType, "Power Apps");
  const edited = { ...input, name: "Updated" };
  const updated = await saveLinkedAsset({ transition: async (_id, _version, _action, json) => {
    assert.equal(JSON.parse(json).id, item.id);
    return result({ ...state, media: [{ ...item, name: edited.name, linkedAsset: edited }] });
  } }, draft, [item], edited, signal(), item.id);
  assert.equal(updated.media[0].name, "Updated");
  await assert.rejects(saveLinkedAsset({ transition: async () => result({ ...state, rowVersion: draft.rowVersion }) }, draft, [], input, signal()), /confirmed/);
  assert.throws(() => parseMedia(result({ ...state, media: [{ ...item, linkedAsset: { ...input, externalUrl: "javascript:alert(1)" } }] })));
  assert.throws(() => parseMedia(result({ ...state, media: [{ ...item, mime: "text/html" }] })), /linked asset/);
  assert.throws(() => parseMedia(result({ ...state, media: [{ ...item, linkedAsset: undefined }] })));
});

test("draft snapshots, saves and recovery discard retired story properties", async () => {
  const legacy = { ...draft, useCase: "Retired content" };
  assert.deepEqual(snapshot(legacy), draft);
  assert.deepEqual(coreFields(legacy), coreFields(draft));
  const api: DraftApi = { list: async () => result({}), save: async json => {
    assert.equal(Object.hasOwn(JSON.parse(json), "useCase"), false);
    return result({ ...draft, rowVersion: "90071992547409932" });
  } };
  await saveDraft(api, legacy, draft, signal());
  const text = recoveryPayload("owner@example.com", draft.id, draft.rowVersion, draft, emptyGraph(), 2);
  const stored = JSON.parse(text);
  stored.draft.useCase = "Retired content";
  assert.equal(Object.hasOwn(parseRecovery(JSON.stringify(stored), "owner@example.com", draft.id).draft, "useCase"), false);
});

test("tab recovery is identity scoped, strips extras and requires renewed acknowledgment", () => {
  const text = recoveryPayload("Owner@example.com", draft.id, draft.rowVersion, { ...draft, safetyAcknowledged: true }, emptyGraph(), 2);
  const restored = parseRecovery(text, "owner@example.com", draft.id);
  assert.equal(restored.rowVersion, draft.rowVersion);
  assert.equal(restored.draft.safetyAcknowledged, false);
  assert.equal(restored.step, 2);
  assert.equal(restored.uncertain, false);
  assert.equal(parseRecovery(recoveryPayload("owner@example.com", draft.id, draft.rowVersion, draft, emptyGraph(), 2, true), "owner@example.com", draft.id).uncertain, true);
  assert.throws(() => parseRecovery(text, "another@example.com", draft.id), /identity/);
  assert.throws(() => parseRecovery(text, "owner@example.com"), /identity/);
  assert.throws(() => parseRecovery(text.replace('"step":2', '"step":99'), "owner@example.com", draft.id), /identity/);
  assert.equal(text.includes("media"), false);
});

test("workflow rejects mismatched versions, unknown states and internal presentation projects", () => {
  const graph = { id: draft.id, rowVersion: draft.rowVersion, graph: { contributors: [], technologyIds: [], industryIds: [], projectIds: [], areaIds: [] }, hours: [] };
  const detail = { record: { core: draft, areaIds: [], publication: 125060003, outcome: 125060000, comments: "", cleared: false }, graph, media: [], librarian: false };
  assert.deepEqual(parseSubmission(result(detail)), detail);
  assert.throws(() => parseSubmission(result({ ...detail, graph: { ...graph, rowVersion: "1" } })), /Mismatched/);
  assert.throws(() => parseSubmission(result({ ...detail, record: { ...detail.record, publication: 99 } })), /state/);
  const published = { id: draft.id, rowVersion: draft.rowVersion, contributors: [], totalHours: 0, projects: ["Internal project"], media: [] };
  assert.throws(() => parsePublished(result(published), draft.id, true), /projection/);
  assert.deepEqual(parsePublished(result(published), draft.id, false), published);
  const effort = { id: spare, personId: draft.id, directHours: null, startDate: "2026-09-02", endDate: "2026-11-02", allocation: 50, roleValue: null };
  const credited = { ...published, contributors: [{ name: "Builder", hours: 168, email: "builder@example.com", effort }], totalHours: 168 };
  assert.deepEqual(parsePublished(result(credited), draft.id, false).contributors[0].effort, effort);
  assert.throws(() => parsePublished(result({ ...published, projects: [], contributors: [{ name: "Builder", hours: 1 }] }), draft.id, true), /credit/);
  assert.throws(() => parsePublished(result({ ...published, projects: [], libraryNotes: "Internal" }), draft.id, true), /projection/);
  assert.throws(() => parsePublished(result({ ...published, projects: [], contributors: [{ name: "Builder", hours: null, email: "builder@example.com" }] }), draft.id, true), /credit/);
  const metadata = { ...detail.record, owner: "Owner", dateAdded: "2026-09-22", imageCount: 1, attachmentCount: 0, libraryNotes: "Internal" };
  assert.deepEqual(parseSubmission(result({ ...detail, record: metadata })).record, metadata);
  assert.throws(() => parseSubmission(result({ ...detail, record: { ...metadata, imageCount: -1 } })), /count/);
});

test("submission paging rejects loops and cancelled responses", async () => {
  const api: WorkflowApi = { list: async () => result({ records: [], moreRecords: true, pagingCookie: "same", librarian: false }), read: async () => ({}), transition: async () => ({}), published: async () => ({}) };
  await assert.rejects(loadSubmissions(api, false, signal()), /token/);
  const controller = new AbortController();
  await assert.rejects(loadSubmissions({ ...api, list: async () => { controller.abort(); return result({ records: [], moreRecords: false, librarian: false }); } }, false, controller.signal), /abort/i);
});

test("media responses retain exact versions and reject unsafe shapes", () => {
  const state = { id: "45dc1e23-1bb6-f111-aaac-6045bd049fba", rowVersion: "90071992547409932", sessionId: null, blockSize: 524288, media: [] };
  assert.deepEqual(parseMedia(result(state)), state);
  assert.throws(() => parseMedia(result({ ...state, rowVersion: 123 })), /version/);
  assert.throws(() => parseMedia(result({ ...state, blockSize: 10 })), /limits/);
});

test("caption saves use the exact version, preserve metadata and confirm persisted captions", async () => {
  const image = { id: spare, sessionId: spare, kind: "image" as const, name: "image.png", mime: "image/png", size: 3, received: 3, nextBlock: 1, complete: true, caption: "Original", sortOrder: 2 };
  let calls = 0;
  const api = { metadata: async (id: string, version: string, json: string) => {
    calls++;
    assert.equal(id, draft.id);
    assert.equal(version, draft.rowVersion);
    assert.deepEqual(JSON.parse(json), [{ id: image.id, caption: "Updated", sortOrder: 2 }]);
    return result({ id, rowVersion: "90071992547409932", sessionId: null, blockSize: 524288, media: [{ ...image, caption: "Updated" }] });
  } };
  assert.equal(hasCaptionChanges([image], { [image.id]: "Original" }), false);
  assert.equal(await saveMediaCaptions(api, draft, [image], {}, signal()), null);
  assert.equal(calls, 0);
  const saved = await saveMediaCaptions(api, draft, [image], { [image.id]: "Updated" }, signal());
  assert.equal(saved?.rowVersion, "90071992547409932");
  assert.equal(saved?.media[0].caption, "Updated");
  const unfinished = { ...image, id: draft.id, sessionId: draft.id, kind: "attachment" as const, name: "pending.html", mime: "text/html", complete: false, received: 0, nextBlock: 0, caption: "", sortOrder: 3 };
  const withUnfinished = await saveMediaCaptions({ metadata: async (id, _version, json) => {
    assert.deepEqual(JSON.parse(json), [{ id: image.id, caption: "", sortOrder: 2 }]);
    return result({ id, rowVersion: "90071992547409932", sessionId: null, blockSize: 524288, media: [{ ...image, caption: "" }, unfinished] });
  } }, draft, [image, unfinished], { [image.id]: "" }, signal());
  assert.equal(withUnfinished?.media[0].caption, "");
  assert.equal(withUnfinished?.media[1].complete, false);
  const response = { id: draft.id, rowVersion: draft.rowVersion, sessionId: null, blockSize: 524288, media: [image] };
  for (const invalid of [response, { ...response, rowVersion: "2" }, { ...response, id: spare, rowVersion: "2" }, { ...response, rowVersion: "2", media: [] }]) {
    await assert.rejects(saveMediaCaptions({ metadata: async () => result(invalid) }, draft, [image], { [image.id]: "Updated" }, signal()), /confirmed/);
  }
  await assert.rejects(saveMediaCaptions(api, draft, [image], { missing: "Updated" }, signal()), /screenshot/);
  await assert.rejects(saveMediaCaptions(api, draft, [image], { [image.id]: "x".repeat(201) }, signal()), /screenshot/);
  const controller = new AbortController();
  await assert.rejects(saveMediaCaptions({ metadata: async () => { controller.abort(); return result(response); } }, draft, [image], { [image.id]: "Updated" }, controller.signal), /abort/i);
});

test("caption checkpoint chains into core and graph saves without restoring safety clearance", async () => {
  const image = { id: spare, sessionId: spare, kind: "image" as const, name: "image.png", mime: "image/png", size: 3, received: 3, nextBlock: 1, complete: true, caption: "Before", sortOrder: 1 };
  let version = BigInt(draft.rowVersion);
  const calls: string[] = [];
  const captions = await saveMediaCaptions({ metadata: async (id, expected, json) => {
    assert.equal(expected, String(version));
    calls.push("captions");
    return result({ id, rowVersion: String(++version), sessionId: null, blockSize: 524288, media: [{ ...image, ...JSON.parse(json)[0] }] });
  } }, draft, [image], { [image.id]: "After" }, signal());
  assert.ok(captions);
  const checkpoint = { ...draft, rowVersion: captions.rowVersion, safetyAcknowledged: false };
  const fields = { ...checkpoint, summary: "Changed summary" };
  const desired = { ...emptyGraph(), technologyIds: [spare] };
  const confirmed: string[] = [];
  const saved = await persistDraftGraph({ ...api, save: async (json, id, expected) => {
    assert.equal(expected, String(version));
    assert.equal(JSON.parse(json).safetyAcknowledged, false);
    calls.push("core");
    return result({ ...fields, ...JSON.parse(json), id, rowVersion: String(++version) });
  } }, { read: async () => ({}), save: async (id, expected, json) => {
    assert.equal(expected, String(version));
    calls.push("graph");
    return result({ id, rowVersion: String(++version), graph: JSON.parse(json), hours: [] });
  } }, fields, checkpoint, desired, emptyGraph(), signal(), core => confirmed.push(core.rowVersion));
  assert.deepEqual(calls, ["captions", "core", "graph"]);
  assert.equal(saved.core.rowVersion, String(version));
  assert.equal(saved.core.safetyAcknowledged, false);
  assert.equal(confirmed.length, 2);
  assert.equal(captions.media[0].caption, "After");
});

test("media upload advances exact versions and stops after cancellation", async () => {
  const id = "45dc1e23-1bb6-f111-aaac-6045bd049fba";
  const session = "595ea718-1cb6-f111-aaac-6045bd049fba";
  const item = { id: session, sessionId: session, name: "test.html", mime: "text/html", kind: "attachment", size: 3, received: 0, nextBlock: 0, complete: false };
  const response = (version: string, received = 0, complete = false) => result({ id, sessionId: session, rowVersion: version, blockSize: 524288, media: [{ ...item, received, nextBlock: received ? 1 : 0, complete }] });
  const calls: string[] = [];
  const api: MediaApi = {
    read: async () => response("1"), remove: async () => response("1"), metadata: async () => response("1"),
    begin: async (_id, version) => { calls.push(version); return response("2"); },
    block: async (_id, version, _session, index, content) => { calls.push(version); assert.equal(index, 0); assert.equal(content, "YWJj"); return response("3", 3); },
    finish: async (_id, version) => { calls.push(version); return response("4", 3, true); },
  };
  const final = await uploadMedia(api, { id, rowVersion: "1" }, new File(["abc"], "test.html"), "attachment", signal(), () => {});
  assert.equal(final.rowVersion, "4");
  assert.deepEqual(calls, ["1", "2", "3"]);
  calls.length = 0;
  const controller = new AbortController();
  await assert.rejects(uploadMedia(api, { id, rowVersion: "1" }, new File(["abc"], "test.html"), "attachment", controller.signal, () => controller.abort()), /abort/i);
  assert.deepEqual(calls, ["1"]);
});

test("graph response preserves nullable effort and string versions", () => {
  const graph: DraftGraph = { contributors: [], technologyIds: [], industryIds: [], projectIds: [], areaIds: [] };
  const data = { id: "45dc1e23-1bb6-f111-aaac-6045bd049fba", rowVersion: "90071992547409932", graph, hours: [] };
  assert.deepEqual(parseGraph(result(data)), data);
  assert.equal(graphPayload(graph), JSON.stringify(graph));
  assert.throws(() => parseGraph(result({ ...data, rowVersion: 123 })), /version/);
  assert.throws(() => parseGraph(result({ ...data, graph: { ...graph, projectIds: ["bad"] } })), /identifiers/);
  assert.throws(() => parseGraph(result({ ...data, graph: { ...graph, areaIds: [spare, spare] } })), /identifiers/);
  assert.throws(() => parseGraph(result({ ...data, graph: { contributors: [], technologyIds: [], industryIds: [], projectIds: [] } })), /identifiers/);
});

const spare = "e7e7ffe9-ecb5-f111-aaac-6045bd049fba";
const draft: SavedDraft = { ...EMPTY_DRAFT, name: "Core draft", id: "45dc1e23-1bb6-f111-aaac-6045bd049fba", rowVersion: "90071992547409931" };
const result = (data: unknown) => ({ success: true, data: { ResultJson: JSON.stringify(data) } });
const signal = () => new AbortController().signal;
const api: DraftApi = { list: async () => result({ records: [draft], moreRecords: false }), save: async () => result(draft) };

test("wizard save chains confirmed versions and acknowledges only after graph writes", async () => {
  const calls: string[] = [];
  const desired = { ...emptyGraph(), technologyIds: [draft.id] };
  let version = BigInt(draft.rowVersion);
  const coreApi: DraftApi = { ...api, save: async (json, _id, expected) => {
    assert.equal(expected, String(version));
    const fields = JSON.parse(json);
    calls.push(`core:${fields.safetyAcknowledged}`);
    return result({ ...draft, ...fields, rowVersion: String(++version) });
  } };
  const graphApi: GraphApi = { read: async () => ({}), save: async (id, expected, json) => {
    assert.equal(expected, String(version));
    calls.push("graph");
    return result({ id, rowVersion: String(++version), graph: JSON.parse(json), hours: [] });
  } };
  const saved = await persistDraftGraph(coreApi, graphApi, { ...draft, name: "Updated", safetyAcknowledged: true }, draft, desired, emptyGraph(), signal(), () => {});
  assert.deepEqual(calls, ["core:false", "graph", "core:true"]);
  assert.equal(saved.core.safetyAcknowledged, true);
  assert.deepEqual(saved.graph, desired);
});

test("wizard save stops after an uncertain graph response and retains its confirmed checkpoint", async () => {
  let checkpoint: SavedDraft | undefined;
  let saves = 0;
  const coreApi: DraftApi = { ...api, save: async json => { saves++; return result({ ...draft, ...JSON.parse(json), rowVersion: "90071992547409932" }); } };
  const graphApi: GraphApi = { read: async () => ({}), save: async () => { throw new Error("Connection lost"); } };
  await assert.rejects(persistDraftGraph(coreApi, graphApi, { ...draft, name: "Updated", safetyAcknowledged: true }, draft, { ...emptyGraph(), technologyIds: [draft.id] }, emptyGraph(), signal(), core => { checkpoint = core; }), /Connection lost/);
  assert.equal(saves, 1);
  assert.equal(checkpoint?.rowVersion, "90071992547409932");
  assert.equal(checkpoint?.safetyAcknowledged, false);
});

test("wizard save makes no writes for an unchanged draft and stops when cancelled", async () => {
  const fail = async () => { throw new Error("Unexpected write"); };
  const coreApi = { ...api, save: fail };
  const graphApi = { read: fail, save: fail };
  const saved = await persistDraftGraph(coreApi, graphApi, draft, draft, emptyGraph(), emptyGraph(), signal(), () => {});
  assert.equal(saved.core, draft);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(persistDraftGraph(coreApi, graphApi, draft, draft, emptyGraph(), emptyGraph(), controller.signal, () => {}), /abort/i);
});

test("draft list preserves string row versions and incomplete fields", async () => {
  assert.deepEqual(await loadDrafts(api, signal()), [draft]);
});

test("save sends core fields only and the exact concurrency token", async () => {
  const next = { ...draft, rowVersion: "90071992547409932" };
  const saved = await saveDraft({ ...api, save: async (json, identifier, version) => {
    const body = JSON.parse(json);
    assert.equal(body.name, draft.name);
    assert.equal(body.id, undefined);
    assert.equal(body.rowVersion, undefined);
    assert.equal(body.ownerid, undefined);
    assert.equal(identifier, draft.id);
    assert.equal(version, draft.rowVersion);
    return result(next);
  } }, { ...draft, ownerid: "not allowed" } as SavedDraft, draft, signal());
  assert.deepEqual(saved, next);
});

test("new draft sends no identifier or version", async () => {
  await saveDraft({ ...api, save: async (_json, identifier, version) => {
    assert.equal(identifier, undefined);
    assert.equal(version, undefined);
    return result(draft);
  } }, draft, undefined, signal());
});

test("pagination forwards cookies and rejects loops", async () => {
  await assert.rejects(loadDrafts({ ...api, list: async (page, cookie) => {
    if (page === 1) assert.equal(cookie, undefined);
    else assert.equal(cookie, "cookie");
    return result({ records: [], moreRecords: true, pagingCookie: "cookie" });
  } }, signal()), /token/);
});

test("failed operations and malformed versions fail closed", async () => {
  await assert.rejects(loadDrafts({ ...api, list: async () => ({ success: false, data: {} }) }, signal()));
  await assert.rejects(loadDrafts({ ...api, list: async () => result({ records: [{ ...draft, rowVersion: 123 }], moreRecords: false }) }, signal()), /version/);
  await assert.rejects(saveDraft(api, draft, draft, signal()), /updated draft version/);
});

test("cancellation discards late list and save results", async () => {
  const controller = new AbortController();
  await assert.rejects(loadDrafts({ ...api, list: async () => { controller.abort(); return result({ records: [draft], moreRecords: false }); } }, controller.signal), /abort/i);
  const saveController = new AbortController();
  await assert.rejects(saveDraft({ ...api, save: async () => { saveController.abort(); return result(draft); } }, draft, undefined, saveController.signal), /abort/i);
});

test("submission cards map live states without inventing a specialization or contributor", () => {
  const record = { core: draft, areaIds: [spare, draft.id], publication: 125060003, outcome: 125060001, comments: "Clarify the story", cleared: false };
  assert.throws(() => submissionSolution(record, {}), /specialization/);
  assert.throws(() => submissionSolution(record, { [spare]: "data" }), /specialization/);
  const untagged = submissionSolution({ ...record, areaIds: [] }, {});
  assert.deepEqual(untagged.specializationAreas, []);
  const solution = submissionSolution(record, { [spare]: "data", [draft.id]: "ai" });
  assert.equal(solution.specializationArea, "data");
  assert.deepEqual(solution.specializationAreas, ["data", "ai"]);
  assert.equal(solution.publicationStatus, "Draft");
  assert.equal(solution.reviewOutcome, "Changes requested");
  assert.deepEqual(solution.contributors, []);
});

test("owned cards hydrate saved technology chips and reject missing or stale responses", async () => {
  const graph = { ...emptyGraph(), technologyIds: [spare], contributors: [{ id: draft.id, personId: spare, directHours: 5, startDate: null, endDate: null, allocation: 100 }] };
  const detail = { record: { core: draft, areaIds: [], publication: 125060003, outcome: 125060000, comments: "", cleared: false }, graph: { id: draft.id, rowVersion: draft.rowVersion, graph, hours: [5] }, media: [], librarian: false };
  const reader: Parameters<typeof loadSubmissionCardDetails>[1] = async (table, query) => {
    assert.match(query.filter ?? "", new RegExp(spare));
    return { success: true, data: table === "technologies" ? [{ nx_technologyid: spare, nx_technologyname: "React" }] : [{ cr6b0_consultantid: spare, cr6b0_consultantname: "Builder" }] };
  };
  const api = { read: async () => result(detail) };
  assert.deepEqual(await loadSubmissionCardDetails(api, reader, draft.id, signal()), { media: [], names: ["Builder"], technologies: ["React"] });
  await assert.rejects(loadSubmissionCardDetails(api, async () => ({ success: true, data: [] }), draft.id, signal()), /reference/);
  await assert.rejects(loadSubmissionCardDetails(api, reader, spare, signal()), /Mismatched/);
  const controller = new AbortController();
  await assert.rejects(loadSubmissionCardDetails({ read: async () => { controller.abort(); return result(detail); } }, reader, draft.id, controller.signal), /abort/i);
});

test("wizard creates one named draft and reuses its confirmed identifier", async () => {
  let creates = 0;
  const coreApi: DraftApi = { ...api, save: async (_json, id, version) => { creates++; assert.equal(id, undefined); assert.equal(version, undefined); return result(draft); } };
  const graphApi: GraphApi = { read: async () => ({}), save: async () => { throw new Error("Unexpected graph write"); } };
  const first = await persistDraftGraph(coreApi, graphApi, draft, undefined, emptyGraph(), emptyGraph(), signal(), () => {});
  const reopened = await persistDraftGraph(coreApi, graphApi, draft, first.core, first.graph, first.graph, signal(), () => {});
  assert.equal(creates, 1);
  assert.equal(reopened.core.id, draft.id);
});

test("named drafts ignore untouched contributor placeholders without dropping authored effort", async () => {
  const placeholder = { id: null, personId: "", directHours: null, startDate: null, endDate: null, allocation: 100 };
  const graphApi: GraphApi = { read: async () => ({}), save: async () => { throw new Error("Unexpected graph write"); } };
  const graph = { ...emptyGraph(), contributors: [placeholder] };
  const saved = await persistDraftGraph(api, graphApi, draft, draft, graph, emptyGraph(), signal(), () => {});
  assert.deepEqual(saved.graph.contributors, []);
  assert.equal(isEmptyContributor({ ...placeholder, personId: draft.id }), false);
  assert.equal(isEmptyContributor({ ...placeholder, id: draft.id }), false);
  await assert.rejects(persistDraftGraph(api, graphApi, draft, draft, { ...graph, contributors: [{ ...placeholder, directHours: 2 }] }, emptyGraph(), signal(), () => {}), /Select a contributor/);
});

test("live effort preview matches observed federal holidays and validates active inputs", () => {
  const person = { id: null, personId: "consultant", directHours: 13.25, allocation: 50, startDate: "2026-07-01", endDate: "2026-07-06" };
  assert.deepEqual(contributorEffort(person, 125060000), { businessDays: 3, hours: 12, error: "" });
  assert.equal(contributorEffort({ ...person, startDate: "2021-12-30", endDate: "2022-01-03" }, 125060000).hours, 8);
  assert.equal(contributorEffort({ ...person, startDate: "2020-06-19", endDate: "2020-06-19" }, 125060000).hours, 4);
  assert.equal(contributorEffort({ ...person, startDate: "2021-06-18", endDate: "2021-06-18" }, 125060000).hours, 0);
  assert.equal(contributorEffort(person, 125060004).hours, 13.25);
  assert.match(contributorEffort({ ...person, directHours: 1.001 }, 125060004).error, /decimal/);
  assert.match(contributorEffort({ ...person, startDate: "2036-01-01", endDate: "2036-01-01" }, 125060000).error, /coverage/);
  assert.match(contributorEffort({ ...person, endDate: "2026-06-30" }, 125060000).error, /End date/);
});

test("delete sends the displayed version and requires an exact acknowledgment", async () => {
  const api: WorkflowApi = { list: async () => ({}), read: async () => ({}), published: async () => ({}), transition: async (id, version, action) => {
    assert.equal(id, draft.id);
    assert.equal(version, draft.rowVersion);
    assert.equal(action, "delete");
    return result({ id, deleted: true });
  } };
  await deleteSubmission(api, draft, signal());
  await assert.rejects(deleteSubmission({ ...api, transition: async () => result({ id: draft.id, deleted: false }) }, draft, signal()), /not confirmed/);
  await assert.rejects(deleteSubmission({ ...api, transition: async () => result({ id: "other", deleted: true }) }, draft, signal()), /not confirmed/);
  const controller = new AbortController();
  await assert.rejects(deleteSubmission({ ...api, transition: async () => { controller.abort(); return result({ id: draft.id, deleted: true }); } }, draft, controller.signal), /abort/i);
});

test("technology creation requires a matching identity and advanced exact version", async () => {
  const api: WorkflowApi = { list: async () => ({}), read: async () => ({}), published: async () => ({}), transition: async (id, version, action, name) => {
    assert.equal(version, draft.rowVersion); assert.equal(action, "technology"); assert.equal(name, "React");
    return result({ id, rowVersion: "90071992547409932", technologyId: spare, name });
  } };
  assert.equal((await createTechnology(api, draft, "React", signal())).option.id, spare);
  await assert.rejects(createTechnology({ ...api, transition: async () => result({ id: draft.id, rowVersion: draft.rowVersion, technologyId: spare, name: "React" }) }, draft, "React", signal()), /confirmed/);
  const controller = new AbortController();
  await assert.rejects(createTechnology({ ...api, transition: async () => { controller.abort(); return {}; } }, draft, "React", controller.signal), /abort/i);
});

test("current contributor defaults only to one exact readable email match", () => {
  const references = { people: [{ id: spare, name: "Consultant", email: "OWNER@example.com" }], technologies: [], industries: [], projects: [] };
  assert.equal(initialContributor(references, "owner@example.com").contributors[0].personId, spare);
  assert.equal(initialContributor(references, "unmapped@example.com").contributors.length, 0);
  assert.equal(initialContributor({ ...references, people: [...references.people, ...references.people] }, "owner@example.com").contributors.length, 0);
});

test("cancelled media requests ignore late acknowledgments", async () => {
  const controller = new AbortController();
  let finish!: (value: unknown) => void;
  const pending = mediaRequest(new Promise(resolve => { finish = resolve; }), controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  finish(result({ id: draft.id, rowVersion: "90071992547409932", sessionId: null, blockSize: 524288, media: [] }));
});

test("a lost committed save response is not retried or followed by graph writes", async () => {
  let writes = 0;
  let graphWrites = 0;
  let stored = draft;
  const coreApi: DraftApi = { ...api, save: async json => {
    writes++;
    stored = { ...draft, ...JSON.parse(json), rowVersion: "90071992547409932" };
    throw new Error("Response lost after commit");
  } };
  const graphApi: GraphApi = { read: async () => ({}), save: async () => { graphWrites++; return {}; } };
  await assert.rejects(persistDraftGraph(coreApi, graphApi, { ...draft, summary: "Committed change" }, draft, { ...emptyGraph(), technologyIds: [spare] }, emptyGraph(), signal(), () => { throw new Error("Unconfirmed checkpoint"); }), /Response lost/);
  assert.equal(writes, 1);
  assert.equal(graphWrites, 0);
  assert.equal(stored.summary, "Committed change");
  assert.notEqual(stored.rowVersion, draft.rowVersion);
});

test("optimized progress preserves other media and rejects stale or mismatched acknowledgments", () => {
  const item = { id: spare, sessionId: spare, kind: "attachment" as const, name: "test.mp4", mime: "video/mp4", size: 3000000, received: 0, nextBlock: 0, complete: false };
  const previous = { id: draft.id, rowVersion: draft.rowVersion, sessionId: item.sessionId, blockSize: 2097152, uploadProtocol: 2 as const, media: [item, { ...item, id: draft.id, sessionId: draft.id, complete: true }] };
  const ack = { id: draft.id, rowVersion: "90071992547409932", sessionId: item.sessionId, blockSize: 2097152, received: 2097152, nextBlock: 1, uploadProgress: true };
  const next = parseUploadProgress(result(ack), previous);
  assert.equal(next.media[0].received, 2097152);
  assert.deepEqual(next.media[1], previous.media[1]);
  for (const patch of [{ id: item.id }, { sessionId: draft.id }, { rowVersion: draft.rowVersion }, { blockSize: 524288 }, { received: 1 }, { nextBlock: 2 }]) assert.throws(() => parseUploadProgress(result({ ...ack, ...patch }), previous));
  assert.throws(() => parseUploadProgress(result(ack), { ...previous, uploadProtocol: undefined }));
  assert.equal(parseUploadProgress(result({ ...ack, rowVersion: "90071992547409933", received: 3000000, nextBlock: 2 }), next).media[0].received, 3000000);
});

test("4 MiB negotiation rejects unsupported capabilities and never replays uncertain blocks", async () => {
  const blockSize = 4194304;
  const item = { id: spare, sessionId: spare, kind: "attachment", name: "sample.mp4", mime: "video/mp4", size: 1, received: 0, nextBlock: 0, complete: false };
  const state = { id: draft.id, rowVersion: "2", sessionId: item.sessionId, blockSize, uploadProtocol: 2, maxBlockSize: 4194304, media: [item] };
  assert.equal(parseMedia(result(state)).maxBlockSize, 4194304);
  assert.throws(() => parseMedia(result({ ...state, maxBlockSize: 8388608 })));
  assert.throws(() => parseMedia(result({ ...state, uploadProtocol: undefined })));
  let blocks = 0;
  let finishes = 0;
  const api: MediaApi = {
    read: async () => result(state), remove: async () => result(state), metadata: async () => result(state),
    begin: async () => result(state),
    block: async () => { blocks++; throw new Error("Response lost"); },
    finish: async () => { finishes++; return result(state); },
  };
  const file = new File(["x"], item.name);
  const initial = { id: draft.id, rowVersion: "1", uploadProtocol: 2 as const, maxBlockSize: 4194304 as const };
  await assert.rejects(uploadMedia({ ...api, begin: async () => result({ ...state, blockSize: 2097152 }) }, initial, file, "attachment", signal(), () => {}), /not negotiated/);
  assert.equal(blocks, 0);
  await assert.rejects(uploadMedia(api, initial, file, "attachment", signal(), () => {}), /Response lost/);
  assert.equal(blocks, 1);
  assert.equal(finishes, 0);
  const { getLastUploadTiming } = await import("./media.ts");
  assert.equal(getLastUploadTiming()!.complete, false);
  assert.equal(getLastUploadTiming()!.blocks, 0);
});

for (const blockSize of [2097152, 4194304]) test(`negotiated upload sends ${blockSize} byte blocks and preserves attachments and timing`, async () => {
  const item = { id: spare, sessionId: spare, kind: "attachment", name: "sample.mp4", mime: "video/mp4", size: blockSize + 3, received: 0, nextBlock: 0, complete: false };
  const existing = { ...item, id: draft.id, sessionId: draft.id, name: "existing.mp4", complete: true };
  const state = { id: draft.id, rowVersion: "2", sessionId: item.sessionId, blockSize, uploadProtocol: 2, media: [existing, item] };
  const lengths: number[] = [];
  const api: MediaApi = {
    read: async () => result(state), remove: async () => result(state), metadata: async () => result(state),
    begin: async (_id, version, kind) => { assert.equal(version, "1"); assert.equal(kind, blockSize === 4194304 ? "attachment:v3" : "attachment:v2"); return result(state); },
    block: async (id, version, sessionId, index, content) => {
      assert.equal(version, String(index + 2)); lengths.push(atob(content).length);
      return result({ id, sessionId, rowVersion: String(index + 3), blockSize, uploadProgress: true, nextBlock: index + 1, received: Math.min((index + 1) * blockSize, item.size) });
    },
    finish: async (_id, version) => { assert.equal(version, "4"); return result({ ...state, rowVersion: "5", media: [existing, { ...item, received: item.size, nextBlock: 2, complete: true }] }); },
  };
  const progress: number[] = [];
  const uploaded = await uploadMedia(api, { id: draft.id, rowVersion: "1", uploadProtocol: 2, ...(blockSize === 4194304 ? { maxBlockSize: 4194304 as const } : {}) }, new File([new Uint8Array(item.size)], item.name), "attachment", signal(), snapshot => {
    assert.equal(snapshot.media.length, 2); progress.push(snapshot.media[1].received);
  });
  assert.deepEqual(lengths, [blockSize, 3]);
  assert.deepEqual(progress, [0, blockSize, blockSize + 3]);
  assert.equal(uploaded.media[1].complete, true);
  const { getLastUploadTiming } = await import("./media.ts");
  const timing = getLastUploadTiming()!;
  assert.equal(timing.complete, true);
  assert.equal(timing.blockSize, blockSize);
  assert.equal(timing.blocks, 2);
  assert.equal(timing.bytes, item.size);
  assert.ok(timing.totalMs >= timing.beginMs + timing.encodingMs + timing.requestsMs + timing.finishMs);
});