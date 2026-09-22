import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

let server;
let cacheDirectory;
let form;
let review;
let viewer;
let card;
const noop = () => {};
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

before(async () => {
  cacheDirectory = await mkdtemp(join(tmpdir(), "prisma-ui-tests-"));
  server = await createServer({ configFile: false, root: fileURLToPath(new URL("../", import.meta.url)), cacheDir: cacheDirectory, plugins: [react()], optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
  form = await server.ssrLoadModule("/src/components/SubmissionForm.tsx");
  review = await server.ssrLoadModule("/src/components/ReviewQueue.tsx");
  viewer = await server.ssrLoadModule("/src/components/ViewerFrame.tsx");
  card = await server.ssrLoadModule("/src/components/SolutionCard.tsx");
});
after(async () => { await server?.close(); if (cacheDirectory) await rm(cacheDirectory, { recursive: true, force: true }); });

test("both adapters consume the shared form and review surfaces", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = path => readFile(new URL(path, import.meta.url), "utf8");
  const [poc, connected, graph, media, pocReview, connectedReview] = await Promise.all([
    read("../src/views/SubmitView.tsx"), read("../connected/src/DraftsView.tsx"), read("../connected/src/DraftGraphEditor.tsx"),
    read("../connected/src/DraftMediaEditor.tsx"), read("../src/views/ReviewView.tsx"), read("../connected/src/SubmissionsView.tsx"),
  ]);
  for (const component of ["SubmissionSafety", "IdentityFields", "StoryFields", "SubmissionReview", "SubmissionFooter", "SubmissionSuccess"]) {
    assert.match(poc, new RegExp(`<${component}\\b`));
    assert.match(connected, new RegExp(`<${component}\\b`));
  }
  for (const source of [poc, graph]) assert.match(source, /<ContributorRow\b/);
  for (const source of [poc, media]) assert.match(source, /<SubmissionMedia\b/);
  for (const source of [pocReview, connectedReview]) assert.match(source, /<ReviewPanel\b/);
  assert.match(connected, /captions=\{captions\} onCaptions=\{setCaptions\}/);
  assert.match(connected, /await saveMediaCaptions\(/);
  assert.match(media, /onPreparationBusy=\{setPreparing\}/);
  assert.match(poc, /onPreparationBusy=\{setPreparingVideo\}/);
  assert.doesNotMatch(media, /Save captions|Discard caption edits/);
});

test("wizard footer preserves labels and locks every action during uncertain saves", () => {
  const props = { step: 5, canSave: true, canContinue: true, canSubmit: true, onBack: noop, onSave: noop, onContinue: noop, onSubmit: noop };
  const html = render(form.SubmissionFooter, { ...props, locked: true });
  assert.match(html, /Save draft &amp; close/);
  assert.match(html, /Submit for review/);
  assert.match(html, /Step 6 of 6/);
  assert.equal((html.match(/<button/g) ?? []).length, 3);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 3);
  assert.doesNotMatch(render(form.SubmissionFooter, props), /disabled=""/);
});

test("identity fields retain PoC examples, limits and separate client contexts", () => {
  const html = render(form.IdentityFields, { value: { name: "", summary: "", clientContext: "Internal client", redacted: "" }, onText: noop, area: "ai", areas: [{ value: "ai", label: "AI & Automation" }], onArea: noop, status: "prototype", statuses: [{ value: "prototype", label: "Working prototype" }], onStatus: noop });
  assert.match(html, /e.g. Ledger Reconciler/);
  assert.match(html, /maxLength="100"/);
  assert.equal((html.match(/maxLength="200"/g) ?? []).length, 3);
  assert.match(html, /How should we describe this client\?/);
  assert.match(html, /0\/200 characters/);
});

test("safety and contributor rows preserve baseline copy and accessible field structure", () => {
  assert.match(render(form.SubmissionSafety, { accepted: false, onChange: noop }), /Prepare a client-safe story/);
  const html = render(form.ContributorRow, { index: 0, person: createElement("input", { "aria-label": "Person" }), direct: true, value: { directHours: null, allocation: 100, startDate: "", endDate: "" }, onChange: noop, result: { error: "Enter hours", hours: 0, businessDays: 0 } });
  assert.match(html, /<legend[^>]*>Contributor 1/);
  assert.match(html, /sm:col-span-2/);
  assert.match(html, /Hours contributed/);
  assert.doesNotMatch(html, /Remove contributor/);
  assert.match(html, /aria-live="polite"/);
});

test("media uses stacked baseline controls and inline screenshot captions", () => {
  const html = render(form.SubmissionMedia, { capabilities: [], onRemoveThumbnail: noop, thumbnailUpload: "Thumbnail upload", images: [{ id: "image", caption: "Overview", preview: createElement("img", { src: "data:image/png;base64,AA==", alt: "Overview" }) }], imageUpload: "Image upload", onCaption: noop, onRemoveImage: noop, format: "Self-contained HTML file", onFormat: noop, onAttachment: noop, attachments: [{ id: "html", name: "demo.html" }], onRemoveAttachment: noop });
  assert.match(html, /Detail screenshots · 1\/6/);
  assert.match(html, /aria-label="Screenshot caption"/);
  assert.match(html, /aria-label="Remove this screenshot"/);
  assert.match(html, /accept=".html,.htm"/);
  assert.match(html, /file:bg-\(--accent\)/);
  assert.match(html, /file:rounded-lg/);
  assert.match(html, /focus-visible:outline-offset-2/);
  assert.ok(html.indexOf("Card thumbnail") < html.indexOf("Detail screenshots"));
  assert.ok(html.indexOf("Detail screenshots") < html.indexOf("Additional media format"));
});

test("linked asset editor separates URLs, embedding and desktop arrangements", () => {
  const props = { onSave: async () => {}, onCancel: noop };
  const hosted = render(form.LinkedAssetEditor, { ...props, type: "Hosted web app (URL)" });
  assert.match(hosted, /Application URL/);
  assert.match(hosted, /Allow sandboxed embedding/);
  assert.match(hosted, /maxLength="2000"/);
  for (const type of ["Power Apps", "Power BI"]) {
    const html = render(form.LinkedAssetEditor, { ...props, type });
    assert.match(html, /Application URL/);
    assert.doesNotMatch(html, /Allow sandboxed embedding/);
  }
  const desktop = render(form.LinkedAssetEditor, { ...props, type: "Desktop app or script" });
  assert.match(desktop, /Demo arrangements/);
  assert.doesNotMatch(desktop, /Application URL/);
  assert.doesNotMatch(desktop, /Allow sandboxed embedding/);
});

test("media reordering exposes drag handles and bounded keyboard actions", () => {
  const props = { capabilities: [], onRemoveThumbnail: noop, thumbnailUpload: null, images: [{ id: "first", caption: "", preview: "First" }, { id: "second", caption: "", preview: "Second" }], imageUpload: null, onCaption: noop, onRemoveImage: noop, format: "Self-contained HTML file", onFormat: noop, onAttachment: noop, attachments: [], onRemoveAttachment: noop, onReorderImages: noop };
  const html = render(form.SubmissionMedia, props);
  assert.match(html, /draggable="true"/);
  assert.match(html, /aria-label="Reorder Screenshot 1"/);
  assert.match(html, /aria-label="Move Screenshot 1 later"/);
  assert.match(html, /aria-label="Move Screenshot 2 earlier"/);
  const locked = render(form.SubmissionMedia, { ...props, attachmentDisabled: true });
  assert.doesNotMatch(locked, /draggable="true"/);
});

test("upload progress uses themed bounded progress and distinguishes finalization", () => {
  const html = render(form.UploadProgress, { name: "demo.html", received: 720, size: 1000, active: true });
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="72"/);
  assert.match(html, /bg-\(--accent\)/);
  assert.match(html, /Uploading/);
  assert.doesNotMatch(html, /Unfinished upload/);
  assert.match(render(form.UploadProgress, { name: "demo.html", received: 1000, size: 1000, active: true }), /Finalizing/);
  assert.match(render(form.UploadProgress, { name: "demo.html", received: 0, size: 0, active: false }), /aria-valuenow="0"/);
  assert.match(render(form.UploadProgress, { name: "demo.html", received: 720, size: 1000, active: false }), /Upload incomplete/);
});

test("review actions require comments on return and independent clearance on approval", () => {
  const props = { status: "Pending review", comments: "", onComments: noop, cleared: false, onCleared: noop, busy: false, onReturn: noop, onApprove: noop };
  const html = render(review.ReviewPanel, props);
  assert.match(html, /lg:grid-cols-2/);
  assert.match(html, /maxLength="4000"/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
  assert.doesNotMatch(render(review.ReviewPanel, { ...props, comments: "Ready", cleared: true }), /disabled=""/);
  assert.match(render(review.ReviewPanel, { ...props, comments: "Ready", cleared: true, canApprove: false }), /disabled=""/);
  assert.doesNotMatch(render(review.ReviewPanel, { ...props, status: "Published" }), /Approve &amp; publish/);
});

test("review summary and success use the baseline presentation", () => {
  const html = render(form.SubmissionReview, { card: "Card", attachments: 1, contributors: "Builder", hours: 13.25, images: "Generated poster · 1 screenshot", safety: "Acknowledged; review required", client: "", context: "", nextState: "Pending review" });
  assert.match(html, /inert=""/);
  assert.match(html, /13.25 hours/);
  assert.match(html, /No client/);
  assert.match(html, /rounded-xl border/);
  assert.match(render(form.SubmissionSuccess, { name: "Example", onSubmissions: noop, onAnother: noop, children: "is pending review." }), /Now it&#x27;s pending review/);
});

test("local video preview labels its source and exposes playback and close controls", () => {
  const html = render(viewer.LocalVideoPreview, { file: new File(["fixture"], "local-video.mp4", { type: "video/mp4" }), onClose: noop });
  assert.match(html, /aria-label="Local video preview"/);
  assert.match(html, /Local file preview/);
  assert.match(html, /aria-label="Local preview: local-video.mp4"/);
  assert.match(html, /aria-label="Close local preview"/);
  assert.match(html, /controls=""/);
  assert.doesNotMatch(html, /Saved to Dataverse|Upload complete|src=/);
});

test("cards wrap long solution text and video controls have accessible names", () => {
  const solution = { id: "fixture", name: "W".repeat(100), summary: "S".repeat(200), specializationArea: "ai", status: "Working prototype", publicationStatus: "Draft", contributors: [], capabilities: [], technologies: [], assets: [] };
  const html = render(card.SolutionCard, { solution, present: false, index: 0 });
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /tabindex="0"/i);
  const video = render(viewer.VideoPlayer, { src: "blob:fixture", name: "Acceptance video", className: "h-full w-full" });
  assert.match(video, /controls=""/);
  assert.match(video, /aria-label="Acceptance video"/);
});