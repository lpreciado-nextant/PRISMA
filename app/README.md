# PRISMA — Nextant Solution Library code app PoC

**Status:** Connected PRISMA pilot hosted fonts/images and approved CSP video/worker capabilities verified; full hosted lifecycle and non-admin acceptance remain open.
**Last updated:** 2026-09-22

A look-and-feel proof of concept for [PRISMA](../docs/design/end-to-end-design.md), Nextant's internal solution library, built as a **Power Apps code app**: React 19 + TypeScript + Vite + Tailwind v4, scaffolded from the official `microsoft/PowerAppsCodeApps/templates/vite` template.

The point of this PoC is the **experience**, not the data. Everything renders from an in-memory mock catalogue shaped exactly like the Dataverse schema, so the data layer can be swapped for generated Power Platform services without touching the UI.

---

## What it demonstrates

| Design requirement | Where |
|---|---|
| Hero discovery flow — search, area tabs, faceted rail with live counts | `src/views/LibraryView.tsx` |
| Client-side search across name, summary, body, tags and keywords | `src/lib/search.ts` |
| Filter state encoded in the URL so a view is pasteable | `src/lib/router.ts` |
| Zero-result state that suggests relaxing the narrowest facet | `src/views/LibraryView.tsx` |
| Solution detail as a CSM briefing document | `src/views/DetailView.tsx` |
| Maturity-based effort: direct hours for ideas/prototypes; US calendar calculation for demos/production | `src/views/SubmitView.tsx`, `src/views/DetailView.tsx`, `src/lib/effort.ts` |
| Searchable Person field by name/email, keyboard selection and duplicate prevention | `src/views/SubmitView.tsx` |
| Captioned screenshot gallery (`nx_solutionimage`) on the detail page | `src/views/DetailView.tsx` |
| Six-step safety-first form, required detail images, optional thumbnail and local media | `src/views/SubmitView.tsx` |
| My submissions, inspection, editing and confirmed owner-only deletion; no welcome page | `src/views/MySubmissionsView.tsx`, `src/App.tsx` |
| Browser-persisted drafts/media and publish/return lifecycle | `src/lib/submissions.ts` |
| Librarian queue, inspection, required return comments and explicit approval | `src/views/ReviewView.tsx` |
| Searchable tag pickers with case-insensitive technology deduplication | `src/views/SubmitView.tsx` |
| Type-dependent asset behaviour (viewer / pop-out / download / request) | `src/views/DetailView.tsx` |
| Self-contained HTML rendered in a sandbox with no same-origin access | `src/views/ViewerView.tsx` |
| Present mode — catalogue restriction, redaction, suppressed internal notes | `src/App.tsx` |
| Liquid-glass design system, light and dark, reduced-motion aware | `src/index.css` |

Present mode **restricts the catalogue** rather than hiding rows: the source list is filtered before render, which is the client-side mirror of the server-side Dataverse filter the real app will issue.

Eligibility requires Published, Safety Acknowledged and librarian-controlled Client Safe Reviewed. Client identity, projects and notes are removed from the present-mode catalogue before search/render; only separately authored anonymous context is shown. Acknowledgment replaces the old sharing/sample-data fields but never grants approval.

**Save draft & close** stores incomplete submissions and media in browser-local IndexedDB. Saved drafts reopen from **My submissions**, including after reload. Submitting moves them to Pending review. The **Review queue** (`#/review`) supports inspection, approval/publication and return-to-Draft with required comments. Feedback appears in My submissions and the editor. Saving edits to a published record withdraws it until re-approved. Published local records join the mock catalogue and remain subject to present-mode safety filtering.

My submissions shows publication/review status inside each card and allows deletion of owned records in any publication state after confirmation. Deletion checks ownership inside the IndexedDB transaction and removes the record and embedded media before updating the UI; published records also leave the library. Failures keep the card and show an error for retry. This is browser-local PoC behavior, not Dataverse authorization or a production deletion policy.

Dedicated `reviewOutcome` and `reviewComments` (4000 characters) hold the latest librarian decision, separate from Library Notes. Contributor saves preserve them but always clear current approval; present mode strips both. Returning clears acknowledgment so resubmission requires a fresh confirmation. Submit and approve both validate identity, exactly one capability, effort, safety, anonymous context and required images. Draft saves require an authored, nonblank solution name of at most 100 characters; other fields can remain incomplete. Legacy `Untitled solution` drafts reopen as an empty input and must be named before saving again. Temporary session text backups remain separate from saved drafts.

Older browser submissions with the `changesRequested` envelope key are migrated on load: copy identifiable legacy feedback without deleting original Library Notes, preserve media/identity and write the normalized shape at the next explicit save. This is not a Dataverse migration. Production nullable columns, owner mapping, controlled transitions and concurrency are specified in [SchemaV2](../docs/data_model/SchemaV2.md#draft-and-transition-contract) and [ADR-0008](../docs/architecture/decisions/adr-0008-controlled-submission-transitions.md), not implemented as services here. The existing 2026 mock calendar and broader legacy catalogue mappings remain separate alignment work.

All saves are confined to this origin/browser profile, are subject to quota and eviction, and disappear if site data is cleared. Save failures leave changes open; no Dataverse writes or notifications occur. Review access is simulated, not authorization. Use non-sensitive test data only. Unsaved text has a temporary tab backup; unsaved media remains in memory. New attachments support images, HTML, MP4/WebM video and PDF/PPT/PPTX documents; existing catalogue URL formats remain readable but cannot be newly submitted. See [media rules and local limits](../docs/workflows/demo-assets.md).

---

## Code app compatibility

Everything here stays inside what the [code apps documentation](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/) supports.

- **Single-page app.** Code apps support SPAs; this is one.
- **Official Vite plugin.** `@microsoft/power-apps-vite/plugin` is registered in `vite.config.ts` alongside React and Tailwind. Tailwind is a build-time plugin only — it emits plain CSS.
- **Hash routing, not path routing.** A published app is served from `/play/e/{environmentId}/a/{appId}`, so the app never owns the path segment. All navigation goes through `window.location.hash`.
- **No `initialize()`.** The client library is v1.0+. The PoC wraps `getContext()` so it renders outside the host; the connected target requires host identity and uses generated SDK data services.
- **No server-side code.** No API routes, no SSR, no build-time secrets.
- **Relative asset references.** `./nextant-mark.svg` rather than `/nextant-mark.svg`, so assets resolve under the published base path.
- **Nothing sensitive in the bundle.** Compiled assets are served from a public endpoint; all real data will come from Dataverse after authentication.

The PoC still loads fonts from Google Fonts. The connected target bundles the same Schibsted Grotesk, Source Sans 3 and IBM Plex Mono families through Fontsource, using relative asset URLs and including their license notices. The published host allows only same-origin fonts/styles; Google Fonts requests are blocked there.

Not used, because code apps don't support them: Power BI `PowerBIIntegration`, SharePoint form integration, Power Platform Git integration.

---

## Running it

From the repo root, double-click `run-poc.bat` — it installs dependencies if needed, builds, and serves the production bundle at `http://localhost:4173/`. Or by hand:

```powershell
cd app
npm install
npm run dev          # design preview at http://localhost:5173
npm test             # Node 22.6+; business-calendar calculations, mock data and builder search
npm run test:ui      # shared form/media/review rendering and adapter-wiring checks
npm run build        # TypeScript + production bundle
npm run lint
```

## Submission presentation

Open [the interactive submission walkthrough](../presentation/submission.html) directly in a browser; no server is required. Six chapters pair the real form with explanations. The editable BSO Quota example includes 218 direct hours and sample gallery images. A blank-start option, themes and simulated handoff remain. Chapter navigation does not bypass the required safety acknowledgment; Continue and Submit retain validation.

The presentation imports `SubmitView`, `SolutionCard`, the people picker, effort calculations, icons and design tokens from the PoC rather than maintaining copies. Its draft uses a separate session-storage key, leaving the PoC draft untouched. Images remain in memory only. No submission, notification or publication reaches Dataverse.

Rebuild the standalone HTML after changing its source or shared components:

```powershell
cd app
npm run build:presentation
```

The entry point is `src/presentation/SubmissionPresentation.tsx`; `scripts/build-submission.mjs` bundles JavaScript, CSS and the logo into the HTML. Fonts retain the PoC's Google Fonts dependency and use fallback fonts offline. This local build does not publish or alter the deployed Power Apps app.

## Contributor effort

The current [schema](../docs/data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort) uses contributor rows. Ideas/prototypes take direct hours (finite, nonnegative, at most two decimals). Demos/production use inclusive dates, allocation (0-100%) and the US calendar: business days excluding holidays × 8 × allocation / 100, rounded per person, then summed. Changing maturity retains draft values but only validates/totals the active mode. Calendar hours are capacity, direct hours are reported effort; neither is deployment duration.

The submission form adds/removes contributors, saves inputs in the session draft, validates calendar coverage and previews totals. Its Person field searches the mock people list by name or email, excludes already assigned people and supports arrow keys/Enter or pointer selection. Escape or leaving the field restores the committed selection; unmatched search text is never stored as a person. This is not a live directory integration. Catalogue search includes every builder. Detail shows a person-by-person breakdown internally; present mode keeps builder names and total hours but omits dates/allocation/calendar details.

Calendar-mode contributors use **US business calendar (2026)** automatically, without a dropdown: Monday-Friday excluding the eleven [OPM observed federal holidays](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/#url=2026). Coverage is January 1-December 31, 2026. Direct-mode contributors need no dates or calendar. Mock idea/prototype totals were preserved as direct hours; production migration needs explicit confirmation, reviewed calendars and server-enforced validation ([ADR-0007](../docs/architecture/decisions/adr-0007-contributor-effort.md)). No Dataverse tables were created; the current PoC deployment is recorded below.

## PoC deployment

**[Open PRISMA PoC](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/69a956d5-2180-4ad6-9136-136c48cc197f?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898)**

Updated on 2026-09-21 in **Nextant Pulse** (not Nextant Pulse Prod) with browser-local draft/media persistence, My submissions editing, librarian approval/return UI, dedicated review outcome/comments, legacy draft migration and submit/approval validation. The latest upload also includes the shared themed review dropdown, draft-save button in the card footer, required authored draft names, in-card submission status and confirmed owner-only deletion. The production build, all 16 tests, lint and `npx pa app push` succeeded. App name, app ID and environment ID were verified and left unchanged.

The returned hosted link redirected to Microsoft sign-in in the verification browser. Upload success is confirmed; an authenticated hosted smoke test of search, detail, viewer, present mode, draft/review controls and image/font loading remains pending. Saved submissions and media survive reload only in the same hosted browser origin/profile; localhost drafts do not transfer. No Dataverse persistence, production review authorization, Custom APIs or plug-ins were deployed. The librarian workspace remains a simulated PoC surface.

| Setting | Value |
|---|---|
| Display name | PRISMA PoC |
| Environment name | Nextant Pulse |
| Environment ID | `ce09ad9b-57d1-e5df-9400-8ce973c86213` |
| Power Platform solution | `PRISMA_Dev` |
| App ID | `69a956d5-2180-4ad6-9136-136c48cc197f` |
| Build output / entry point | `dist` / `index.html` |

In [Power Apps](https://make.powerapps.com), select **Nextant Pulse** (not Nextant Pulse Prod), then **Solutions > PRISMA_Dev** to open the existing solution. `PRISMA_Dev` is the Power Platform solution name, not the code app display name. PAC inspection on 2026-09-21 confirmed that PRISMA PoC is included in this unmanaged solution; see the [verified inventory](../docs/architecture/technical-architecture.md#verified-solution-inventory).

The existing [power.config.json](power.config.json) targets this deployment. Do not run `pa app init` again to update it.

### Publish updates

Run from `app/`, signed in with an account that can edit the deployed app:

```powershell
npm install
npx pa auth login
npm run build
npx pa app push
```

Only push after the build succeeds. The project includes the Power Apps CLI as a development dependency, so `npx pa` uses the installed project version.

To test in the Power Apps local host, run `npx pa app run` and open the **Local Play** URL in your Power Platform browser profile. Allow local-network access if prompted.

### Access and sharing

Code apps must be enabled on the environment (Power Platform admin center → Environments → Settings → Product → Features). End users need a Power Apps Premium licence and access to the app.

In [Power Apps](https://make.powerapps.com), select the environment above, then **Apps → PRISMA PoC → Share** to grant colleagues access.

This is still a mock-data PoC: publishing does not add Dataverse persistence or production data security. Compiled assets are publicly retrievable, so keep bundled catalogue data non-sensitive; present mode is not a security boundary for that data.

Optionally hide the Power Apps chrome, which suits present mode:

```powershell
npx pa app set-setting --show-header false
npx pa app push
```

The setting takes effect in the hosted app after publishing. See the [Microsoft quickstart](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/create-an-app-from-scratch) for initializing a separate deployment.

## Connected PRISMA target

### Pilot deployment (2026-09-22)

**[Open connected PRISMA](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898)**

Published to **Nextant Pulse**, in **PRISMA_Dev** (`adddc940-98ff-4b2f-9c8a-e89245c2fc33`), as the separate **PRISMA** app (`cffbecd7-c927-474e-b6ed-6c7957ec74cb`). The user explicitly authorized a pilot-only upload with outstanding acceptance gates deferred and confirmed the GPL distribution review was cleared for this deployment. This is not general-release acceptance. The environment's hosted banner identifies it as a Developer environment for development/test use.

The connected production build, 51 connected tests, 12 shared UI checks and lint passed. The CLI confirmed upload and solution addition; its generated app ID is retained in [connected/power.config.json](connected/power.config.json). The PoC app/configuration, backend, sharing and permissions were unchanged.

Authenticated hosted checks loaded the empty published catalogue, both existing owned drafts, the empty authorized librarian queue, and the empty cleared catalogue in present mode. Relative logos loaded. Checks used dispatched activation after an integrated-browser pointer click did not activate; they do not establish full pointer acceptance. No business records were changed. Published detail/viewer and packaged video preparation/playback remain unverified.

**Font/image fix published and verified (2026-09-22):** the initial upload's Google Fonts and protected thumbnail failures are resolved. The connected bundle now includes the original font families and license notices. Protected thumbnails, gallery images and full image previews retain authenticated Dataverse retrieval, then use bounded in-memory PNG/JPEG `data:` URLs; unsupported MIME types and images over 20 MiB are rejected by the display helper (the existing 5 MiB upload limit is unchanged). No persistent image cache or public image endpoint was added. Canceled results are ignored and changing the image item cannot display the previous item's URL.

The update passed 52 connected tests, 12 shared UI checks, build and lint, then uploaded to the same app ID with approval. Hosted verification loaded all three font families from the app origin, decoded both initial draft thumbnails at 1187 x 651, and opened the saved gallery JPEG in the full image viewer at 420 x 420 using `data:`. At a 390px browser viewport, app content fit the mobile iframe and the loaded thumbnail decoded. Checks were read-only and used dispatched activation. A normal reload initially retained the older package; opening the CLI-returned URL with its `sourcetime` loaded the new package.

**Hosted media policy resolved (2026-09-22):** with explicit approval for its environment-wide scope, the admin-center code-app CSP gained only `media-src blob:`, `worker-src 'self'`, `connect-src 'self'` and `script-src 'wasm-unsafe-eval'`. Enforcement remains On; reporting and all other directives are unchanged. Saved settings and PRISMA's response header were independently verified. This affects all code apps in Nextant Pulse, including the PoC, but not Nextant Pulse Prod. No app/backend republish, user/role change or Dataverse write was required. See [configuration and rollback](../docs/architecture/security-model.md#code-app-hosting-policy).

The already-published encoder compressed a local short fixture from 55,704 to 52,413 bytes in 27.6 seconds. Hosted Blob decoding/seeking, progressive 1080p buffering/forward-backward seeking and caption tracks passed. These checks used local fixture bytes inside the real hosted app, not an end-to-end Dataverse upload/review run. The hidden integrated browser paused continuous playback; audible output, continuous playback, OS downloads and effective non-admin/cross-account access remain unverified. Full evidence: [hosted media compatibility](../docs/workflows/demo-assets.md#published-host-compatibility).

For subsequent updates, build from `app/`, then push from `app/connected/`; preserve the saved app ID and do not initialize another app:

```powershell
npm run build:connected
cd connected
../node_modules/.bin/pa.cmd app push --solution-id adddc940-98ff-4b2f-9c8a-e89245c2fc33
```

The acceptance notes below describe earlier, pre-publication work; this deployment record supersedes their unpublished status.

### Implementation and acceptance history

The [same-account acceptance pass](../docs/workflows/demo-assets.md#same-account-video-acceptance) verifies actual wizard pause/reopen/resume, wrong-file rejection, lost committed responses, Local Play compression/prepared-byte recovery, selectable MP4 text captions, fullscreen and player shutdown after withdrawal. Isolated Edge tests cover MP4/AAC, WebM/Opus, checksum-exact local downloads and full 500 MiB progressive parsing/playback. These do not establish non-admin authorization, audible output or authenticated OS download delivery. No code app was published.

Connected videos now use SHA-256-bound uploads with explicit pause/reopen/reselect resume within the existing two-hour deadline. Regular MP4 previews use protected Dataverse ranges and bounded MediaSource buffering; unsupported formats/tracks offer full-file playback. Privileged browser testing resumed a 48.9 MB file and decoded its first frame after 2 MiB in 2.9s, with forward/backward seeking verified. This is not full codec or non-admin acceptance. Three new APIs and one private digest column were deployed with approval; no app was published. See [transfer behavior, fixture cleanup and remaining gates](../docs/workflows/demo-assets.md#protected-playback-and-resume).
Both runnable apps prepare MP4/WebM videos of 200-500 MiB with a lazy local WASM encoder. Smaller videos are unchanged; larger outputs keep the original; failure offers Use original/Cancel. Originals are not modified. Local Play worker loading and prepared-byte resume passed with a short threshold-sized clip. A full five-minute 500 MiB production-browser encode became 24.1 MiB in **24m13s**, retaining 1080p/300s and decoding successfully. This long preparation time is a usability caveat, not an upload-speed guarantee. The self-contained walkthrough excludes the encoder. Packaged-host and lower-memory-device tests remain open; the 32.2 MB lazy core requires GPL distribution review before publication. See [automatic preparation and release gates](../docs/workflows/demo-assets.md#automatic-video-preparation).

Native compression benchmark tooling is available in [scripts/benchmark-video.mjs](scripts/benchmark-video.mjs). Its synthetic 50/500 MiB samples became 10.1/50.7 MiB at 24.4s/125.5s encoding cost; these are not browser-encoder performance or real-screen quality claims. The earlier direct Dataverse fetch failed CORS; protected streaming now uses the approved range API instead. Integrated-browser audio issues retain an explicit full-download fallback. See [benchmark results and limitations](../docs/workflows/demo-assets.md#compression-and-progressive-playback-feasibility).

New uploads negotiate sequential 4 MiB blocks when advertised, preserving 2 MiB and legacy 512 KiB sessions. The user-approved backend update is deployed. Paired 50 MiB browser-SDK uploads took 44.4s at 2 MiB and 35.2s at 4 MiB; 500 MiB took 5m59s (125 blocks), versus the earlier 7m26s at 2 MiB. Both files persisted and matched source checksums. Aggregate upload timings stay in module memory; encoding was under 4% of elapsed time, so read-ahead was deferred. Resume was added subsequently for new SHA-bound videos. Selecting a video also shows an ephemeral, explicitly local preview before upload finishes, with object-URL cleanup and no persistent cache. This is separate from upload confirmation and saved-video streaming. No connected code app was published, and benchmark drafts/files were deleted.

The attachment File column now supports 512,000 KB (500 MiB), matching the application's video allowance. The former 32 MiB limit rejected both samples before staging. Both now upload, finalize, reopen and return exact SHA-256 hashes. Both MP4s played at 1920x1080 with pause/resume and seeking verified. The 500 MiB preview took 144 seconds to download the full file before playback; seeking near the end reached the ended event at 300 seconds. This is not progressive streaming or uninterrupted full-duration acceptance. The larger upload previously took about 13 minutes. Disposable drafts/files were removed, preserving existing user submissions. Reopen an editor locked by an earlier unconfirmed upload before retrying. See [large-video evidence and limits](../docs/workflows/demo-assets.md#large-video-verification).

The connected contributor picker uses `statecode eq 0 and cr6b0_employeestatus eq true`, following the user-selected **Employee Status = Active** definition. `cr6b0_vactive` is not the selected rule. Returned records must also have those exact active values before becoming picker options or signed-in defaults. Live verification on 2026-09-22 returned 173 choices instead of 417 generic-active rows. Existing contributors outside that list remain identified as inactive/unavailable until explicitly replaced; historical credit is not erased. This is a picker restriction, not a new backend employment-status authorization rule. No consultant records or backend permissions were changed.

The separate [connected/power.config.json](connected/power.config.json) targets **PRISMA** in the same Nextant Pulse environment, with app ID `cffbecd7-c927-474e-b6ed-6c7957ec74cb`, local URL `http://localhost:5174`, and its own `connected/dist` output. The [connected entry point](connected/src/ConnectedApp.tsx) is runnable locally and published for pilot testing as recorded above. Existing PoC commands, app ID, source entry point and persistence remain unchanged.

From `app/`:

```powershell
npm run dev:connected
npm run test:connected
npm run build:connected
```

Open the **Local Play** URL printed by Vite in your signed-in Power Apps browser. For the default port: [open connected PRISMA in Local Play](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/a/local?_localAppUrl=http://localhost:5174/&_localConnectionUrl=http://localhost:5174/__vite_powerapps_plugin__/power.config.json). Allow local-network access if prompted. If 5174 is occupied, Vite selects a free port; use its printed URL. Opening localhost directly shows the sign-in-required state, not mock data.

The current read slice queries published Solution records plus specialization, capability and related technology/industry tags. It uses the generated SDK services, explicit column projections, numeric choice mappings, GUID lookups, paged reads and native N:N OData filters. The live specialization names `ai`, `data`, and `ibo` were verified through PAC. Missing permissions, malformed mappings and failed requests are errors, not an empty catalogue. An actual empty result has a separate empty-catalogue state.

Search, facets and cards reuse the PoC views; connected detail/viewer uses caller-authorized contributor, project and finalized-media reads. The masthead and My submissions expose review navigation only when the server reports the explicit Librarian role. Returning to the library refreshes catalogue state. Routes never reach PoC write views. The build rejects mock catalogue, IndexedDB adapter, PoC entry-point and demo-document imports. Shared metadata lives in [src/data/catalogueMetadata.ts](src/data/catalogueMetadata.ts).

Connected submission and the PoC now use shared safety, identity, story, contributor-row, media, review-summary, footer and success components from [SubmissionForm](src/components/SubmissionForm.tsx), extracted from the PoC baseline. Both targets also share [TagPicker](src/components/TagPicker.tsx) and the queue plus review-action panel in [ReviewQueue](src/components/ReviewQueue.tsx). One wizard state coordinates core/graph saves; media keeps its protected upload adapter behind the shared stacked layout, caption tiles and file controls. Live effort previews use the backend's 2020-2035 observed US federal holiday policy, with server-calculated totals authoritative at final review. My submissions reuses the PoC card grid and hydrates saved technology chips; owner/reviewer/published detail reuses [DetailView](src/views/DetailView.tsx) and its gallery styling, and both viewers share [ViewerFrame](src/components/ViewerFrame.tsx) and asset-type labels. Document actions download directly through the protected SDK. Connected confirmations use [ConfirmDialog](src/components/ConfirmDialog.tsx), not native confirm boxes. No mock persistence is imported. Complete inheritance, including the remaining gaps, is a requirement: see the [UI/UX parity acceptance inventory](../docs/design/end-to-end-design.md#31-contribution--publication).

Parity checks: `npm run test:ui` renders shared controls and verifies adapter wiring using the existing Vite/React toolchain with an isolated temporary cache. Eight checks cover required field examples, contributor structure, media/linked-asset controls, locked wizard actions and independent review clearance. The current frontend suites contain 16 PoC, 34 connected and 8 UI checks. Both form contents fit mobile widths. Earlier local PoC image-upload automation stalled on `Image.decode()` in a hidden integrated-browser tab and is not counted as a pass; its temporary backup was removed. The connected protected upload path was subsequently verified live as described below. Continue checkpoints, safety reconfirmation and withdrawal remain truthful connected workflows rather than local success simulations.

**Integrated caption saving (2026-09-22):** captions remain in wizard memory across Back navigation and save with Save draft & close or Continue. Protected uploads/removals flush pending captions first. Each confirmed metadata version feeds the next core/graph save, preserves other media metadata and clears safety acknowledgment. Unconfirmed writes keep edits visible and require reopen, never blind retries. No separate Save captions action is needed. Captions are still excluded from tab-reload recovery. Local Play verified PNG and HTML upload, caption save/reopen, a simultaneous summary edit after Back, upload-time caption flush, Continue to final review, and stale-version rejection/reopen. Fixture `ce2e6482-85b6-f111-aaac-6045bd049fba` and its media were deleted through the controlled owner workflow; exactly three original drafts remain. These were privileged-owner tests, not librarian or least-privilege acceptance. No backend deployment, permission changes or app publication occurred.

**Connected persistence:** `#/submit` creates a draft; `#/my-submissions` lists every caller-owned state; `#/submission/:id` inspects/submits/withdraws; `#/submit?draft=<id>` edits owned Drafts. Core limits are name 100, summary/use case/client contexts 200, long descriptions 4000. Graph saves persist contributors/effort and native tags/projects. Media uses private server-held sessions and sequential chunks, with read-only finalized access. String versions prevent stale writes; uncertain responses require reopen rather than blind retries. No local-success fallback is used.

**URL storage repaired (2026-09-22):** later investigation confirmed an effective 100-character limit despite 4000-character metadata. An explicitly approved unchanged-definition reapply did not fix it; a separately approved guarded 4000 -> 3999 -> 4000 metadata change and Demo Asset table publication did. Existing URL values were checked before the change and never edited. Protected create/readback at 101 and 2000 characters, full original MyPortal URL (230 characters), and edit/reopen passed exactly; 2001 characters remains rejected by the application/API contract. All test records were removed, preserving the original three drafts. No app/plug-in upload or permission change occurred. The 39 connected and 42 backend tests pass; actual external new-tab launch remains unverified. This supersedes the URL-storage blocker in the historical eight-area summary below. See [repair evidence and guarded commands](../docs/architecture/technical-architecture.md#url-storage-repair).

**Eight-area acceptance (2026-09-22):** retirement/restoration, interrupted-upload removal, reload recovery, stale edits/approvals in two tabs and explicit share revocation passed using the current privileged account. PDF/PPTX/video byte checks passed, but actual OS download delivery and video playback could not be verified in the integrated browser. Twelve-record catalogue loading improved from 7,992ms to 1,518ms with four-record bounded hydration batches (same 39 requests); settled UI load was 1,943ms and filtering 26-28ms. Automated accessibility reported no violations on tested surfaces, with contrast/manual checks still open. Long-title clipping was fixed; video decode errors now show a download fallback. The real 163-character MyPortal URL failed Dataverse storage with `0x80090429` despite 4000-character published/editable metadata. No schema change was made. All 13 temporary records and local fixture assets were removed, preserving three originals. Full [results and limitations](../docs/workflows/contribution-and-review.md#eight-area-acceptance-pass) take precedence over earlier snapshots below. Current suites: 16 PoC, 38 connected, 9 UI and 41 backend tests.

**Functional lifecycle verified (2026-09-22):** a disposable solution passed submit, return with feedback, contributor revision, resubmit, approval, published search/detail/HTML viewer, present-mode redaction and withdrawal. All five solution/contributor/media Published Readers share masks changed from Read to zero; the published-detail API rejected the withdrawn record. The temporary solution and its child/session rows were deleted, leaving three original drafts. The user-approved backend fix validates linked-asset metadata during submit/approve instead of trying to download a nonexistent file; uploaded files retain stored-size checks. All 40 backend tests pass. Luis exercised both owner and explicitly assigned Librarian roles with System Administrator retained, so this is not separate-identity or least-privilege acceptance. See [full evidence and remaining gates](../docs/workflows/contribution-and-review.md#verified-lifecycle).

**Linked assets (2026-09-22):** connected Media also creates/edits hosted URLs, Power Apps, Power BI and desktop demo arrangements. The existing transition API's `asset` action validates HTTPS URLs, type, name, note, ownership, Draft state and exact version; no new schema/API registration is required. Links share the six-attachment limit, custodian ownership, review, sharing and removal lifecycle. Hosted apps can opt into opaque sandbox previews with pop-out; Power Apps/BI open externally; desktop entries show guidance without claiming request delivery. The user-approved plug-in update passed 39 backend tests and live privileged-owner create/edit/reopen/unsafe/stale/remove checks. Temporary fixture `c4fa1064-87b6-f111-aaac-6045bd049fba` was deleted, preserving three original drafts. The frontend suites now contain 16 PoC, 34 connected and 8 UI tests. External targets/rel were verified, but actual signed-in Power Apps/BI launch, linked publication/revocation and non-admin acceptance remain open. No code app was published or permissions/schema changed. See [media behavior](../docs/workflows/demo-assets.md) and [ADR-0009](../docs/architecture/decisions/adr-0009-mediated-media-and-publication-access.md).

`#/review` and `#/review/:id` use explicit PRISMA Librarian authorization for return/approval/retirement. Approval requires independent safety confirmation; publication grants read-only Solution/contributor/media shares to PRISMA Published Readers. Owner withdrawal returns to Draft and revokes published shares. Owner deletion in any state uses the displayed version and controlled child/media cleanup. Draft-only caption saves and inline technology creation/reuse use the same transition API. Protected thumbnails appear in cards, final preview and detail; contributor names enter search and authorized contact/provenance appears in internal detail. See [scope and parity](../docs/design/end-to-end-design.md#31-contribution--publication) for unverified gates, PoC asset stand-ins and future product controls.

User-approved recovery retains unsaved core text and contributor/tag/project selections in identity-scoped tab storage, not media bytes, captions or credentials. A backup cannot overwrite a changed server version; safety confirmation resets and uncertain writes require reopen. Successful save/submit, discard, present entry and detected identity/authentication loss clear recovery. External host sign-out is detected only on authentication failure or reload. This is not a local-save success fallback.

The [backend](../docs/architecture/technical-architecture.md#deployed-core-draft-backend) is deployed in PRISMA_Dev. On 2026-09-22 the user approved eight additive pilot role/profile/team associations for Juliana, Michael, Luis and Mauricio; all were applied and verified, with no existing privileges removed. Luis's Librarian queue now authorizes successfully. Mauricio is a Published Readers member; Media Custodian remains empty. See the [exact assignment inventory](../docs/architecture/security-model.md#approved-pilot-assignments). Juliana/Luis/Mauricio retain System Administrator, so these checks do not establish least-privilege access or revocation. Consultant/Project data/security and the published PoC are unchanged.

Present mode clears the prior catalogue immediately, starts a new server query requiring Published + Safety Acknowledged + Client Safe Reviewed, and omits internal client identity and search keywords from its projection. Notes and review fields are never selected. Unmounted requests cannot restore stale internal data. The UI authorizes no access: table/field/row protections remain platform work before release.

PAC generated live models/services for all 11 inventoried tables under [connected/src/generated/index.ts](connected/src/generated/index.ts), plus required metadata under `connected/.power/schemas/`. Keep both generated directories with this target; services import their schema configuration. Generation reads metadata, not business records, and does not create or modify Dataverse rows. Generated CRUD methods do not implement the authorization/transition guarantees in [ADR-0008](../docs/architecture/decisions/adr-0008-controlled-submission-transitions.md); do not wire direct status/review writes into the UI.

The verified non-interactive command, run from `app/connected/`, is:

```powershell
pac code add-data-source --apiId dataverse --table nx_solution --environment https://nextantpulse.crm.dynamics.com
```

Substitute another live logical table name only when adding an unregistered source. Do not run it in `app/`, which targets the mock PoC. The organization URL is not the `/api/data/v9.2` Web API endpoint. PAC 2.10.1 succeeded with the explicit URL; the earlier `pa` attempt rejected an advertised environment flag and then prompted for an organization URL without one.

Validation on 2026-09-22 includes 16 PoC, 34 connected, 8 rendered UI and 40 backend tests. The latest backend lifecycle fix passed its full suite and deployed with approval; earlier frontend builds/lint passed. Local Play checks cover core/graph/media persistence, linked assets, captions, owner transitions, reviewer return/approval, published presentation and explicit share revocation. Temporary fixtures were removed, retaining the three original drafts. Real non-admin access, separate-identity review, retirement, multi-record performance, external launches, document delivery and hosted acceptance remain open. Integrated browser checks used keyboard/dispatched activation; they are not a complete pointer-interaction sign-off. Neither app was published.

Generate Custom API clients from `app/connected/` with the installed CLI: `..\node_modules\.bin\pa.cmd app add dataverse-api --api-name nx_SaveCoreDraft` (or `nx_GetMyCoreDrafts`). Both generated services and `.power` schemas are required; do not hand-edit them. The installed CLI rejects its advertised environment flag; confirm the connected configuration and active environment before generation.

**Release gate:** full read/write, authorized review, permissions, revocation, concurrency and presentation must pass before general release. On 2026-09-22 the user explicitly authorized the pilot upload above with outstanding acceptance gates deferred; these checks are not marked passed or waived for general release. Michael's identity, pilot assignments and privileged functional lifecycle are resolved. Effective non-admin and cross-account tests, external/document delivery and full hosted acceptance remain required. Explicit share-mask revocation is not proof of effective denial for administrators. Hosted fonts, protected images and approved video/worker CSP capabilities now pass their scoped checks; full hosted media lifecycle and continuous playback remain unverified. Do not publish a placeholder, copy the PoC app ID or replace its mock data source.

---

## Not in the PoC

Deliberately out of scope so the demo shows only what the platform can actually do:

- Dataverse reads/writes, shared production persistence and notifications
- Production review authorization, revision diffs/history, demo-request writes, reference-data admin and optional AI writing assistance
- Status facets on the rail (capability / technology / industry are implemented)
- Permission-dependent media submission and access-request controls; some existing catalogue demos still use stand-ins
- Security roles and field-level security, which are platform configuration rather than app code
