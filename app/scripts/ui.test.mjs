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
let welcome;
let masthead;
const noop = () => {};
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

before(async () => {
  cacheDirectory = await mkdtemp(join(tmpdir(), "prisma-ui-tests-"));
  server = await createServer({ configFile: false, root: fileURLToPath(new URL("../", import.meta.url)), cacheDir: cacheDirectory, plugins: [react()], optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
  form = await server.ssrLoadModule("/src/components/SubmissionForm.tsx");
  review = await server.ssrLoadModule("/src/components/ReviewQueue.tsx");
  viewer = await server.ssrLoadModule("/src/components/ViewerFrame.tsx");
  card = await server.ssrLoadModule("/src/components/SolutionCard.tsx");
  welcome = await server.ssrLoadModule("/connected/src/WelcomeScreen.tsx");
  masthead = await server.ssrLoadModule("/src/components/Masthead.tsx");
});
after(async () => { await server?.close(); if (cacheDirectory) await rm(cacheDirectory, { recursive: true, force: true }); });

test("profile photo lookup uses the signed-in identity and tolerates missing, denied or invalid photos", async () => {
  const { getUserPhoto } = await server.ssrLoadModule("/connected/src/dataSource.ts");
  const { Office365UsersService } = await server.ssrLoadModule("/connected/src/generated/services/Office365UsersService.ts");
  const original = Office365UsersService.UserPhoto_V2;
  const calls = [];
  let response = { success: true, data: "/9j/AA==" };
  Office365UsersService.UserPhoto_V2 = async identity => { calls.push(identity); return response; };
  try {
    assert.equal(await getUserPhoto("sample@example.com"), "data:image/jpeg;base64,/9j/AA==");
    assert.deepEqual(calls, ["sample@example.com"]);
    assert.equal(await getUserPhoto(""), undefined);
    assert.equal(calls.length, 1);
    for (const data of [undefined, "", "https://example.com/photo", "PHN2Zz4=", "/9j/ invalid", "A".repeat(6 * 1024 * 1024 + 1)]) {
      response = { success: true, data };
      assert.equal(await getUserPhoto("sample@example.com"), undefined);
    }
    response = { success: true, data: "iVBORw0KGgo=" };
    assert.equal(await getUserPhoto("sample@example.com"), "data:image/png;base64,iVBORw0KGgo=");
    response = { success: false, data: "/9j/AA==" };
    assert.equal(await getUserPhoto("sample@example.com"), undefined);
    Office365UsersService.UserPhoto_V2 = async () => { throw new Error("Photo unavailable"); };
    assert.equal(await getUserPhoto("sample@example.com"), undefined);
  } finally {
    Office365UsersService.UserPhoto_V2 = original;
  }
});

test("masthead renders optional profile photos, retains initials and omits identity in present mode", () => {
  const user = { fullName: "Sample User", userPrincipalName: "sample@example.com", live: true };
  const props = { user, theme: "light", onToggleTheme: noop, present: false, onTogglePresent: noop };
  const fallback = render(masthead.Masthead, props);
  assert.match(fallback, />SU<\/span>/);
  const photoUrl = "data:image/jpeg;base64,/9j/AA==";
  const photo = render(masthead.Masthead, { ...props, user: { ...user, photoUrl } });
  assert.match(photo, /src="data:image\/jpeg;base64,\/9j\/AA==" alt="" width="28" height="28"/);
  assert.match(photo, />SU<img/);
  const present = render(masthead.Masthead, { ...props, present: true, user: { ...user, photoUrl } });
  assert.doesNotMatch(present, /Sample User|data:image\/jpeg|>SU</);
});

test("shared loading variants announce status and only expose measured progress", async () => {
  const { LoadingState, ProgressRail } = await server.ssrLoadModule("/src/components/LoadingState.tsx");
  for (const variant of ["page", "media", "inline"]) {
    const html = render(LoadingState, { label: "Loading preview...", variant });
    assert.match(html, new RegExp(`loading-state--${variant}`));
    assert.match(html, /role="status" aria-live="polite" aria-atomic="true"/);
    assert.match(html, /data-indeterminate="true" aria-hidden="true"/);
    assert.doesNotMatch(html, /aria-valuenow|<button/);
    if (variant === "inline") assert.doesNotMatch(html, /<img|<h1/);
    else assert.match(html, /src="\.\/prisma-mark-v2.svg" alt=""/);
    if (variant === "page") assert.match(html, /<h1[^>]*><span role="status"/);
  }
  assert.match(render(LoadingState, { label: "Checking video identity", progress: 42 }), /aria-valuenow="42"/);
  assert.match(render(ProgressRail, { label: "Compression", value: 120 }), /aria-valuenow="100"/);
  assert.match(render(ProgressRail, { label: "Compression", value: -1 }), /aria-valuenow="0"/);
  assert.doesNotMatch(render(ProgressRail, { label: "Compression" }), /aria-valuenow/);
});

test("published detail loading uses the branded accessible state without exposing solution data", async () => {
  const { PublishedView } = await server.ssrLoadModule("/connected/src/PublishedView.tsx");
  const solution = { id: "loading-fixture", name: "Private solution name", clientContext: "Internal client" };
  for (const present of [false, true]) {
    const html = render(PublishedView, { solution, present });
    assert.match(html, /loading-state--page/);
    assert.match(html, /src="\.\/prisma-mark-v2.svg" alt="" width="72" height="72"/);
    assert.match(html, /role="status" aria-live="polite" aria-atomic="true">Loading solution/);
    assert.match(html, /class="loading-rail" data-indeterminate="true" aria-hidden="true"/);
    assert.doesNotMatch(html, /Private solution name|Internal client|<button|aria-valuenow/);
  }
});

test("copy link renders only for a shareable route and player address", async () => {
  const { CopyLinkButton } = await server.ssrLoadModule("/connected/src/CopyLinkButton.tsx");
  const appLocation = { appId: "cffbecd7-c927-474e-b6ed-6c7957ec74cb", environmentId: "ce09ad9b-57d1-e5df-9400-8ce973c86213", tenantId: "d232b207-f86f-4fba-8891-ccbf30b12898" };
  const route = "/s/3e16f641-b8b6-f111-aaac-6045bd049fba";
  const html = render(CopyLinkButton, { appLocation, route });
  assert.match(html, /<button type="button"[^>]*>.*Copy link<\/button>/);
  assert.match(html, /role="status"><\/span>/);
  assert.doesNotMatch(html, /<input/);
  assert.equal(render(CopyLinkButton, { appLocation: { ...appLocation, appId: "local" }, route }), "");
  assert.equal(render(CopyLinkButton, { appLocation, route: "/admin" }), "");
});

test("submission routes use page loaders with contextual labels and retain back navigation", async () => {
  const { DraftsView } = await server.ssrLoadModule("/connected/src/DraftsView.tsx");
  const { SubmissionsView, SubmissionView } = await server.ssrLoadModule("/connected/src/SubmissionsView.tsx");
  assert.match(render(DraftsView, { owner: "fixture@example.com" }), /loading-state--page/);
  for (const review of [false, true]) {
    const list = render(SubmissionsView, { review });
    assert.match(list, /loading-state--page/);
    assert.match(list, review ? /Loading review queue/ : /Loading submissions/);
    const detail = render(SubmissionView, { id: "fixture", review });
    assert.match(detail, /loading-state--page/);
    assert.match(detail, review ? />Review queue<\/button>/ : />My submissions<\/button>/);
  }
});

test("media placeholders stay compact and video buffering preserves playback controls", async () => {
  const { ProtectedImage } = await server.ssrLoadModule("/connected/src/ProtectedImage.tsx");
  const { MediaPreview } = await server.ssrLoadModule("/connected/src/DraftMediaEditor.tsx");
  const { StreamingVideo } = await server.ssrLoadModule("/connected/src/StreamingVideo.tsx");
  const item = { id: "fixture", kind: "image", name: "Fixture image", mime: "image/png", complete: true };
  const image = render(ProtectedImage, { item, className: "h-full w-full" });
  assert.match(image, /loading-state--media h-full w-full/);
  assert.match(image, /Loading image/);
  const preview = render(MediaPreview, { item, onClose: noop, viewerTitle: "Fixture solution" });
  assert.match(preview, /loading-state--media h-full w-full/);
  assert.match(preview, /Loading preview/);
  assert.match(preview, /aria-label="Close the viewer"/);
  assert.match(render(MediaPreview, { item, onClose: noop }), /loading-state--media h-64/);
  const video = render(StreamingVideo, { item: { ...item, kind: "attachment", mime: "video\/mp4" }, solutionId: "fixture", mode: "published" });
  assert.match(video, /loading-state--inline/);
  assert.match(video, /Buffering video/);
  assert.match(video, /<video[^>]*controls=""/);
  assert.doesNotMatch(video, /aria-valuenow/);
});

test("welcome reflects actual connection state and withholds Explore until ready", () => {
  const connecting = render(welcome.WelcomeScreen, { authenticated: false, present: false });
  assert.match(connecting, /class="prisma-wordmark welcome-wordmark">PRISMA</);
  assert.match(connecting, /src="\.\/prisma-mark-v2.svg"/);
  assert.match(connecting, /role="status" aria-live="polite" aria-atomic="true"/);
  // The beam is the visible indicator; the status line is for screen readers only.
  assert.match(connecting, /<p class="sr-only" role="status"[^>]*>Signing you in</);
  assert.match(connecting, /class="welcome-beam" aria-hidden="true"/);
  assert.match(connecting, /class="welcome-copy" aria-hidden="true"/);
  assert.doesNotMatch(connecting, /<button|type="checkbox"|aria-valuenow|Dataverse|Loading catalogue|welcome-step|welcome-track|Welcome to/);
  const connected = render(welcome.WelcomeScreen, { authenticated: true, present: false });
  assert.match(connected, /Preparing your catalogue/);
  assert.doesNotMatch(connected, /Signing you in|welcome-step/);
});

test("welcome exposes Explore the Library on completion and prevents repeated entry during the flash", () => {
  const props = { authenticated: true, present: false, ready: true, onBegin: noop };
  const html = render(welcome.WelcomeScreen, props);
  assert.match(html, /Catalogue ready/);
  assert.match(html, /data-ready="true"/);
  assert.match(html, /Great solutions\. One place\./);
  assert.match(html, /Discover what Nextant has built\./);
  assert.match(html, /<button[^>]*>Explore the Library /);
  assert.doesNotMatch(html, /disabled=""|type="checkbox"|aria-current="step"/);
  assert.match(render(welcome.WelcomeScreen, { ...props, entering: true }), /disabled=""/);
  assert.match(render(welcome.WelcomeScreen, { ...props, present: true }), /Presentation ready/);
});

test("welcome presentation state stays generic and uses presentation status", () => {
  const html = render(welcome.WelcomeScreen, { authenticated: true, present: true });
  assert.match(html, /Preparing your presentation/);
  assert.doesNotMatch(html, /Catalogue|Not signed in|userPrincipalName/);
});

test("both adapters consume the shared form and review surfaces", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = path => readFile(new URL(path, import.meta.url), "utf8");
  const [poc, connected, graph, media, pocReview, connectedReview] = await Promise.all([
    read("../src/views/SubmitView.tsx"), read("../connected/src/DraftsView.tsx"), read("../connected/src/DraftGraphEditor.tsx"),
    read("../connected/src/DraftMediaEditor.tsx"), read("../src/views/ReviewView.tsx"), read("../connected/src/SubmissionsView.tsx"),
  ]);
  for (const component of ["SubmissionSafety", "StoryFields", "SubmissionReview", "SubmissionFooter", "SubmissionSuccess"]) {
    assert.match(poc, new RegExp(`<${component}\\b`));
    assert.match(connected, new RegExp(`<${component}\\b`));
  }
  // Both flows render Solution details (Define the solution) and Status, Built by & effort and Client (Solution context) as section cards.
  for (const source of [poc, connected]) {
    assert.match(source, /<SolutionDetailsFields\b/);
    assert.match(source, /<ClientFields\b/);
  }
  for (const source of [poc, connected]) {
    assert.match(source, /<NamedSection title="Solution details">/);
    assert.match(source, /<NamedSection title="Built by & effort">/);
    assert.match(source, /<NamedSection title="Status">/);
    assert.match(source, /<StoryFields nested\b/);
    assert.match(source, /onAssociated=\{setClientAssociated\}/);
  }
  for (const source of [poc, graph]) assert.match(source, /<ContributorRow\b/);
  for (const source of [poc, media]) assert.match(source, /<SubmissionMedia\b/);
  for (const source of [pocReview, connectedReview]) assert.match(source, /<ReviewPanel\b/);
  assert.match(connected, /captions=\{captions\} onCaptions=\{setCaptions\}/);
  assert.match(connected, /await saveMediaCaptions\(/);
  assert.match(media, /onPreparationBusy=\{setPreparing\}/);
  assert.match(media, /uncertain && !busy && onReopen/);
  assert.match(connected, /onReopen=\{\(\) => setConfirmation\("reopen"\)\}/);
  assert.match(poc, /onPreparationBusy=\{setPreparingVideo\}/);
  assert.doesNotMatch(media, /Save captions|Discard caption edits/);
});

test("story section contains only the two narrative fields in both adapters", async () => {
  const html = render(form.StoryFields, { whatItDoes: "Actions and results", businessValue: "Business benefit", onChange: noop });
  assert.match(html, /What does it do, and why does it matter\?/);
  assert.match(html, /What the solution does/);
  assert.match(html, /Business value/);
  assert.equal((html.match(/<textarea/g) ?? []).length, 2);
  // Both are Business Required in Dataverse (nx_whatitdoes, nx_businessvalue): each label carries the required mark.
  assert.equal((html.match(/(required)/g) ?? []).length, 2);
  assert.doesNotMatch(html, /(optional)|Optional/);
  const { readFile } = await import("node:fs/promises");
  for (const path of ["../src/views/SubmitView.tsx", "../connected/src/DraftsView.tsx"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /<StoryFields\b/);
    assert.doesNotMatch(source, /field\("useCase"/);
  }
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
  assert.match(html, /Anonymous client profile/);
  assert.match(html, /0\/200 characters/);
});

test("required and optional fields are marked the same way everywhere, with one legend per step", () => {
  const required = render(form.Field, { label: "Solution name", required: true, children: createElement("input") });
  assert.match(required, /Solution name<span aria-hidden="true"[^>]*> \*<\/span><span class="sr-only"> \(required\)<\/span>/);
  assert.match(render(form.Field, { label: "What it does", optional: true, children: createElement("input") }), /What it does<span[^>]*>\(optional\)<\/span>/);
  assert.doesNotMatch(render(form.Field, { label: "Plain", children: createElement("input") }), /required|optional/);
  // The legend explains the asterisk on steps with fields, not on the safety gate or the final review.
  assert.match(render(form.StepShell, { title: "Tag it" }), /Required to submit for review\. To save a draft, only the solution name is needed\./);
  for (const title of ["Before you start", "Review & submit"]) assert.doesNotMatch(render(form.StepShell, { title }), /Required to submit/);
  assert.match(render(form.StatusField, { status: "a", statuses: [{ value: "a", label: "Idea" }], onStatus: noop }), /Status<span aria-hidden="true"/);
  assert.match(render(form.SubmissionSafety, { accepted: false, onChange: noop }), /unauthorized information\.<span aria-hidden="true"[^>]*> \*/);
});

test("the client question hides every client field until Yes", () => {
  const props = { value: { name: "", summary: "", clientContext: "", redacted: "" }, onText: noop, role: "", roles: ["Chief of Staff"], onRole: noop, framed: true, onAssociated: noop };
  for (const associated of [undefined, false]) {
    const html = render(form.ClientFields, { ...props, associated });
    assert.match(html, /Is this solution associated with a client\?/);
    assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
    assert.doesNotMatch(html, /Client name|Anonymous client profile|Target client role/);
  }
  const yes = render(form.ClientFields, { ...props, associated: true });
  assert.match(yes, /Target client role/);
  assert.match(yes, /Client name/);
  assert.match(yes, /Anonymous client profile/);
  // Without the question (no onAssociated) the fields show as before.
  assert.match(render(form.ClientFields, { ...props, onAssociated: undefined }), /Client name/);
});

test("safety and contributor rows preserve baseline copy and accessible field structure", () => {
  assert.match(render(form.SubmissionSafety, { accepted: false, onChange: noop }), /Help keep PRISMA content safe/);
  const html = render(form.ContributorRow, { index: 0, person: createElement("input", { "aria-label": "Person" }), value: null, onChange: noop, result: { error: "Enter hours", hours: 0 } });
  assert.match(html, /<legend[^>]*>Contributor 1/);
  assert.match(html, /sm:col-span-2/);
  assert.match(html, /Minimum hours required/);
  assert.doesNotMatch(html, /Allocation|Start date|business days|>Level</);
  const selected = render(form.ContributorRow, { index: 0, person: createElement("input", { "aria-label": "Person" }), level: "Customer Success Manager II", value: 4, onChange: noop, result: { error: "", hours: 4 } });
  assert.match(selected, />Level</);
  assert.match(selected, /Customer Success Manager II/);
  assert.doesNotMatch(selected, /<select|Role/);
  assert.match(render(form.ContributorRow, { index: 0, person: createElement("input", { "aria-label": "Person" }), level: null, value: 4, onChange: noop, result: { error: "", hours: 4 } }), /Not recorded in the consultant directory/);
  assert.doesNotMatch(html, /Remove contributor/);
  assert.match(html, /aria-live="polite"/);
});

test("media files demos, interactive demos and supporting material in their own sections", () => {
  const props = { onRemoveThumbnail: noop, thumbnailUpload: "Thumbnail upload", images: [{ id: "image", caption: "Overview", preview: createElement("img", { src: "data:image/png;base64,AA==", alt: "Overview" }) }], imageUpload: "Image upload", onCaption: noop, onRemoveImage: noop, onAttachment: noop, onRemoveAttachment: noop,
    attachments: [{ id: "video", name: "walkthrough.mp4", purpose: "Demo video" }, { id: "html", name: "demo.html", purpose: "Interactive demo" }, { id: "deck", name: "deck.pdf", purpose: "Supporting material" }] };
  const html = render(form.SubmissionMedia, props);
  assert.match(html, /Detail screenshots · 1\/6/);
  assert.match(html, /aria-label="Screenshot caption"/);
  assert.ok(html.indexOf("Card thumbnail") < html.indexOf("Detail screenshots"));
  assert.ok(html.indexOf("Detail screenshots") < html.indexOf("Demo videos"));
  assert.ok(html.indexOf("Demo videos") < html.indexOf("walkthrough.mp4") && html.indexOf("walkthrough.mp4") < html.indexOf("Interactive demo"));
  assert.ok(html.indexOf("Interactive demo") < html.indexOf("demo.html") && html.indexOf("demo.html") < html.indexOf("Supporting material"));
  assert.ok(html.indexOf("Supporting material") < html.indexOf("deck.pdf"));
  assert.match(html, /Recommended/);
  assert.match(html, /accept=".mp4,.webm"/);
  assert.match(html, /accept=".html,.htm"/);
  assert.match(html, /accept=".pdf,.ppt,.pptx,.mp4,.webm"/);
  assert.match(html, /has-\[:focus-visible\]:outline-offset-2/);
  // Links are offered only where the caller can save them (connected), and never for demo videos.
  assert.doesNotMatch(html, /Add a link/);
  const connected = render(form.SubmissionMedia, { ...props, onLinkedAsset: async () => {} });
  assert.equal((connected.match(/aria-label="Add a link to /g) ?? []).length, 2);
  assert.doesNotMatch(connected, /Add a link to demo videos/);
  // Six attachments in total fill every section.
  const full = render(form.SubmissionMedia, { ...props, attachments: props.attachments.concat([4, 5, 6].map(index => ({ id: `extra-${index}`, name: `extra-${index}.pdf`, purpose: "Supporting material" }))) });
  assert.equal((full.match(/aria-label="Upload [^"]*" disabled=""/g) ?? []).length, 3);
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
  const props = { onRemoveThumbnail: noop, thumbnailUpload: null, images: [{ id: "first", caption: "", preview: "First" }, { id: "second", caption: "", preview: "Second" }], imageUpload: null, onCaption: noop, onRemoveImage: noop, format: "Self-contained HTML file", onFormat: noop, onAttachment: noop, attachments: [], onRemoveAttachment: noop, onReorderImages: noop };
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
  assert.match(html, /class="loading-rail"/);
  assert.match(html, /Uploading/);
  assert.doesNotMatch(html, /Unfinished upload/);
  assert.match(render(form.UploadProgress, { name: "demo.html", received: 1000, size: 1000, active: true }), /Finalizing/);
  assert.match(render(form.UploadProgress, { name: "demo.html", received: 0, size: 0, active: false }), /aria-valuenow="0"/);
  assert.match(render(form.UploadProgress, { name: "demo.html", received: 720, size: 1000, active: false }), /Upload incomplete/);
});

test("review actions require comments on return and independent clearance on approval", () => {
  const props = { status: "Pending review", owner: "Ana", comments: "", onComments: noop, cleared: false, onCleared: noop, busy: false, onReturn: noop, onApprove: noop };
  // Status, then context, then the decision; nothing to act on until a decision is chosen.
  const html = render(review.ReviewPanel, props);
  assert.match(html, /Librarian review.*Pending review.*Submitted by.*Ana.*Review checklist.*Client safety.*No client named.*Review decision.*Ready to publish.*Request changes/s);
  // The checklist compares the internal client with its client-facing wording and flags what is missing.
  const solution = { id: "r", name: "R", summary: "S", specializationArea: "data", specializationAreas: ["data"], status: "Client demo", publicationStatus: "Pending review", reviewOutcome: "Changes requested", capabilities: ["Data platforms"], contributors: [], technologies: [], assets: [] };
  const checked = render(review.ReviewPanel, { ...props, solution, client: "Bank X", context: "", feedback: "Anonymize it", checks: [{ label: "Summary and capability", done: true }, { label: "Detail images (1 to 6)", done: false }] });
  assert.match(checked, /Classification.*Specialization areas.*Data Solutions.*Capability.*Data platforms.*Status.*Client demo/s);
  assert.match(checked, /Internal client.*Bank X.*Shown to clients as.*Not provided/s);
  // Review points are plain bullets: nothing reads as already verified; only a point the record fails is flagged.
  assert.match(checked, /Review points.*Verify these items before making your decision\./s);
  const points = checked.match(/<ul class="[^"]*list-disc[^"]*">.*?<\/ul>/s)?.[0] ?? "";
  assert.doesNotMatch(points, /type="checkbox"|<svg[^>]*>(?:(?!<\/svg>).)*m4 12 5 5L20 6/s);
  assert.match(points, /<li[^>]*>Summary and capability<\/li>/);
  assert.match(points, /<li[^>]*>Detail images \(1 to 6\)<span[^>]*>.*Missing<\/span><\/li>/s);
  assert.match(checked, /Resubmitted after changes requested.*Anonymize it/s);
  assert.match(render(review.ReviewPanel, { ...props, solution: { ...solution, reviewOutcome: "None" }, feedback: "Old note" }), /Latest review comments/);
  // A returned record awaits its contributor: the status says so and the feedback sits below the checklist, with no decision.
  const waiting = render(review.ReviewPanel, { ...props, status: "Draft", solution: { ...solution, publicationStatus: "Draft" }, feedback: "Anonymize it" });
  assert.match(waiting, /<h2[^>]*>Changes requested<\/h2>.*Review checklist.*Waiting for corrections.*Sent back to the contributor.*Your feedback.*Anonymize it/s);
  assert.doesNotMatch(waiting, /Review decision|Latest review comments|Resubmitted after/);
  // Published: a green block with the optional approval note and an explained, secondary retire action.
  // Taking it out of the library: request changes or retire, chosen first, each then asking for the owner-facing words.
  const live = render(review.ReviewPanel, { ...props, status: "Published", solution: { ...solution, publicationStatus: "Published", reviewOutcome: "Approved" }, feedback: "Great work", onRetire: noop, onRequestChanges: noop });
  assert.match(live, /Review checklist.*<h3[^>]*>Published<\/h3>.*Your note to the contributor.*Great work.*Need to change it\?.*Request changes.*send it back to the owner.*Retire from library.*Nothing is deleted/s);
  assert.equal((live.match(/type="radio"/g) ?? []).length, 2);
  assert.doesNotMatch(live, /<textarea|Review decision|Latest review comments/);
  assert.doesNotMatch(render(review.ReviewPanel, { ...props, status: "Published" }), /Your note to the contributor|Need to change it/);
  // Each action appears only when the caller offers it.
  assert.doesNotMatch(render(review.ReviewPanel, { ...props, status: "Published", onRetire: noop }), /send it back to the owner/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<textarea|type="checkbox"|Approve &amp; publish|Send back for changes/);
  assert.match(html, /Submission preview · what the contributor submitted/);
  // Request changes: a required comment, sending back only once it has text.
  const changes = { ...props, defaultDecision: "changes" };
  const back = render(review.ReviewPanel, changes);
  const field = back.match(/Comments to contributor.*?<textarea[^>]*>/s)?.[0] ?? "";
  for (const attribute of [/required=""/, /maxLength="4000"/, /placeholder="Describe what needs to be updated before this solution can be published."/]) assert.match(field, attribute);
  assert.doesNotMatch(back, /type="checkbox"|Approve &amp; publish/);
  assert.match(back, /disabled=""[^>]*>.*Send back for changes/s);
  assert.match(back, /Add a comment to send this submission back\./);
  assert.doesNotMatch(render(review.ReviewPanel, { ...changes, comments: "Fix the screenshots" }), /disabled=""/);
  // Ready to publish: independent confirmation, an optional note, and an explained disabled state.
  const publish = { ...props, defaultDecision: "publish" };
  const ready = render(review.ReviewPanel, publish);
  assert.match(ready, /type="checkbox".*I confirm that I reviewed.*Note to contributor.*optional/s);
  assert.doesNotMatch(ready, /Send back for changes|required=""/);
  assert.match(ready, /Confirm the review above to publish\./);
  assert.doesNotMatch(render(review.ReviewPanel, { ...publish, cleared: true }), /disabled=""/);
  const incomplete = render(review.ReviewPanel, { ...publish, cleared: true, canApprove: false });
  assert.match(incomplete, /disabled=""[^>]*>.*Approve &amp; publish/s);
  assert.match(incomplete, /must be complete before approval/);
  assert.match(render(review.ReviewPanel, { ...publish, cleared: true, locked: true }), /<fieldset disabled=""/);
  assert.doesNotMatch(render(review.ReviewPanel, { ...props, status: "Published" }), /Review decision|Approve &amp; publish/);
  assert.match(render(review.ReviewPanel, { ...props, busy: true }), /loading-state--inline/);
  assert.match(render(review.ReviewPanel, { ...props, notice: "Downloading document...", noticeBusy: true }), /loading-state--inline/);
  assert.doesNotMatch(render(review.ReviewPanel, { ...props, notice: "Download started: document" }), /loading-state--inline/);
});

test("review queue rows show area, capability, submitter and a friendly date, newest first", () => {
  const base = { summary: "Summary", status: "Working prototype", publicationStatus: "Pending review", reviewOutcome: "None", contributors: [], technologies: [], assets: [{ id: "a" }], images: [{ id: "i", src: "x" }, { id: "j", src: "y" }] };
  const entries = [
    { owner: "Ana", solution: { ...base, id: "old", name: "Older app", specializationArea: "data", specializationAreas: ["data"], capabilities: ["Data platforms"], dateAdded: "2026-09-01" } },
    { owner: "Juliana Castelblanco", solution: { ...base, id: "new", name: "PRISMA APP", specializationArea: "ai", specializationAreas: ["ai"], capabilities: ["AI & agents"], dateAdded: "2026-09-30" } },
    { owner: "Luis", solution: { ...base, id: "done", name: "Live one", publicationStatus: "Published", specializationArea: "ibo", capabilities: [], dateAdded: "2026-08-01" } },
  ];
  const html = render(review.ReviewQueue, { entries, connected: false });
  // Review status → search & filters (area before capability, then sort) → result count → rows.
  assert.match(html, /aria-pressed="true"[^>]*>Pending review<span[^>]*>2<\/span>.*Published<span[^>]*>1<\/span>/s);
  assert.match(html, /Search review queue.*aria-label="Specialization area".*All areas.*aria-label="Capability".*All capabilities.*aria-label="Sort".*Sort: Newest.*2 submissions/s);
  assert.match(html, /PRISMA APP.*Older app/s);
  assert.doesNotMatch(html, /Live one/);
  // A small date in the top corner; the full date stays in its title and for screen readers.
  const short = new Date().getFullYear() === 2026 ? "Sep 30" : "Sep 30, 2026";
  assert.match(html, new RegExp(`<time dateTime="2026-09-30" title="Submitted Sep 30, 2026"[^>]*><span class="sr-only">Submitted </span>${short}</time>`));
  assert.match(html, /AI &amp; Automation.*AI &amp; agents.*PRISMA APP.*Summary.*Juliana Castelblanco.*2 images.*1 attachment<.*Review submission/s);
  // The row edge follows the review state (blue while pending), not the area.
  assert.match(html, /w-1" style="background:var\(--accent\)"/);
  assert.doesNotMatch(html, /w-1" style="background:var\(--sa-/);
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
test("select picker shows a greyed placeholder until a value is chosen", async () => {
  const { SelectPicker } = await server.ssrLoadModule("/src/components/SelectPicker.tsx");
  const props = { label: "Target client role", options: ["Chief of Staff"], onChange: noop, placeholder: "e.g. Chief of Staff", getLabel: value => value || "No specific role" };
  assert.match(render(SelectPicker, { ...props, value: "" }), /<span class="[^"]*text-\(--ink-3\)">e\.g\. Chief of Staff<\/span>/);
  assert.doesNotMatch(render(SelectPicker, { ...props, value: "" }), /No specific role/);
  assert.doesNotMatch(render(SelectPicker, { ...props, value: "Chief of Staff" }), /e\.g\./);
});

test("section cards carry one section-level visibility badge and mixed sections badge each field", async () => {
  const { SectionCardsContext } = await server.ssrLoadModule("/src/components/sectionCards.ts");
  const inCards = element => renderToStaticMarkup(createElement(SectionCardsContext.Provider, { value: true }, element));
  const built = render(form.NamedSection, { title: "Built by & effort", children: createElement("p", null, "Contributor 1") });
  assert.match(built, /<h3[^>]*>Built by &amp; effort<\/h3>/);
  assert.equal((built.match(/Internal only/g) ?? []).length, 1);
  assert.match(built, /used for internal tracking only/);
  const client = render(form.ClientFields, { value: { name: "", summary: "", clientContext: "", redacted: "" }, onText: noop, role: "", roles: ["Chief of Staff"], onRole: noop, framed: true });
  assert.equal((client.match(/Internal only/g) ?? []).length, 1);
  assert.equal((client.match(/Shown to clients/g) ?? []).length, 2);
  // Multi-card steps stay unframed; single-section steps become cards.
  for (const title of ["Define the solution", "Solution context"]) assert.doesNotMatch(inCards(createElement(form.StepShell, { title })), /rounded-\[20px\] border/);
  assert.match(inCards(createElement(form.StepShell, { title: "Tag it" })), /<h2[^>]*>Tag it<\/h2>.*Shown to clients/);
  assert.doesNotMatch(render(form.StepShell, { title: "Tag it" }), /Shown to clients/);
});

test("my submissions filters by review state and keeps card controls outside the open button", async () => {
  const { MySubmissionsView } = await server.ssrLoadModule("/src/views/MySubmissionsView.tsx");
  const base = { summary: "Summary", specializationArea: "ai", status: "Working prototype", contributors: [], capabilities: [], technologies: [], industries: [], assets: [] };
  const entries = [
    { solution: { ...base, id: "draft", name: "Draft one", publicationStatus: "Draft", reviewOutcome: "None" } },
    { solution: { ...base, id: "returned", name: "Returned one", publicationStatus: "Draft", reviewOutcome: "Changes requested", reviewComments: "Please anonymize the screenshots." } },
    { solution: { ...base, id: "pending", name: "Pending one", publicationStatus: "Pending review", reviewOutcome: "None" } },
    { solution: { ...base, id: "live", name: "Live one", publicationStatus: "Published", reviewOutcome: "Approved" } },
  ];
  const html = render(MySubmissionsView, { entries, connected: true, onDelete: async () => {} });
  for (const [label, total] of [["All", 4], ["Draft", 1], ["Pending review", 1], ["Changes requested", 1], ["Published", 1]]) {
    assert.match(html, new RegExp(`aria-pressed="${label === "All"}"[^>]*>(<span[^>]*></span>)?${label}<span[^>]*>${total}</span>`));
  }
  // A managed card is not itself a button: its title opens it and the controls sit beside that button.
  assert.doesNotMatch(html, /role="button"/);
  assert.equal((html.match(/class="card-open/g) ?? []).length, 4);
  assert.equal((html.match(/aria-label="View feedback for /g) ?? []).length, 1);
  assert.match(html, /aria-label="View feedback for Returned one"/);
  assert.doesNotMatch(html, /Please anonymize|View submission/);
  // Connected Pending review and Published records are withdrawn on their page, not edited from the card.
  assert.match(html, /aria-label="Edit Draft one"/);
  assert.match(html, /aria-label="Edit Returned one"/);
  assert.doesNotMatch(html, /aria-label="Edit (Pending|Live) one"/);
  assert.equal((html.match(/aria-haspopup="menu"/g) ?? []).length, 4);
  assert.match(html, /role="menu"[^>]*>.*Delete submission/);
  // A retired record carries the librarian's reason, opened the same way as returned feedback.
  const retired = render(MySubmissionsView, { entries: [{ solution: { ...base, id: "gone", name: "Gone one", publicationStatus: "Retired", reviewOutcome: "Approved", reviewComments: "Replaced by v2" } }], connected: true });
  assert.match(retired, /Retired.*aria-label="View feedback for Gone one"/s);
  const { FeedbackPanel } = await server.ssrLoadModule("/src/components/FeedbackPanel.tsx");
  assert.match(render(FeedbackPanel, { name: "Gone one", feedback: "Replaced by v2", retired: true, onClose: noop }), /Retired from the library.*Librarian&#x27;s reason.*withdraw it to Draft.*Replaced by v2/s);
});

test("the feedback panel shows the full librarian comment and the edit action", async () => {
  const { FeedbackPanel } = await server.ssrLoadModule("/src/components/FeedbackPanel.tsx");
  const props = { name: "BI Agent Suites", feedback: "Please anonymize the client information.", onClose: noop };
  const html = render(FeedbackPanel, { ...props, onEdit: noop });
  assert.match(html, /Requested changes.*BI Agent Suites.*<p[^>]*>Librarian<\/p>.*Librarian feedback.*Please anonymize.*Edit solution/s);
  assert.match(html, /aria-label="Close feedback"/);
  assert.doesNotMatch(render(FeedbackPanel, props), /Edit solution/);
});

test("the favorites heart sits beside the card button, never inside it, and hides in present mode", () => {
  const solution = { id: "fav-fixture", name: "Fixture", summary: "Summary", specializationArea: "ai", status: "Working prototype", publicationStatus: "Published", contributors: [], capabilities: [], technologies: [], industries: [], assets: [] };
  const html = render(card.SolutionCard, { solution, present: false, index: 0, favoritable: true });
  assert.match(html, /<\/div><button[^>]*aria-pressed="false"[^>]*aria-label="Save Fixture to favorites"/);
  assert.doesNotMatch(render(card.SolutionCard, { solution, present: true, index: 0, favoritable: true }), /favorites/);
  assert.doesNotMatch(render(card.SolutionCard, { solution, present: false, index: 0 }), /favorites/);
});

test("owner status panel tints by state, keeps actions on the right and shows the librarian's words", async () => {
  const { SubmissionStatusPanel } = await server.ssrLoadModule("/src/components/SubmissionStatusPanel.tsx");
  const pending = render(SubmissionStatusPanel, { state: "Pending review", actions: createElement("button", null, "Withdraw & edit") });
  assert.match(pending, /var\(--accent\)/);
  assert.match(pending, /Waiting for a librarian/);
  assert.match(pending, /sm:ml-auto[^>]*><button>Withdraw &amp; edit<\/button>/);
  const returned = render(SubmissionStatusPanel, { state: "Changes requested", feedback: "Add screenshots" });
  assert.match(returned, /var\(--proto\)/);
  assert.match(returned, /Librarian feedback[\s\S]*Add screenshots/);
  assert.doesNotMatch(render(SubmissionStatusPanel, { state: "Published" }), /Note from the librarian/);
});
