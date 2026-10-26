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

test("Markdown renders formatting without HTML, remote images or unsafe navigation", async () => {
  const { Markdown } = await server.ssrLoadModule("/src/components/Markdown.tsx");
  const html = render(Markdown, { children: "## Outcome\n\n**Bold** and *italic*\nnext line\n\n- First\n- Second\n\n[Reference](https://example.com)\n\n<script>alert(1)</script>\n\n![remote](https://example.com/tracker.png)\n\n[bad](javascript:alert(1)) [route](#/submit)" });
  assert.match(html, /<h2>Outcome<\/h2>/);
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<br\/>/);
  assert.match(html, /<li>First<\/li>/);
  assert.match(html, /href="https:\/\/example.com" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /<script|<img|javascript:|href="#/);
  const tasks = render(Markdown, { children: "- [x] Complete\n- [ ] Pending\n\n| Name | Result |\n| --- | --- |\n| Check | ~~old~~ |" });
  assert.match(tasks, /type="checkbox" disabled="" readOnly="" aria-label="Completed item" checked=""/);
  assert.match(tasks, /aria-label="Incomplete item"/);
  assert.match(tasks, /<div class="markdown-table"><table>/);
  assert.match(tasks, /<del>old<\/del>/);
});

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

test("Markdown editors preserve accessible fields, limits and literal saved source", () => {
  const html = render(form.StoryFields, { whatItDoes: "**Saved source**", businessValue: "- Benefit", onChange: noop });
  assert.equal((html.match(/class="markdown-editor"/g) ?? []).length, 2);
  assert.equal((html.match(/maxLength="4000"/g) ?? []).length, 2);
  assert.equal((html.match(/role="tablist"/g) ?? []).length, 2);
  assert.match(html, /<textarea[^>]+>\*\*Saved source\*\*<\/textarea>/);
  assert.match(html, /<label for="[^"]+">/);
  assert.doesNotMatch(html, /<label[^>]*><button/);
  const lessons = render(form.LessonsFields, { challenges: "**Internal**", lessonsLearned: "", onChange: noop });
  assert.equal((lessons.match(/maxLength="2000"/g) ?? []).length, 2);
});

test("Markdown detail formatting preserves present-mode exclusion of internal narratives", async () => {
  const { DetailView } = await server.ssrLoadModule("/src/views/DetailView.tsx");
  const { SOLUTIONS } = await server.ssrLoadModule("/src/data/solutions.ts");
  const solution = { ...SOLUTIONS[0], whatItDoes: "**Public narrative**", businessValue: "- Public benefit", challenges: "*PRIVATE-NOTE*", lessonsLearned: "PRIVATE-LESSON" };
  const normal = render(DetailView, { solution, present: false });
  const present = render(DetailView, { solution, present: true });
  assert.match(normal, /<strong>Public narrative<\/strong>/);
  assert.match(normal, /<em>PRIVATE-NOTE<\/em>/);
  assert.match(present, /<strong>Public narrative<\/strong>/);
  assert.match(present, /<li>Public benefit<\/li>/);
  assert.doesNotMatch(present, /PRIVATE-NOTE|PRIVATE-LESSON/);
});

test("help guides start collapsed with accessible controls in both app targets", async () => {
  const { HelpView } = await server.ssrLoadModule("/src/views/HelpView.tsx");
  for (const connected of [false, true]) {
    for (const librarian of [false, true]) {
      const html = render(HelpView, { connected, librarian });
      const guideIds = ["help-find", "help-share", ...(connected ? ["help-feedback"] : []), ...(librarian ? ["help-review"] : [])];
      assert.equal((html.match(/aria-expanded="false" aria-controls="help-(?:find|share|feedback|review)"/g) ?? []).length, guideIds.length);
      for (const id of guideIds) {
        assert.match(html, new RegExp(`aria-expanded="false" aria-controls="${id}"`));
        assert.match(html, new RegExp(`<section id="${id}" hidden="" aria-labelledby="${id}-title"`));
      }
      assert.doesNotMatch(html, /aria-expanded="true"/);
      assert.match(html, /aria-expanded="false" aria-controls="help-demo"/);
      assert.match(html, /id="help-demo" hidden=""/);
      assert.doesNotMatch(html, /<video|<source/);
      assert.ok(html.indexOf("Watch the demo") < html.indexOf('aria-label="Guides"'));
    }
  }
});

test("connected scoped media downloads use the protected API and never fall back after denial", async () => {
  const { downloadMedia, transferApi } = await server.ssrLoadModule("/connected/src/dataSource.ts");
  const original = transferApi.range;
  const solutionId = "11111111-1111-1111-1111-111111111111";
  const assetId = "22222222-2222-2222-2222-222222222222";
  const version = "1:2:" + "a".repeat(32);
  const calls = [];
  let mime = "image/png";
  transferApi.range = async (id, asset, mode, offset, count) => {
    calls.push({ id, asset, mode, offset, count });
    return { success: true, data: { ResultJson: JSON.stringify({ id, assetId: asset, version, offset, size: 3, mime, content: btoa("abc") }) } };
  };
  const item = { id: assetId, solutionId, sessionId: assetId, kind: "image", mime, name: "Preview.png", size: 3, received: 3, nextBlock: 1, complete: true };
  try {
    for (const kind of ["image", "thumbnail"]) {
      const result = await downloadMedia({ ...item, kind });
      assert.equal(result.type, mime);
      assert.equal(await result.text(), "abc");
      assert.deepEqual(calls.at(-1), { id: solutionId, asset: assetId, mode: "image", offset: 0, count: 3 });
    }
    mime = "application/pdf";
    for (const storage of [undefined, "blob"]) {
      const result = await downloadMedia({ ...item, kind: "attachment", mime, storage }, { solutionId, mode: "submission" });
      assert.equal(result.type, mime);
      assert.equal(await result.text(), "abc");
      assert.equal(calls.at(-1).mode, "submission");
    }
    const before = calls.length;
    await assert.rejects(downloadMedia(item, { solutionId: assetId, mode: "submission" }), /does not belong/);
    await assert.rejects(downloadMedia({ ...item, complete: false }), /not finalized/);
    assert.equal(calls.length, before);
    transferApi.range = async () => { throw new Error("SA access denied"); };
    await assert.rejects(downloadMedia(item), /SA access denied/);
    await assert.rejects(downloadMedia({ ...item, kind: "attachment", mime }, { solutionId, mode: "submission" }), /SA access denied/);
  } finally { transferApi.range = original; }
});

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

test("status field explains the chosen maturity beneath the choices", () => {
  const statuses = ["Idea / concept", "Working prototype", "Client demo", "Live in production"].map(label => ({ value: label, label }));
  const html = render(form.StatusField, { status: "Client demo", statuses, onStatus: noop });
  assert.match(html, /The label clients see on the card, in present mode too\./);
  assert.match(html, /aria-live="polite"[^>]*>.*Client demo.*Polished and reliable enough to show clients/s);
  assert.doesNotMatch(html, /Built and working end to end|Running for at least one client/);
  // The connected app's values are Dataverse numbers: the note follows the label.
  assert.match(render(form.StatusField, { status: "125060000", statuses: [{ value: "125060000", label: "Live in production" }], onStatus: noop }), /Running for at least one client, with real users and data\./);
});

test("capability fields pick one main capability, derive the main area and list other capabilities without it", () => {
  const groups = [{ label: "AI & Automation", options: [{ value: "Agents", label: "Agents" }, { value: "Automation", label: "Automation" }] }, { label: "Data Solutions", options: [{ value: "Analytics", label: "Analytics" }] }];
  const empty = render(form.CapabilityFields, { groups, secondary: [], onMain: noop, onSecondary: noop });
  assert.match(empty, /Main capability.*AI &amp; Automation.*Agents.*Data Solutions.*Analytics/s);
  assert.match(empty, /Choose the main capability to set the main specialization area/);
  // Options read A–Z within each area, whatever order they arrive in.
  const unsorted = render(form.CapabilityFields, { groups: [{ label: "Area", options: [{ value: "z", label: "Zeta" }, { value: "a", label: "Alpha" }] }], secondary: [], onMain: noop, onSecondary: noop });
  assert.match(unsorted, /Alpha.*Zeta/s);
  assert.doesNotMatch(empty, /Other capabilities involved/);
  const picked = render(form.CapabilityFields, { groups, main: "Agents", mainArea: "AI & Automation", secondary: ["Analytics"], onMain: noop, onSecondary: noop });
  assert.match(picked, /Main specialization area: <b[^>]*>AI &amp; Automation<\/b>/);
  assert.doesNotMatch(picked, /Capability owner/);
  assert.match(render(form.CapabilityFields, { groups, main: "Agents", mainArea: "AI & Automation", mainOwner: "Marta Ruiz", secondary: [], onMain: noop, onSecondary: noop }), /Capability owner: <b[^>]*>Marta Ruiz<\/b>/);
  assert.match(render(form.CapabilityFields, { groups, main: "Agents", mainArea: "AI & Automation", mainOwner: null, secondary: [], onMain: noop, onSecondary: noop }), /Capability owner: <span[^>]*>Not assigned/);
  // One radio per capability; only the main one is checked, and only its column is lit.
  assert.equal((picked.match(/type="radio"/g) ?? []).length, 3);
  assert.equal((picked.match(/checked=""/g) ?? []).length, 1);
  assert.equal((picked.match(/data-chosen="true"/g) ?? []).length, 1);
  // One other capability for now: singular wording, and no way to add a second once it is chosen.
  const others = picked.slice(picked.indexOf("Other capability involved"));
  assert.match(others, /Select one additional capability that played a significant role.*only provided minor support\./);
  assert.doesNotMatch(others, /Add a capability/);
  const room = render(form.CapabilityFields, { groups, main: "Agents", mainArea: "AI & Automation", secondary: ["Analytics"], maxSecondary: 3, onMain: noop, onSecondary: noop });
  assert.match(room, /Other capabilities involved.*Select up to 3 additional capabilities.*Add a capability/s);
  assert.match(picked, /Select the capability that played the primary role in this solution\. Its area will automatically become the solution&#x27;s Main Specialization Area\./);
  assert.match(others, /Remove <\/span>Analytics/);
  assert.doesNotMatch(others, />Agents</);
});

test("story section contains only the two narrative fields in both adapters", async () => {
  const html = render(form.StoryFields, { whatItDoes: "Actions and results", businessValue: "Business benefit", onChange: noop });
  assert.match(html, /What does it do, and why does it matter\?/);
  assert.match(html, /What the solution does/);
  assert.match(html, /Business value/);
  assert.equal((html.match(/<textarea/g) ?? []).length, 2);
  // Both are Business Required in Dataverse (nx_whatitdoes, nx_businessvalue): each label carries the required mark.
  assert.equal((html.match(/\(required\)/g) ?? []).length, 2);
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
  const legend = render(form.StepShell, { title: "Classify & tag" });
  assert.match(legend, /\*<\/span> Required for review/);
  assert.match(legend, /Only the solution name is needed to save a draft\./);
  for (const title of ["Before you start", "Review & submit"]) assert.doesNotMatch(render(form.StepShell, { title }), /Required for review|save a draft/);
  assert.match(render(form.StatusField, { status: "a", statuses: [{ value: "a", label: "Idea" }], onStatus: noop }), /Status<span aria-hidden="true"/);
  assert.match(render(form.SubmissionSafety, { accepted: false, onChange: noop }), /unauthorized information\.<span aria-hidden="true"[^>]*> \*/);
});

test("the client question hides every client field until Yes", () => {
  const props = { value: { name: "", summary: "", clientContext: "", redacted: "" }, onText: noop, selectedRoles: ["Chief of Staff"], roles: ["Chief of Staff", "Director"], onRoles: noop, framed: true, onAssociated: noop };
  for (const associated of [undefined, false]) {
    const html = render(form.ClientFields, { ...props, associated });
    assert.match(html, /Is this solution associated with a client\?/);
    assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
    assert.doesNotMatch(html, /Client name|Anonymous client profile|Target client role/);
  }
  const yes = render(form.ClientFields, { ...props, associated: true });
  assert.match(yes, /Target client roles/);
  // Every role is a toggle; several can be on at once.
  assert.equal((yes.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.equal((yes.match(/aria-pressed="false"/g) ?? []).length, 1);
  // Roles read A–Z by label, with Other last, whatever order the reference rows arrive in.
  const sorted = render(form.ClientFields, { ...props, associated: true, roles: ["Other", "Product Owner", "CIO", "Director"] });
  assert.match(sorted, />CIO<.*>Director<.*>Product Owner<.*>Other</s);
  assert.match(yes, /Client name/);
  assert.match(yes, /Anonymous client profile/);
  // Without the question (no onAssociated) the fields show as before.
  assert.match(render(form.ClientFields, { ...props, onAssociated: undefined }), /Client name/);
});

test("safety and contributor rows preserve baseline copy and accessible field structure", () => {
  assert.match(render(form.SubmissionSafety, { accepted: false, onChange: noop }), /Help keep PRISMA content safe/);
  const html = render(form.ContributorRow, { index: 0, person: createElement("input", { "aria-label": "Person" }) });
  // Compact row: the legend is for screen readers; the level in small text under the person. No hours: effort is the solution's.
  assert.match(html, /<legend class="sr-only">Contributor 1/);
  assert.doesNotMatch(html, /hours|Allocation|Start date|business days|>Level</i);
  const selected = render(form.ContributorRow, { index: 0, person: createElement("input", { "aria-label": "Person" }), level: "Customer Success Manager II" });
  assert.match(selected, /<p class="mt-1 truncate text-\[12px\][^>]*>Customer Success Manager II<\/p>/);
  assert.doesNotMatch(selected, /<select|Role|>Level</);
  assert.match(render(form.ContributorRow, { index: 0, person: createElement("input", { "aria-label": "Person" }), level: null }), /Level not recorded in the consultant directory/);
  assert.doesNotMatch(html, /Remove contributor/);
  assert.match(render(form.ContributorRow, { index: 1, person: "P", onRemove: noop }), /Remove contributor 2/);
  assert.doesNotMatch(render(form.ContributorEditor, { onAdd: noop, children: null }), /Total effort|hours/i);
  // A chosen person is a bubble: name and level on one line, remove only when allowed, no picker.
  const bubble = render(form.ContributorRow, { index: 1, person: createElement("input", { "aria-label": "Person" }), name: "Ana Ruiz", level: "Consultant II", onRemove: noop });
  assert.match(bubble, /class="contributor-chip".*>Ana Ruiz<.*· Consultant II.*aria-label="Remove contributor 2, Ana Ruiz"/s);
  assert.doesNotMatch(bubble, /<input|<fieldset/);
  assert.doesNotMatch(render(form.ContributorRow, { index: 0, person: "P", name: "Ana Ruiz" }), /Remove contributor/);
  assert.match(render(form.ContributorEditor, { onAdd: noop, children: null }), /flex-wrap.*Add contributor/s);
});

test("effort fields: required complexity as a radio group, optional whole-hour estimate", () => {
  const empty = render(form.EffortFields, { hours: "", onHours: noop, onComplexity: noop });
  // Complexity and the hour estimate share one line from small screens up.
  assert.match(empty, /sm:grid-cols-2/);
  assert.match(empty, /<fieldset[^>]*>.*<legend[^>]*>How complex was it to build\?.*<\/legend>/s);
  assert.equal((empty.match(/type="radio"/g) ?? []).length, 3);
  assert.match(empty, />Easy<.*>Medium<.*>Hard</s);
  assert.doesNotMatch(empty, /checked=""/);
  assert.match(empty, /Estimated minimum hours.*type="number"[^>]*step="1"/s);
  assert.doesNotMatch(empty, /role="alert"/);
  const chosen = render(form.EffortFields, { hours: "12.5", complexity: "Hard", onHours: noop, onComplexity: noop, error: "Enter whole hours of zero or more." });
  assert.match(chosen, /checked=""[^>]*\/?>Hard/);
  // The chosen complexity's meaning shows in the app's note style, not as a plain hint.
  assert.match(chosen, /aria-live="polite"[^>]*>.*Hard.*New territory, many moving parts\./s);
  assert.doesNotMatch(chosen, /Easy: familiar work/);
  assert.match(empty, /Easy: familiar work\. Medium: some new ground\./);
  assert.match(chosen, /aria-invalid="true"/);
  assert.match(chosen, /role="alert"[^>]*>Enter whole hours of zero or more\./);
});

test("media files demos, interactive demos and supporting material in their own sections", () => {
  const props = { capabilities: [], onRemoveThumbnail: noop, thumbnailUpload: "Thumbnail upload", images: [{ id: "image", caption: "Overview", preview: createElement("img", { src: "data:image/png;base64,AA==", alt: "Overview" }) }], imageUpload: "Image upload", onCaption: noop, onRemoveImage: noop, onAttachment: noop, onRemoveAttachment: noop,
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

test("uploaded attachments expose display-name editing with original filenames and upload locks", () => {
  const props = { capabilities: [], onRemoveThumbnail: noop, images: [], onCaption: noop, onRemoveImage: noop, onAttachment: noop, onRemoveAttachment: noop, onRenameAttachment: async () => {},
    attachments: [{ id: "pdf", name: "Client overview", fileName: "original.pdf", purpose: "Supporting material" }, { id: "upload", name: "video.mp4", purpose: "Demo video", status: "Uploading..." },
      { id: "link", name: "Application", purpose: "Interactive demo", linkedAsset: { name: "Application", assetType: "Power Apps", externalUrl: "https://example.com", embedHint: "", allowsEmbedding: false } }] };
  const html = render(form.SubmissionMedia, props);
  assert.match(html, /File: original.pdf/);
  assert.match(html, /aria-label="Edit display name for Client overview"/);
  assert.match(html, /disabled="" title="Edit display name" aria-label="Edit display name for video.mp4"/);
  assert.doesNotMatch(html, /Edit display name for Application/);
  const locked = render(form.SubmissionMedia, { ...props, disabled: true });
  assert.match(locked, /disabled="" title="Edit display name" aria-label="Edit display name for Client overview"/);
  const editor = render(form.AttachmentNameEditor, { name: "Client overview", disabled: false, onSave: async () => {}, onClose: noop });
  assert.match(editor, /Display name/);
  assert.match(editor, /maxLength="100" value="Client overview"/);
  assert.match(editor, /original filename stays unchanged/);
  assert.match(editor, /Save display name/);
  assert.match(editor, />Cancel<\/button>/);
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
  assert.match(html, /class="loading-rail"/);
  assert.match(html, /Uploading/);
  assert.doesNotMatch(html, /Unfinished upload/);
  assert.match(render(form.UploadProgress, { name: "demo.html", received: 1000, size: 1000, active: true }), /Finalizing/);
  assert.match(render(form.UploadProgress, { name: "demo.html", received: 0, size: 0, active: false }), /aria-valuenow="0"/);
  assert.match(render(form.UploadProgress, { name: "demo.html", received: 720, size: 1000, active: false }), /Upload incomplete/);
});

test("review panel: overview, required publication checklist, and a decision that needs real feedback", () => {
  const props = { status: "Pending review", owner: "Ana", comments: "", onComments: noop, cleared: false, onCleared: noop, busy: false, onReturn: noop, onApprove: noop };
  // Status, Solution overview, Publication checklist, then the decision; nothing to act on until a decision is chosen.
  const html = render(review.ReviewPanel, props);
  assert.match(html, /Librarian review.*Pending review.*Solution overview.*Submitted by.*Ana.*Publication checklist.*0 \/ 5 confirmed.*Review decision.*Approve.*Request changes/s);
  // No client named and no context: no Client row; no owner known: no Capability owner row.
  assert.doesNotMatch(html, />Client<|Capability owner/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 5);
  assert.match(html, /personal data \(PII\).*anonymized.*professionally written.*intended audience.*classify the solution correctly/s);
  const solution = { id: "r", name: "R", summary: "S", specializationArea: "data", specializationAreas: ["data"], status: "Client demo", publicationStatus: "Pending review", reviewOutcome: "Changes requested", capabilities: ["Data platforms"], contributors: [], technologies: [], assets: [] };
  const checked = render(review.ReviewPanel, { ...props, solution, capabilityOwner: "Marta Ruiz", client: "Bank X", context: "", feedback: "Anonymize it", checks: [{ label: "Summary and capability", done: true }, { label: "Detail images (1 to 6)", done: false }] });
  assert.match(checked, /Capability<\/dt><dd[^>]*>Data platforms.*Capability owner<\/dt><dd[^>]*>Marta Ruiz.*Specialization area<\/dt>.*Data Solutions.*Submitted by.*Client<\/dt>.*Bank X.*shown as.*not provided/s);
  assert.match(render(review.ReviewPanel, { ...props, solution, capabilityOwner: null }), /Capability owner.*Not assigned/s);
  // Missing required content is listed inside the checklist; met requirements are not repeated.
  const points = checked.match(/<ul class="[^"]*list-disc[^"]*">.*?<\/ul>/s)?.[0] ?? "";
  assert.match(checked, /Missing content/);
  assert.match(points, /<li>Detail images \(1 to 6\)<\/li>/);
  assert.doesNotMatch(points, /Summary and capability/);
  assert.doesNotMatch(render(review.ReviewPanel, { ...props, solution, checks: [{ label: "Summary and capability", done: true }] }), /Missing content/);
  assert.match(checked, /Resubmitted after changes requested.*Anonymize it/s);
  assert.match(render(review.ReviewPanel, { ...props, solution: { ...solution, reviewOutcome: "None" }, feedback: "Old note" }), /Latest review comments/);
  // A returned record awaits its contributor: the status says so and the feedback sits below the overview, with no checklist or decision.
  const waiting = render(review.ReviewPanel, { ...props, status: "Draft", solution: { ...solution, publicationStatus: "Draft" }, feedback: "Anonymize it" });
  assert.match(waiting, /<h2[^>]*>Changes requested<\/h2>.*Solution overview.*Waiting for corrections.*Sent back to the contributor.*Your feedback.*Anonymize it/s);
  assert.doesNotMatch(waiting, /Review decision|Publication checklist|Latest review comments|Resubmitted after/);
  // Published: a green block with the optional approval note and an explained, secondary retire action.
  const live = render(review.ReviewPanel, { ...props, status: "Published", solution: { ...solution, publicationStatus: "Published", reviewOutcome: "Approved" }, feedback: "Great work", onRetire: noop, onRequestChanges: noop });
  // Published: one compact row (status left, two small actions right); no form, cards or heading until an action is chosen.
  assert.match(live, /Solution overview.*>Published<\/span>.*Available in the Solution Library\..*aria-expanded="false"[^>]*>.*Request changes<\/button>.*aria-expanded="false"[^>]*>.*Retire<\/button>.*Your note to the contributor.*Great work/s);
  assert.doesNotMatch(live, /<textarea|type="radio"|Need to change it|Review decision|Publication checklist|Latest review comments/);
  assert.doesNotMatch(render(review.ReviewPanel, { ...props, status: "Published" }), /Your note to the contributor|Request changes<\/button>|Retire<\/button>/);
  const retireOnly = render(review.ReviewPanel, { ...props, status: "Published", onRetire: noop });
  assert.match(retireOnly, /Retire<\/button>/);
  assert.doesNotMatch(retireOnly, /Request changes<\/button>/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<textarea|Approve &amp; publish|Send back for changes/);
  assert.match(html, /Submission preview · what the contributor submitted/);
  // Request changes: a required, meaningful comment (15+ characters) before sending back.
  const changes = { ...props, defaultDecision: "changes" };
  const back = render(review.ReviewPanel, changes);
  const field = back.match(/What needs to be corrected.*?<textarea[^>]*>/s)?.[0] ?? "";
  for (const attribute of [/required=""/, /maxLength="4000"/, /minLength="15"/]) assert.match(field, attribute);
  assert.doesNotMatch(back, /Approve &amp; publish/);
  assert.match(back, /disabled=""[^>]*>.*Send back for changes/s);
  assert.match(back, /Explain what needs to be corrected \(at least 15 characters\)\./);
  assert.match(render(review.ReviewPanel, { ...changes, comments: "Fix it" }), /disabled=""[^>]*>.*Send back for changes/s);
  assert.doesNotMatch(render(review.ReviewPanel, { ...changes, comments: "Fix the screenshots" }), /disabled=""[^>]*>.*Send back for changes/s);
  // Approve: the whole checklist must be confirmed, plus an optional note and an explained disabled state.
  const publish = { ...props, defaultDecision: "publish" };
  const ready = render(review.ReviewPanel, publish);
  assert.match(ready, /Note to the submitter.*optional/s);
  assert.doesNotMatch(ready, /Send back for changes/);
  assert.match(ready, /Confirm the publication checklist to approve \(5 of 5 left\)\./);
  assert.match(ready, /disabled=""[^>]*>.*Approve &amp; publish/s);
  assert.doesNotMatch(render(review.ReviewPanel, { ...publish, cleared: true }), /disabled=""/);
  const incomplete = render(review.ReviewPanel, { ...publish, cleared: true, canApprove: false });
  assert.match(incomplete, /disabled=""[^>]*>.*Approve &amp; publish/s);
  assert.match(incomplete, /Add the missing content before approving\./);
  assert.match(render(review.ReviewPanel, { ...publish, cleared: true, locked: true }), /<fieldset disabled=""/);
  assert.doesNotMatch(render(review.ReviewPanel, { ...props, status: "Published" }), /Review decision|Approve &amp; publish/);
  assert.match(render(review.ReviewPanel, { ...props, busy: true }), /loading-state--inline/);
  assert.match(render(review.ReviewPanel, { ...props, notice: "Downloading document...", noticeBusy: true }), /loading-state--inline/);
  assert.doesNotMatch(render(review.ReviewPanel, { ...props, notice: "Download started: document" }), /loading-state--inline/);
});

test("review panel: librarian edits need an explanation for the owner (ADR-0013)", () => {
  const props = { status: "Pending review", owner: "Ana", comments: "", onComments: noop, cleared: true, onCleared: noop, busy: false, onReturn: noop, onApprove: noop };
  // Edit is offered only when the caller passes it; the PoC never does.
  assert.doesNotMatch(render(review.ReviewPanel, props), /Edit solution/);
  assert.match(render(review.ReviewPanel, { ...props, onEdit: noop }), /Edit solution/);
  // A librarian's own solution: no Edit, and the reason instead.
  const own = render(review.ReviewPanel, { ...props, editBlocked: "You submitted this solution, so you edit it as its owner." });
  assert.doesNotMatch(own, /Edit solution/);
  assert.match(own, /You submitted this solution, so you edit it as its owner\./);
  // Pending: after a real edit the approval note is required and says why.
  const publish = { ...props, defaultDecision: "publish", edit: { on: "2026-10-15", by: "Lia Librarian", pending: true } };
  const unexplained = render(review.ReviewPanel, publish);
  assert.match(unexplained, /Last librarian edit.*Lia Librarian · 2026-10-15.*not explained to the owner yet/s);
  assert.match(unexplained, /What you changed and why.*required, you edited this solution/s);
  assert.match(unexplained, /Tell the contributor what you changed and why\./);
  assert.match(unexplained, /disabled=""[^>]*>.*Approve &amp; publish/s);
  assert.doesNotMatch(render(review.ReviewPanel, { ...publish, comments: "Shortened the summary" }), /disabled=""/);
  assert.match(render(review.ReviewPanel, { ...publish, edit: { on: "2026-10-15", pending: false } }), /Note to the submitter.*optional/s);
  // Published: Confirm changes repeats the checklist, needs the explanation and replaces Request changes / Retire.
  const live = { ...props, status: "Published", cleared: false, onRequestChanges: noop, onRetire: noop, onConfirmEdit: noop, edit: { on: "2026-10-15", pending: true } };
  const waiting = render(review.ReviewPanel, live);
  assert.match(waiting, /Publication checklist.*Left out of present mode until you confirm your changes\..*Confirm your changes.*What you changed and why/s);
  assert.match(waiting, /disabled=""[^>]*>.*Confirm changes/s);
  assert.doesNotMatch(waiting, /Request changes<\/button>|Retire<\/button>/);
  assert.match(render(review.ReviewPanel, { ...live, cleared: true }), /Tell the owner what you changed and why\./);
  assert.doesNotMatch(render(review.ReviewPanel, { ...live, cleared: true, comments: "Removed the client name" }), /disabled=""[^>]*>.*Confirm changes/s);
  assert.match(render(review.ReviewPanel, { ...live, cleared: true, comments: "Removed the client name", canApprove: false }), /Add the missing content before confirming\./);
  // Without an unexplained edit, Edit solution is the primary action and taking it out of the library sits in a menu.
  const editable = render(review.ReviewPanel, { ...live, onEdit: noop, edit: { on: "2026-10-15", pending: false } });
  assert.match(editable, /Available in the Solution Library\..*Edit solution<\/button>.*aria-label="More actions: take it out of the library"/s);
  assert.match(editable, /Send back to owner….*Retire from library…/s);
  assert.doesNotMatch(editable, /Request changes<\/button>|Retire<\/button>/);
  assert.equal((editable.match(/Edit solution/g) ?? []).length, 1);
  // Without Edit (the PoC), the published row keeps its two buttons.
  assert.match(render(review.ReviewPanel, { ...live, onEdit: undefined, onConfirmEdit: undefined, edit: undefined }), /Request changes<\/button>.*Retire<\/button>/s);
  // Pending with Edit: the decision card points to Edit solution.
  assert.match(render(review.ReviewPanel, { ...props, onEdit: noop }), /To fix it yourself, use Edit solution\./);
});

test("librarian edit notice: an informational note, with the present-mode rule only for published records", async () => {
  const { LibrarianEditNotice } = await server.ssrLoadModule("/src/components/LibrarianEditNotice.tsx");
  const pending = render(LibrarianEditNotice, { published: false });
  assert.match(pending, /<section role="note" aria-labelledby="[^"]+"/);
  assert.match(pending, /You&#x27;re editing as librarian.*stays in Pending review.*Contributors stay with the owner.*what you changed and why/s);
  assert.doesNotMatch(pending, /present mode/);
  const published = render(LibrarianEditNotice, { published: true });
  assert.match(published, /stays published.*left out of present mode/s);
  assert.match(published, /color:var\(--proto\)/);
});

test("review queue classifies by the main capability: its area, then the capability, one tag each", () => {
  const base = { summary: "Summary", status: "Working prototype", publicationStatus: "Pending review", reviewOutcome: "None", contributors: [], technologies: [], assets: [], dateAdded: "2026-10-01" };
  // Areas picked by hand before 2026-10-23 can disagree with the capability: the capability's area wins.
  const entries = [{ owner: "Ana", solution: { ...base, id: "mixed", name: "Mixed one", specializationArea: "ai", specializationAreas: ["ai", "ibo"], capabilities: ["Data Engineering", "Analytics Consulting"] } }];
  const html = render(review.ReviewQueue, { entries, connected: true, capabilityAreas: { "Data Engineering": "data", "Analytics Consulting": "data" } });
  const row = html.slice(html.indexOf("<ul"));
  assert.match(row, /Data Solutions.*>Data Engineering</s);
  assert.doesNotMatch(row, /AI &amp; Automation|Intelligent Business Operations|Analytics Consulting/);
  // Nothing narrowed yet: no Clear all.
  assert.doesNotMatch(html, />Clear all</);
  // Without a known capability area, the first area stands in.
  assert.match(render(review.ReviewQueue, { entries, connected: true }).slice(html.indexOf("<ul")), /AI &amp; Automation/);
});

test("my submissions list rows keep the card's management on one line", async () => {
  const { SubmissionRow } = await server.ssrLoadModule("/src/components/SubmissionRow.tsx");
  const solution = { id: "r", name: "Returned one", summary: "Summary", specializationArea: "ai", status: "Working prototype", publicationStatus: "Draft", reviewOutcome: "Changes requested", reviewComments: "Blur it.", contributors: [], capabilities: [], technologies: [], assets: [] };
  const html = render(SubmissionRow, { solution, index: 0, onOpen: noop, manage: { actions: "MENU", corner: "EDIT", onFeedback: noop, unread: 1, actionNeeded: true } });
  assert.match(html, /submission-row[^"]*submission-row--changes.*class="card-open[^"]*"[^>]*aria-label="Returned one — Changes requested">Returned one<.*Changes requested.*View feedback for Returned one.*EDIT.*MENU/s);
  const suggested = render(SubmissionRow, { solution: { ...solution, publicationStatus: "Published", reviewOutcome: "Approved", reviewComments: undefined }, index: 0, onOpen: noop, manage: { actions: null, unread: 2 } });
  assert.match(suggested, /submission-row--new.*2 pending suggestions/s);
  assert.doesNotMatch(suggested, /View feedback/);
  assert.doesNotMatch(html, /Action needed/);
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
  // Amber means "your turn": the Pending review count matches the masthead badge; other counts stay neutral.
  assert.match(html, /Pending review<span[^>]*style="color:color-mix\(in srgb, var\(--proto\) 85%, var\(--ink\)\)/);
  assert.doesNotMatch(html, /Published<span[^>]*var\(--proto\)/);
  // One line under the tabs says what the open tab holds, in its colour.
  assert.match(html, /aria-label="Review status".*border-color:var\(--proto\)[^>]*>.*Your turn<\/span> · Submissions waiting for your review/s);
  // A small date in the top corner; the full date stays in its title and for screen readers.
  const short = new Date().getFullYear() === 2026 ? "Sep 30" : "Sep 30, 2026";
  assert.match(html, new RegExp(`<time dateTime="2026-09-30" title="Submitted Sep 30, 2026"[^>]*><span class="sr-only">Submitted </span>${short}</time>`));
  assert.match(html, /AI &amp; Automation.*AI &amp; agents.*PRISMA APP.*Summary.*Juliana Castelblanco.*2 images.*1 attachment<.*Review submission/s);
  // The row edge follows the review state (blue while pending), not the area.
  assert.match(html, /w-1" style="background:var\(--accent\)"/);
  assert.doesNotMatch(html, /w-1" style="background:var\(--sa-/);
});

test("review summary and success use the baseline presentation", () => {
  const html = render(form.SubmissionReview, { card: "Card", attachments: 1, contributors: "Builder", effort: "~120 h · Medium", images: "Generated poster · 1 screenshot", safety: "Acknowledged; review required", client: "", context: "", nextState: "Pending review" });
  assert.match(html, /inert=""/);
  assert.match(html, /Effort.*~120 h · Medium/s);
  assert.doesNotMatch(html, /Total effort/);
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
  const client = render(form.ClientFields, { value: { name: "", summary: "", clientContext: "", redacted: "" }, onText: noop, selectedRoles: [], roles: ["Chief of Staff"], onRoles: noop, framed: true });
  assert.equal((client.match(/Internal only/g) ?? []).length, 1);
  assert.equal((client.match(/Shown to clients/g) ?? []).length, 2);
  // Multi-card steps stay unframed; single-section steps become cards.
  for (const title of ["Define the solution", "Solution context"]) assert.doesNotMatch(inCards(createElement(form.StepShell, { title })), /rounded-\[20px\] border/);
  assert.match(inCards(createElement(form.StepShell, { title: "Classify & tag" })), /<h2[^>]*>Classify &amp; tag<\/h2>.*Shown to clients/);
  assert.doesNotMatch(render(form.StepShell, { title: "Classify & tag" }), /Shown to clients/);
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
  // One level of navigation: no tabs, only the status chips under "All my solutions"; suggestions are no status.
  assert.doesNotMatch(html, /role="tablist"|role="tab"|Filter by feedback/);
  assert.match(html, />All my solutions<.*Filter by status/s);
  const suggested = render(MySubmissionsView, { entries, connected: true, suggestions: { live: { count: 3, authors: ["Ana", "Luis", "Marta"], ids: [] } } });
  assert.doesNotMatch(suggested, /role="tablist"/);
  assert.doesNotMatch(suggested, /Filter by feedback|Librarian comments|Review queue/);
  // A compact footer indicator (icon and count, no names) that opens the published page.
  assert.match(suggested, /title="View suggestions" aria-label="View 3 suggestions for Live one"[^>]*>.*?<svg.*?<\/svg>3<\/button>/s);
  assert.doesNotMatch(suggested, /suggestions? from|Ana|Marta/);
  // A managed card is not itself a button: its title opens it and the controls sit beside that button.
  assert.doesNotMatch(html, /role="button"/);
  assert.equal((html.match(/class="card-open/g) ?? []).length, 4);
  // The returned draft's feedback: Review changes in the attention list, View feedback on its card.
  assert.equal((html.match(/aria-label="View feedback for /g) ?? []).length, 1);
  assert.match(html, /aria-label="Review changes for Returned one"/);
  assert.match(html, /aria-label="View feedback for Returned one"/);
  assert.doesNotMatch(html, /Please anonymize|View submission/);
  // Connected Pending review and Published records are withdrawn on their page, not edited from the card.
  assert.match(html, /aria-label="Edit Draft one"/);
  // Edit sits on the image's top-right corner, before the title, not in the footer beside •••.
  assert.match(html, /card-poster.*?absolute top-3 right-3 z-\[2\]"><button[^>]*aria-label="Edit Draft one".*?card-open/s);
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
  // Published: the state as heading with its icon and one line; no "Your submission" label or workflow validations.
  const published = render(SubmissionStatusPanel, { state: "Published", actions: createElement("button", null, "Unpublish & edit") });
  assert.match(published, /<h2[^>]*>Published<\/h2><p[^>]*>This solution is available in the Solution Library\.<\/p>/);
  assert.match(published, /sm:border-l[^>]*><button>Unpublish &amp; edit<\/button>/);
  assert.doesNotMatch(published, /Your submission|Live in the library|Safety acknowledged|Cleared for presentation/);
});

test("challenges and lessons learned are optional, internal and limited to the Dataverse length", () => {
  const html = render(form.LessonsFields, { challenges: "", lessonsLearned: "", onChange: noop });
  assert.match(html, /Challenges &amp; lessons learned/);
  assert.match(html, /Internal only: never shown in presentation mode\./);
  assert.match(html, /Challenges<span[^>]*>\(optional\)/);
  assert.match(html, /Lessons learned<span[^>]*>\(optional\)/);
  assert.equal((html.match(/maxLength="2000"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /\(required\)/);
});

test("tagging comes right after defining the solution; internal context follows it", () => {
  assert.deepEqual([...form.SUBMISSION_STEPS], ["Before you start", "Define the solution", "Classify & tag", "Solution context", "Media", "Review & submit"]);
});

test("tag pickers show chosen tags first, list only what is left and search only long lists", async () => {
  const { TagPicker } = await server.ssrLoadModule("/src/components/TagPicker.tsx");
  const short = render(TagPicker, { label: "Industries", optional: true, governed: true, hint: "Industries where it applies.", options: ["Retail", "Energy"], selected: ["Retail"], onChange: noop });
  assert.match(short, /Industries where it applies\./);
  assert.match(short, /aria-label="Selected industries".*<span class="sr-only">Remove <\/span>Retail/s);
  assert.match(short, /aria-label="Available industries".*<span class="sr-only">Add <\/span>Energy/s);
  assert.doesNotMatch(short.split('aria-label="Available industries"')[1], /Retail/);
  assert.doesNotMatch(short, /type="search"|Librarian-managed/);
  const long = render(TagPicker, { label: "Technologies", optional: true, options: Array.from({ length: 13 }, (_, index) => `Tool ${index}`), selected: [], onChange: noop });
  assert.match(long, /type="search"[^>]*aria-label="Search technologies"/);
  assert.doesNotMatch(long, /aria-label="Selected technologies"/);
});

test("suggestions: readers see a private list with author and date; others get a short form", async () => {
  const ui = await server.ssrLoadModule("/connected/src/SolutionSuggestions.tsx");
  const empty = render(ui.SuggestionsPanel, { list: { canRead: true, suggestions: [] } });
  assert.match(empty, /Suggestions<span[^>]*>0<\/span>.*Private · owner, this solution&#x27;s contributors and the librarian/s);
  assert.doesNotMatch(empty, /internal only/);
  assert.match(empty, /No suggestions yet\./);
  const item = [{ id: "a", text: "Add an export to Excel.", author: "Ana Gómez", createdOn: "2026-10-13T15:04:05Z" }];
  // The uploader: the description, a Pending / Addressed / All filter (Pending first while any is open) and a check on each.
  const one = render(ui.SuggestionsPanel, { list: { canRead: true, suggestions: item }, canAddress: true });
  assert.match(one, /Review feedback on this solution\. Mark suggestions as addressed once reviewed, whether or not you apply the changes\./);
  assert.match(one, /aria-label="Show suggestions".*aria-pressed="true"[^>]*>Pending<span[^>]*>1<\/span>.*Addressed<span[^>]*>0<\/span>.*All<span[^>]*>1<\/span>/s);
  assert.match(one, /Add an export to Excel\..*aria-pressed="false" title="Mark as addressed"/s);
  // Contributors and the librarian: the state only, no check.
  const reader = render(ui.SuggestionsPanel, { list: { canRead: true, suggestions: item } });
  assert.match(reader, /The owner marks suggestions as addressed from My submissions\..*class="suggestion-state ">Pending</s);
  assert.doesNotMatch(reader, /Mark as addressed/);
  assert.match(one, /Ana Gómez<\/span> · <time dateTime="2026-10-13T15:04:05Z">/);
  assert.match(one, /Add an export to Excel\./);
  const form = render(ui.SuggestForm, { api: {}, solutionId: "s", onClose: noop, onSent: noop });
  assert.match(form, /Suggest an improvement/);
  assert.match(form, /Only the owner, the people credited on this solution and the PRISMA librarian see it, with your name\./);
  assert.match(form, /maxLength="1000"/);
  assert.match(form, /<button[^>]*disabled=""[^>]*>Send suggestion<\/button>/);
  // The same items render inside a submitted solution's page, below its details.
  assert.match(render(ui.SuggestionItems, { suggestions: [{ id: "a", text: "Add an export to Excel.", author: "Ana Gómez", createdOn: "2026-10-13T15:04:05Z" }] }), /Ana Gómez.*Add an export to Excel\./s);
  const card = render(ui.SuggestCard, { sent: false, onOpen: noop });
  assert.match(card, /class="suggest-card.*Suggest an improvement.*Have an idea to improve this solution\? Share your suggestion with the solution team\./s);
});

test("solution sidebar: overview, business context and technologies for everyone; internal sections never in present mode", async () => {
  const { DetailView } = await server.ssrLoadModule("/src/views/DetailView.tsx");
  const solution = { id: "s", name: "S", summary: "Sum", whatItDoes: "Does", businessValue: "Value", specializationArea: "ai", specializationAreas: ["ai"], status: "Working prototype", publicationStatus: "Published", capabilities: ["Data Engineering"], technologies: ["Power Apps code app", "Microsoft Fabric"], industries: ["Education", "IT"], clientRoles: ["Chief of Staff", "Director"], clientContext: "MICROSOFT", clientContextRedacted: "A global software company", clientSafeReviewed: true, contributors: [], assets: [], projects: [{ id: "p", projectName: "Project Atlas" }], dateAdded: "2026-10-01", estimatedMinimumHours: 230, complexity: "Medium" };
  const effort = { contributors: [{ name: "Ana Gómez", level: "Senior Consultant" }, { name: "Luis Pérez", level: "Customer Success Manager" }] };
  const normal = render(DetailView, { solution, present: false, connected: true, effort, capabilityOwner: { name: "Marta Ruiz" }, aside: "SUGGEST" });
  assert.match(normal, /Solution overview.*Specialization area.*Capability.*Data Engineering.*Capability owner.*MR.*Marta Ruiz/s);
  assert.match(normal, /Business context.*Target roles.*Chief of Staff.*Director.*Industries.*Education.*IT.*Client \(internal\).*MICROSOFT.*Shown to clients as.*A global software company/s);
  assert.match(normal, /Technologies used.*Power Apps code app.*Microsoft Fabric/s);
  assert.match(normal, /Contributors &amp; development effort.*Ana Gómez.*Senior Consultant.*Luis Pérez.*Complexity.*Medium.*Estimated minimum hours.*230 h/s);
  assert.doesNotMatch(normal, /~230|Estimated development effort/);
  assert.doesNotMatch(normal, /Minimum hours invested|15 h/);
  assert.match(render(DetailView, { solution: { ...solution, estimatedMinimumHours: undefined, complexity: undefined }, present: false, connected: true, effort }), /Complexity.*Not set.*Estimated minimum hours.*Not estimated/s);
  assert.match(normal, /Associated projects · 1.*Project Atlas/s);
  assert.match(normal, /SUGGEST/);
  assert.doesNotMatch(normal, /Built on|At a glance|Built by|Delivered for|Total effort|>Context</);
  assert.match(render(DetailView, { solution, present: false, connected: true, effort, capabilityOwner: null }), /Capability owner.*Not assigned/s);
  const present = render(DetailView, { solution, present: true, connected: true, effort, capabilityOwner: { name: "Marta Ruiz" }, aside: "SUGGEST" });
  assert.match(present, /Solution overview.*Data Engineering.*Business context.*Chief of Staff.*Client context.*A global software company.*Technologies used/s);
  assert.doesNotMatch(present, /Capability owner|Marta Ruiz|MICROSOFT|Contributors|Ana Gómez|Complexity|Medium|minimum hours|230|Associated projects|Project Atlas|SUGGEST|Added/);
});

test("refine groups show five options, keep selected ones at zero, and search long lists", async () => {
  const { FacetGroup } = await server.ssrLoadModule("/src/components/FacetRail.tsx");
  const counts = new Map(Array.from({ length: 9 }, (_, index) => [`Option ${index + 1}`, 9 - index]));
  const html = render(FacetGroup, { label: "Technology", counts, selected: ["Retired option"], searchable: true, onToggle: noop });
  // The heading counts the options on offer: nine listed plus the selected one at zero.
  assert.match(html, /aria-expanded="true"[^>]*>.*Technology <span[^>]*aria-label="10 options">10<\/span>.*1 selected/s);
  assert.match(html, /aria-label="Search technology options"/);
  // Five options plus the selected one, which has no results under the current search.
  assert.equal((html.match(/aria-pressed=/g) ?? []).length, 6);
  assert.match(html, /aria-pressed="true"[^>]*>.*Retired option.*>0<\/span>/s);
  assert.match(html, /Show 4 more/);
  assert.doesNotMatch(html, /truncate/);
  // Short or non-searchable lists get no search box.
  assert.doesNotMatch(render(FacetGroup, { label: "Demo", counts: new Map([["Demo video", 2]]), selected: [], searchable: false, onToggle: noop }), /type="search"/);
});

test("library shows active filters above the cards with a total, result count and Clear all", async () => {
  const { LibraryView } = await server.ssrLoadModule("/src/views/LibraryView.tsx");
  const { SOLUTIONS } = await server.ssrLoadModule("/src/data/solutions.ts");
  const { EMPTY_FILTERS } = await server.ssrLoadModule("/src/lib/search.ts");
  const capability = SOLUTIONS[0].capabilities[0];
  const html = render(LibraryView, { catalogue: SOLUTIONS, filters: { ...EMPTY_FILTERS, capabilities: [capability], added: "1y" }, onFilters: noop, present: false });
  assert.match(html, /aria-label="Active filters".*2 filters.*results?<\/span>.*Clear all/s);
  assert.match(html, /aria-label="Refine solutions".*aria-label="Hide filters"/s);
  assert.doesNotMatch(render(LibraryView, { catalogue: SOLUTIONS, filters: EMPTY_FILTERS, onFilters: noop, present: false }), /Active filters/);
});
test("present mode offers a Show my saved solutions switch over the client-safe catalogue", async () => {
  const { LibraryView } = await server.ssrLoadModule("/src/views/LibraryView.tsx");
  const { SOLUTIONS } = await server.ssrLoadModule("/src/data/solutions.ts");
  const { EMPTY_FILTERS } = await server.ssrLoadModule("/src/lib/search.ts");
  const [first, second, third] = SOLUTIONS;
  // Only the catalogue present mode passes in counts: a saved ID outside it never shows or counts.
  const catalogue = [first, second];
  const off = render(LibraryView, { catalogue, filters: EMPTY_FILTERS, onFilters: noop, present: true, selected: [first.id, third.id], selectionStart: false });
  assert.match(off, /role="switch" aria-checked="false"[^>]*>.*Show my saved solutions<span[^>]*>1<\/span>/s);
  assert.match(off, new RegExp(second.name));
  const on = render(LibraryView, { catalogue, filters: EMPTY_FILTERS, onFilters: noop, present: true, selected: [first.id, third.id], selectionStart: true });
  assert.match(on, /role="switch" aria-checked="true"/);
  assert.match(on, new RegExp(first.name));
  assert.doesNotMatch(on, new RegExp(second.name));
  // Outside present mode, or with nothing saved that is client-safe, there is no switch.
  assert.doesNotMatch(render(LibraryView, { catalogue, filters: EMPTY_FILTERS, onFilters: noop, present: false, selected: [first.id] }), /Show my saved solutions/);
  assert.doesNotMatch(render(LibraryView, { catalogue, filters: EMPTY_FILTERS, onFilters: noop, present: true, selected: [third.id] }), /Show my saved solutions/);
});

test("library Clear all resets search and area too, shown as removable chips", async () => {
  const { LibraryView } = await server.ssrLoadModule("/src/views/LibraryView.tsx");
  const { SOLUTIONS } = await server.ssrLoadModule("/src/data/solutions.ts");
  const { EMPTY_FILTERS } = await server.ssrLoadModule("/src/lib/search.ts");
  for (const present of [false, true]) {
    const html = render(LibraryView, { catalogue: SOLUTIONS, filters: { ...EMPTY_FILTERS, q: "ledger", area: "data" }, onFilters: noop, present });
    assert.match(html, /aria-label="Active filters".*2 filters.*“ledger”.*Data Solutions.*Clear all/s);
  }
});
test("download presentation opens a theme menu instead of expanding the action row", async () => {
  const { DownloadDeckButton } = await server.ssrLoadModule("/connected/src/DownloadDeckButton.tsx");
  const html = render(DownloadDeckButton, { solution: { id: "s", name: "S" }, media: [] });
  assert.match(html, /aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*>.*Download presentation/s);
  assert.doesNotMatch(html, /role="menu"|>Dark<|>Light<|Cancel/);
});
test("masthead: primary row with Submit, Present and utilities; section navigation below, Review queue only for librarians", () => {
  const user = { fullName: "Ana Gómez", userPrincipalName: "ana@nextant.com", live: true };
  const props = { user, theme: "dark", onToggleTheme: noop, present: false, onTogglePresent: noop, favoriteCount: 3, reviewAvailable: false };
  const html = render(masthead.Masthead, props);
  assert.match(html, /Submit a solution.*Present mode.*<nav aria-label="Sections".*Library.*Saved solutions.*My submissions/s);
  // Saved solutions are not work to do, so their tab carries no number (the heart fills instead).
  assert.doesNotMatch(html, /aria-label="3 saved"|Saved solutions<span/);
  assert.doesNotMatch(html, /Review queue/);
  assert.match(render(masthead.Masthead, { ...props, reviewAvailable: true }), /<nav aria-label="Sections".*Review queue/s);
  // Present mode and read-only (before entry) show no section navigation.
  assert.doesNotMatch(render(masthead.Masthead, { ...props, present: true }), /aria-label="Sections"/);
  assert.doesNotMatch(render(masthead.Masthead, { ...props, readOnly: true }), /aria-label="Sections"/);
  // Help sits with the utilities; never in present mode or before entry.
  assert.match(html, /aria-label="Help: how PRISMA works"/);
  assert.doesNotMatch(render(masthead.Masthead, { ...props, present: true }), /Help: how PRISMA works/);
  assert.doesNotMatch(render(masthead.Masthead, { ...props, readOnly: true }), /Help: how PRISMA works/);
});

test("help page: one guide per role and common questions, tailored to the app, with no in-page hash links", async () => {
  const { HelpView } = await server.ssrLoadModule("/src/views/HelpView.tsx");
  const poc = render(HelpView, {});
  assert.match(poc, /How PRISMA works.*<nav aria-label="Guides".*Find and Present a Solution.*Share Your Work.*Review and Curate/s);
  assert.match(poc, /Present Mode.*Common questions.*What does present mode hide\?/s);
  assert.match(poc, /<details[^>]*><summary/);
  // The PoC promises only what it has.
  assert.doesNotMatch(poc, /Download Presentation|Suggest an Improvement|Edit Solution|Unpublish &amp; Edit|Confirm Changes/);
  assert.match(poc, /Edit submission/);
  const connected = render(HelpView, { connected: true, librarian: true });
  assert.match(connected, /Download Presentation.*Suggest an Improvement.*Unpublish &amp; Edit.*Edit Solution.*Confirm Changes.*Send Back to Owner/s);
  assert.match(connected, /Why can&#x27;t I edit my own solution from the Review Queue\?/);
  // Plain introduction: what PRISMA is, then share → review → find and present.
  assert.match(poc, /demos, prototypes and products.*1 · <\/span>Share.*2 · <\/span>Review.*3 · <\/span>Find &amp; present/s);
  // Suggestions exist only in the connected app: who sees them, why they stay pending, who marks them, what Addressed means.
  assert.match(connected, /Change Requests &amp; Suggestions.*<h3[^>]*>Change Requests<\/h3>.*cannot be published until they are resolved.*<h3[^>]*>Suggestions<\/h3>.*Suggest an Improvement.*visible only to the solution owner, contributors, and Librarians.*until the owner marks them as <b>Addressed<\/b>.*Suggestions are optional/s);
  assert.match(connected, /Why does My submissions keep showing &quot;pending&quot;\?/);
  assert.doesNotMatch(poc, /Change Requests &amp; Suggestions|Addressed/);
  // Librarian guidance only for librarians in the connected app.
  const contributor = render(HelpView, { connected: true, librarian: false });
  assert.doesNotMatch(contributor, /Review and Curate|Edit Solution/);
  // The hash belongs to the router: shortcuts are buttons, never in-page anchors.
  assert.doesNotMatch(connected, /href="#/);
  // Contact appears only when the connected app passes it: a shortcut at the top and a card with Teams and email.
  assert.doesNotMatch(poc + connected, /Questions or something looks wrong|Questions or Issues/);
  const contact = render(HelpView, { connected: true, contact: { teams: "https://teams.microsoft.com/l/chat/0/0?users=a", email: "mailto:a@example.com?subject=PRISMA" } });
  assert.match(contact, /<button[^>]*>.*Questions or something looks wrong\? Contact us<\/button>.*Common questions.*id="help-contact".*Questions or Issues\?.*Reach out to our support team/s);
  assert.match(contact, /href="https:\/\/teams\.microsoft\.com\/l\/chat\/0\/0\?users=a" target="_blank" rel="noopener noreferrer"[^>]*>.*Chat in Teams/s);
  assert.match(contact, /href="mailto:a@example\.com\?subject=PRISMA"[^>]*>.*Email us/s);
});
test("present mode offers the same Refine filters behind a Filters button, without the library toolbar", async () => {
  const { LibraryView } = await server.ssrLoadModule("/src/views/LibraryView.tsx");
  const { SOLUTIONS } = await server.ssrLoadModule("/src/data/solutions.ts");
  const { EMPTY_FILTERS } = await server.ssrLoadModule("/src/lib/search.ts");
  const html = render(LibraryView, { catalogue: SOLUTIONS, filters: EMPTY_FILTERS, onFilters: noop, present: true });
  // Closed by default (minimal chrome): a Filters control opens the rail, which is not rendered yet.
  assert.match(html, /aria-label="Filter by capability, technology &amp; more"[^>]*>.*Filter by capability, technology &amp; more/s);
  assert.doesNotMatch(html, /aria-label="Refine solutions"/);
  // Sort, the added window, the layout toggle and the library heading stay out of present mode.
  assert.doesNotMatch(html, /Sort solutions|Added within|aria-label="Layout"|Nextant · Solution Library/);
  assert.match(html, /aria-label="Filter by specialization area"/);
  // Active filters still show as removable chips.
  const capability = SOLUTIONS[0].capabilities[0];
  assert.match(render(LibraryView, { catalogue: SOLUTIONS, filters: { ...EMPTY_FILTERS, capabilities: [capability] }, onFilters: noop, present: true }), /aria-label="Active filters"/);
});

test("library area filter is editorial text: plain options with colour dots, a tint only on the chosen one", async () => {
  const { LibraryView } = await server.ssrLoadModule("/src/views/LibraryView.tsx");
  const { SOLUTIONS } = await server.ssrLoadModule("/src/data/solutions.ts");
  const { EMPTY_FILTERS } = await server.ssrLoadModule("/src/lib/search.ts");
  const html = render(LibraryView, { catalogue: SOLUTIONS, filters: EMPTY_FILTERS, onFilters: noop, present: false });
  const row = html.match(/<div role="group" aria-label="Filter by specialization area".*?<\/div>/s)?.[0] ?? "";
  assert.match(row, /aria-pressed="true" class="area-filter[^"]*">All areas<span[^>]*>\d+<\/span>.*aria-pressed="false" class="area-filter/s);
  assert.doesNotMatch(html, /Explore by area|specialization areas<\/span>/i);
  // Each area has its own colour dot (never "All areas"), no glass or icons.
  assert.equal((row.match(/size-\[7px\] shrink-0 rounded-full/g) ?? []).length, 3);
  assert.doesNotMatch(row, /glass|<svg/);
});
test("review queue tab shows the pending count in amber, only when there is one", () => {
  const user = { fullName: "Ana Gómez", userPrincipalName: "ana@nextant.com", live: true };
  const props = { user, theme: "dark", onToggleTheme: noop, present: false, onTogglePresent: noop, favoriteCount: 3, reviewAvailable: true };
  assert.match(render(masthead.Masthead, { ...props, reviewCount: 5 }), /Review queue<span class="section-nav-count section-nav-count--pending" aria-label="5 awaiting review">5<\/span><span aria-hidden="true" class="hover-hint-text">5 submissions awaiting review<\/span>/);
  assert.doesNotMatch(render(masthead.Masthead, { ...props, reviewCount: 0 }), /awaiting review/);
  assert.doesNotMatch(render(masthead.Masthead, props), /awaiting review/);
});
test("open feedback: items counted one by one on cards, tabs and the My submissions tab; suggestions checked off, returned drafts resolved by resubmitting", async () => {
  const { MySubmissionsView } = await server.ssrLoadModule("/src/views/MySubmissionsView.tsx");
  const base = { summary: "Summary", specializationArea: "ai", status: "Working prototype", contributors: [], capabilities: [], technologies: [], industries: [], assets: [] };
  const entries = [
    { solution: { ...base, id: "returned", name: "Returned one", publicationStatus: "Draft", reviewOutcome: "Changes requested", reviewComments: "Blur the client logo." } },
    { solution: { ...base, id: "live", name: "Live one", publicationStatus: "Published", reviewOutcome: "Approved" } },
  ];
  const suggestions = { live: { count: 2, authors: ["Ana"], ids: ["a", "b"] } };
  const html = render(MySubmissionsView, { entries, connected: true, suggestions });
  // "Needs your attention" counts solutions, with the items as a breakdown, then one row per solution:
  // the returned draft first (amber, View feedback), then the suggestions (Open), all above "All my solutions".
  assert.match(html, /class="attention-panel[^"]*">.*Needs your attention<span class="section-nav-count section-nav-count--changes" aria-label="2 solutions">2<\/span>.*1 changes requested.*2 pending suggestions/s);
  assert.match(html, /attention-row attention-row--changes.*Returned one.*Changes requested by the librarian.*Review changes for Returned one">Review changes<.*attention-row ".*Live one.*2 pending suggestions from colleagues.*View suggestions for Live one">View suggestions<.*All my solutions/s);
  assert.equal((html.match(/<li /g) ?? []).length, 2);
  // It can fold to its summary line: Hide, expanded by default.
  assert.match(html, /aria-expanded="true"[^>]*>Hide/);
  // The breakdown counts are filters of the attention rows only, both off by default.
  assert.match(html, /aria-label="Show in Needs your attention".*aria-pressed="false"[^>]*>1 changes requested<.*aria-pressed="false"[^>]*>2 pending suggestions</s);
  // "Suggestions" keeps every solution that ever had one, with a blue dot while any is new; no suggestions, no chip.
  assert.match(html, /aria-pressed="false"[^>]*><span aria-hidden="true" class="inline-flex" style="color:var\(--accent\)"><svg.*?<\/svg><\/span>Has suggestions<span[^>]*>1<\/span>/);
  assert.doesNotMatch(render(MySubmissionsView, { entries, connected: true }), /Has suggestions/);
  // All addressed: still counted (history), but no dot.
  const addressed = render(MySubmissionsView, { entries: [entries[1]], connected: true, suggestions: { live: { count: 2, authors: [], ids: [] } } });
  assert.match(addressed, /aria-pressed="false"[^>]*><span aria-hidden="true" class="inline-flex"[^>]*><svg.*?<\/svg><\/span>Has suggestions<span[^>]*>1<\/span>/);
  // Sorted by the last change by default, beside the layout toggle.
  assert.match(html, /aria-label="Sort my solutions".*Sort by.*Recently updated.*aria-label="Layout"/s);
  assert.equal((html.match(/card-unread/g) ?? []).length, 2);
  // The cards say the same: the returned draft's band reads Changes requested (no extra pill), the other "N new suggestions".
  assert.equal((html.match(/card-action/g) ?? []).length, 1);
  assert.match(html, /Changes requested.*new-feedback.*2 pending suggestions/s);
  assert.doesNotMatch(html, /Action needed/);
  // Nothing open: no attention list at all.
  assert.doesNotMatch(render(MySubmissionsView, { entries: [entries[1]], connected: true, suggestions: { live: { count: 0, authors: [], ids: [] } } }), /attention-panel/);
  // The masthead counts open items on My submissions, like Saved solutions and Review queue.
  const seen = await server.ssrLoadModule("/src/lib/feedbackSeen.ts");
  const user = { fullName: "Ana Gómez", userPrincipalName: "ana@nextant.com", live: true };
  const mastheadProps = { user, theme: "dark", onToggleTheme: noop, present: false, onTogglePresent: noop, favoriteCount: 0, reviewAvailable: false };
  // Counted by solution: a returned draft and a solution with two suggestions make 2, not 3.
  seen.setFeedbackItems([seen.feedbackKeys(entries[0].solution), seen.feedbackKeys(entries[1].solution, ["a", "b"])]);
  // One of them was returned: the count takes the amber of Changes requested and explains the split.
  assert.match(render(masthead.Masthead, mastheadProps), /My submissions<span class="section-nav-count section-nav-count--changes" aria-label="2 solutions need your attention: 1 Changes requested, 1 Pending suggestions">2<\/span>.*class="hover-hint-text">1 Changes requested, 1 Pending suggestions<\/span>/s);
  // Only suggestions: blue.
  seen.setFeedbackItems([seen.feedbackKeys(entries[1].solution, ["a", "b"])]);
  assert.match(render(masthead.Masthead, mastheadProps), /section-nav-count section-nav-count--open" aria-label="1 solution needs your attention: 1 Pending suggestions">1<\/span>.*class="hover-hint-text">1 Pending suggestions<\/span>/s);
  seen.setFeedbackItems([]);
  assert.doesNotMatch(render(masthead.Masthead, mastheadProps), /section-nav-count--open/);
  // The librarian's comment has no check: it stays open until the owner resubmits.
  const { FeedbackPanel } = await server.ssrLoadModule("/src/components/FeedbackPanel.tsx");
  assert.doesNotMatch(render(FeedbackPanel, { name: "Returned one", feedback: "Blur the client logo.", onClose: noop, onEdit: noop }), /Mark as addressed/);
});
test("demo viewer: one 16:9 stage for every type, Open in new tab when offered, and a focused page for that tab", async () => {
  const { ViewerFrame } = await server.ssrLoadModule("/src/components/ViewerFrame.tsx");
  const html = render(ViewerFrame, { name: "Invoice matcher", kind: "Video walkthrough", onClose: noop, newTabUrl: "https://apps.powerapps.com/play/x?route=%2Fs%2Fa%2Fdemo%2Fb%3Ffocus%3D1", children: "DEMO" });
  assert.match(html, /viewer-fit[^"]*">.*viewer-stage viewer-stage--169.*DEMO/s);
  assert.match(html, /href="https:\/\/apps\.powerapps\.com\/play\/x[^"]*" target="_blank" rel="noopener noreferrer"[^>]*>.*Open in new tab/s);
  assert.doesNotMatch(render(ViewerFrame, { name: "N", onClose: noop, children: "D" }), /Open in new tab/);
  assert.match(render(ViewerFrame, { name: "N", onClose: noop, focused: true, children: "D" }), /h-dvh/);
  // The solution page lists the same option beside each viewer demo; the main action stays the in-app viewer.
  const { DetailView } = await server.ssrLoadModule("/src/views/DetailView.tsx");
  const solution = { id: "s", name: "S", summary: "Sum", whatItDoes: "Does", businessValue: "Value", specializationArea: "ai", specializationAreas: ["ai"], status: "Working prototype", publicationStatus: "Published", capabilities: [], technologies: [], industries: [], clientRoles: [], contributors: [], assets: [{ id: "v", name: "Walkthrough", assetType: "Video walkthrough only", sortOrder: 1 }] };
  const detail = render(DetailView, { solution, present: false, connected: true, onAssetOpen: noop, assetNewTabUrl: () => "https://example.test/tab" });
  assert.match(detail, /aria-label="Open Walkthrough in a new tab"[^>]*>.*Play walkthrough/s);
});