# PRISMA — Nextant Solution Library code app PoC

**Status:** Mock PoC (published 2026-09-18) and connected PRISMA pilot (published, Blob media pilot enabled 2026-09-29) both live in Nextant Pulse. Privileged-account lifecycles verified; non-admin and separate-reviewer acceptance remain open. The bulk catalogue graph API, plug-in tracing and on-demand contributor screens were deployed and published on 2026-09-30, followed the same day by graph card thumbnails, shared detail reads and blur-only glass. Local media workbench, migration dry-run tooling and infrastructure templates are complete but are development tools, not production services.
**Last updated:** 2026-10-02

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
| My submissions workspace (status filters, Edit + ••• delete menu, librarian feedback panel), inspection, editing and confirmed owner-only deletion; no welcome page | `src/views/MySubmissionsView.tsx`, `src/App.tsx` |
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
- **Hash routing, not path routing.** A published app is served from `/play/e/{environmentId}/a/{appId}`, so the app never owns the path segment. All navigation goes through `window.location.hash`. The player frame hides that hash, so the connected app accepts deep links as a `route` query parameter on the play URL (read once from `getContext().app.queryParams`, validated against known routes in `connected/src/deepLink.ts`). Published detail pages offer **Copy link**. See [ADR-0003](../docs/architecture/decisions/adr-0003-hash-routing.md). On 2026-09-30, Local Play passed `route` through: a solution link opened its detail page after **Begin**, a `/?q=` link opened the filtered library, and an invalid route stayed on the library. Local Play reports app ID `local` and no `appUrl`, so **Copy link** is hidden there by design. Its host frame allows `clipboard-write`. The published host passed the same checks plus **Copy link** ([deployment record](#deep-links-and-copy-link-2026-09-30)).
- **No `initialize()`.** The client library is v1.0+. The PoC wraps `getContext()` so it renders outside the host; the connected target requires host identity and uses generated SDK data services.
- **No server-side code.** No API routes, no SSR, no build-time secrets.
- **Relative asset references.** `./nextant-mark.svg` rather than `/nextant-mark.svg`, so assets resolve under the published base path.
- **Nothing sensitive in the bundle.** Compiled assets are served from a public endpoint; all real data will come from Dataverse after authentication.

The PoC still loads fonts from Google Fonts. The connected target bundles the same Schibsted Grotesk, Source Sans 3 and IBM Plex Mono families through Fontsource, using relative asset URLs and including their license notices. The published host allows only same-origin fonts/styles; Google Fonts requests are blocked there.

The connected identity badge retrieves the signed-in user's Microsoft 365 photo through the generated Office 365 Users `UserPhoto_V2` service, using the UPN from Power Apps `getContext()`. The existing Nextant Pulse connection is configured only in `connected/`; users may need to authorize their own connection, subject to tenant policy. Photo loading never blocks authentication or the catalogue. Missing/denied/invalid photos, image decode errors and responses arriving after ten seconds retain initials. Only bounded JPEG/PNG data URLs are accepted, held in component memory with no persistent photo cache. Present mode does not request or render the photo. No direct Graph token handling, extra sign-in implementation or CSP change is required.

On 2026-09-22, Local Play retrieved the real signed-in user's 420x420 photo and rendered it in the existing 28x28 badge; an image-error event restored initials and reload restored the photo. Connector failure/invalid-response and present-mode markup tests pass. Published-host and other-user connection consent remain unverified until deployment; this change has not been uploaded.

Not used, because code apps don't support them: Power BI `PowerBIIntegration`, SharePoint form integration, Power Platform Git integration.

---

## Running it

From the repo root, double-click `run-poc.bat` — it installs dependencies if needed, builds, and serves the production bundle at `http://localhost:4173/`. Or by hand:

```powershell
cd app
npm install
npm run dev              # design preview at http://localhost:5173
npm run dev:connected    # connected target at http://localhost:5174 (open through Local Play)
npm test                 # Node 22.6+; business-calendar calculations, mock data and builder search
npm run test:connected   # connected catalogue, drafts, media transfer and favorites
npm run test:ui          # shared form/media/review rendering and adapter-wiring checks
npm run typecheck:tests  # tests run with type stripping only, so type-check them separately
npm run build            # TypeScript + production bundle
npm run build:connected
npm run lint             # includes jsx-a11y accessibility rules
```

CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs lint, the test type-check, the PoC/connected/UI/migration tests, both builds and the backend tests on every pull request. The local media workbench tests (`npm run test:media`) start Azurite and child processes and stay local.

## Local Blob media workbench

An isolated development slice for the [proposed Blob Storage transition](../docs/architecture/technical-architecture.md#azure-blob-storage-transition-plan). It uses the real Azure Blob SDK against a local Azurite process by default, or against the [Azure lab storage account](#azure-lab-storage), with SQLite-backed API state and a separate React workbench. The default Azurite mode needs no Azure subscription, credentials, Docker, Dataverse connection or Power Apps sign-in. Use Node 22.13+ (Node 24 recommended for built-in `node:sqlite`) and non-sensitive, known-safe MP4, HTML, PDF, PPT or PPTX fixtures only.

From `app/`, after installing dependencies:

```powershell
npm run dev:media      # http://127.0.0.1:5180/; selects another port if occupied
npm run test:media     # policy, lifecycle, HTTP guards, Azurite and cleanup recovery
npm run check:media    # isolated frontend TypeScript check
npm run lint
```

The default retained workspace is `%LOCALAPPDATA%/PRISMA/media-lab` on Windows, or `~/.local/share/PRISMA/media-lab` without `LOCALAPPDATA`. The launcher prints the exact directory and available UI port. To use a separate workspace, run `npm run dev:media -- --data-dir <local-directory>`. Keep it on a local, non-synchronized filesystem outside the repository and public app assets. Restart with the same directory to retain the catalogue; a different directory is a separate catalogue, not a migration.

The launcher starts both servers on `127.0.0.1`, with an available private emulator port and a freshly generated emulator-only account key that is never sent to the browser. The storage adapter refuses non-loopback endpoints. The API requires a matching loopback Host/Origin and an explicit local request header; these guards reduce accidental browser access, but **simulated identities are not authentication**. Never publish this API or expose either server to a network.

### Local workflow

1. As **Builder**, create a draft, choose an attachment and Upload. This slice supports one file per draft: MP4 up to 500 MiB, or HTML/HTM, PDF, PPT or PPTX up to 25 MiB. It does not automatically compress files. The server derives MIME and limits from the filename, independently of client MIME.
2. Pause during upload, then **Reopen** to retrieve the confirmed server version and checkpoint. The API can now be restarted at this point. Reload the lab, select the saved draft, reselect the exact original file and Resume upload. Name, size and SHA-256 must match. An ambiguous response locks writes until Reopen; confirmed blocks are not replayed. Two-hour expiry requires removal/restart and is not extended by resume or server restart.
3. After server-side SHA-256, size and basic type checks, the completed file is **quarantined**. As its owner, choose a simulated scanner outcome and Run simulated scan. Only an explicit simulated pass enables preview/download and submission. MP4 preview uses protected 1 MiB reads and the connected streaming engine/caption extractor; unsupported streaming layouts offer explicit full-file playback. HTML uses an isolated preview; documents are download-only, never embedded in an iframe, object or PDF viewer. Download retrieves original bytes through bounded reads, with a final access check. Full-file operations still allocate the complete file in browser memory.
4. Submit for local review. Switch to **Librarian**, select the draft, confirm the non-sensitive client-safe fixture and Publish locally. Switch to **CSM reader**, select the published item and use Present mode. The other builder cannot read a private draft.
5. Withdraw as the owner or librarian. Subsequent published/present reads are denied; an already-open player or attachment view checks every 30 seconds and clears its source/HTML preview and disables downloading after failure. Each download also rechecks authorization; a denied download clears its busy state and stays disabled. Already-delivered bytes cannot be recalled. Removing a draft upload deletes its staged and finalized blobs.

The label **Integrity verified / not malware-scanned** is intentional. Type checks are limited to MP4 `ftyp`, PDF `%PDF-`, PPT CFB/OLE magic and PPTX ZIP magic; HTML must be valid UTF-8 without null bytes. These do not validate an entire PDF, Office container or presentation, detect macros, certify codecs or scan malware. Local publication remains a workflow simulation, not production approval.

HTML preview reuses the connected viewer's restrictive CSP and `sandbox="allow-scripts"`, without `allow-same-origin`, and uses `no-referrer`. Inline interaction is permitted; parent DOM, same-origin storage, fetch, external script/style resources, nested frames, objects and form submission are restricted. Data/blob images and media are permitted by the existing policy. The CSP is prepended only to the preview DOM; downloading returns the original, unchanged file. Withdrawal removes the iframe on the next failed authorization check. This preserves the existing viewer policy, not a claim that arbitrary HTML is safe outside that sandbox.

### Simulated quarantine

The [local scanner](scripts/local-media/scanner.mjs) is deliberately fake: its outcome is selected in the workbench and it performs no malware detection. Use only non-sensitive, known-safe fixtures. A simulated pass is not evidence that a file is safe; both the scanner heading and pass status explicitly identify the simulation.

- Completion and release are separate. A completed upload starts `pending`; API range reads for every actor/mode, submission and publication require a `passed` result bound to the stored asset ID, ETag and SHA-256. Published/present catalogue access also excludes unreleased media before rendering. Owner/librarian submission metadata remains available for recovery.
- Only the owning builder can queue a simulated scan on a Draft, using its current version and upload session. The request commits a durable job and returns immediately, still quarantined; a duplicate request cannot replace an active job. The separate [scan worker](scripts/local-media/scan-worker.mjs) claims work in a short SQLite transaction, then performs the ETag-conditional storage probe and fake scan outside the transaction. The selected draft refreshes automatically once per second while it has a job; refresh errors stop polling and require Reopen. Switching draft/identity, starting a write or leaving the page cancels its pending refresh.
- A simulated rejection is terminal for that upload. Remove it and start a new upload to replace it. A passed verdict is also final for that upload; these controls do not provide arbitrary rescanning or revocation of a previously passed verdict. Normal withdrawal still revokes published access.
- Jobs use a **5-second attempt deadline**, **10-second claim lease** and **three automatic attempts**, with **2-second then 4-second retry delays** (plus the worker's one-second polling interval). `Scanner unavailable`, `Scanner timeout` and storage failures remain quarantined while retrying; exhaustion persists `error` and enables a new explicitly requested job/outcome. Each claim consumes an attempt, including a crashed claim. Lease expiry permits recovery, not implicit clearance. The UI shows job-local progress and lifetime attempts separately.
- A verdict commits only if the draft remains editable and its upload session, asset ID, ETag, digest, job ID, lease token and unexpired lease still match. Removed/replaced files, superseded claims and duplicate/late results cannot be released. No database transaction remains open while scanning. A failed verdict save retains quarantine and the running claim until lease recovery. A lost response after a committed pass is recovered by automatic refresh or Reopen, without rescanning. Missing legacy scan fields mean `pending`, never implicit clearance; invalid stored verdict/job bindings fail closed.
- Existing completed fixtures need a simulated pass. Legacy review/published fixtures must first be withdrawn to Draft, then scanned, resubmitted and published again. Their bytes and records are not automatically deleted or relabeled. Completed quarantined/rejected uploads remain protected from expiry/orphan cleanup and can be removed explicitly by their owner in Draft.
- The launcher starts the worker using its private IPC connection; the emulator key is not in browser state or command-line arguments. It allows three automatic worker restarts per launcher run, then logs that the launcher must be restarted. Ctrl+C stops/aborts the worker before closing SQLite and Azurite. A stopped in-flight claim remains quarantined until a restarted worker reclaims its expired lease. Start with the same `--data-dir` to recover its queued jobs; no browser needs to remain open.
- Restart the local launcher to load API/worker changes; browser hot reload alone does not replace its server-side modules. Previously running labs retain their old API behavior until restarted. This is a single-machine development queue, not production distributed orchestration. There is still no real scanner, remote callback, malware signature update service or production quarantine container policy. A blocking native scanner would require additional process isolation; the current deadline handles asynchronous work, including a promise that ignores cancellation, but does not certify arbitrary third-party scanner execution.

### Isolation and lifetime

- Entry points are [local-media/main.tsx](local-media/main.tsx) and [scripts/local-media/dev.mjs](scripts/local-media/dev.mjs). They are not imported by the PoC or connected entry points and have no Power Apps deployment configuration. Existing Dataverse storage/read paths are unchanged.
- Upload metadata, expiry, versions, final blob ETags and simulated permissions are stored in `media.sqlite` in the retained workspace. The [SQLite state adapter](scripts/local-media/state.mjs) reloads authoritative state per command and uses an immediate transaction with full synchronization; responses are returned only after commit. Failed writes roll back live state. Corrupt, missing or unsupported state fails closed rather than silently creating an empty catalogue. This local journal is not the eventual Dataverse schema.
- Azurite bytes/metadata live in the workspace's `blob` subdirectory. The emulator worker holds an exclusive SQLite lease, preventing simultaneous launchers from opening the same files. The lease releases on process exit; a still-running owner must shut down before another launcher can use that workspace. No stale lock-file deletion is necessary.
- Ctrl+C closes the API, drains accepted commands and asks Azurite to flush before exit; data is retained. The emulator also requests a graceful flush when its parent IPC connection disappears. API-process crash recovery with a surviving emulator and normal full shutdown/restart are tested. Forced termination of Azurite itself, filesystem corruption, power loss and machine recovery are not certified; the emulator is not production durable storage.
- If a process exits after staging but before the SQLite checkpoint commits, resume may resend that unacknowledged block using the same deterministic block ID. Already acknowledged blocks retain their counters and are not replayed. If finalization was interrupted, Reopen and Resume with the exact file re-verifies staging and retries promotion to the same asset ID; incomplete assets remain unreadable. If completion committed but its response was lost, Reopen shows the completed asset. Finalization is recoverable through explicit retry, not an automatic startup job.
- Staging bytes remain alongside the verified final copy until explicit removal; stopping the lab no longer deletes them. Use the workbench's Remove action for an upload. For a full reset or backup, first stop the owning launcher and handle the entire identified workspace together, not just the SQLite file. The launcher never deletes user source files or unrelated directories. Previously running temporary labs are not automatically imported; keep them running until their needed originals have been accounted for.
- Automated tests still create and remove uniquely named temporary workspaces. There is no scheduled expired-session/orphan cleanup, real malware scanner, bulk migration tool or infrastructure deployment in this slice.
- The pinned SDK/emulator combination is `@azure/storage-blob` 12.33.0 with Azurite 3.37.0. The locked worker uses Azurite's server factory to await flush/close explicitly; rerun the recovery tests before upgrading it. SDK 12.34.0 requested an API version the emulator rejected; do not disable API-version validation as a workaround.

### Offline cleanup

Stop the launcher for the intended workspace with Ctrl+C first. The [maintenance command](scripts/local-media/maintenance.mjs) refuses an active workspace and requires its existing, valid SQLite catalogue and both Blob containers. It never initializes an empty catalogue as a substitute for missing state. Do not use this command against Azure or production data.

From `app/`, preview the default retained workspace:

```powershell
npm run cleanup:media
```

Review the JSON report's exact `workspace`, `expiredUploads`, `orphanBlobs`, `retainedBlobs`, `issues` and `fingerprint`. The default report does not modify application metadata or blob contents; starting/stopping Azurite still performs emulator bookkeeping and workspace locking. To delete only after reviewing an unblocked report, replace the placeholder with that report's fingerprint:

```powershell
npm run cleanup:media -- --execute --confirm "PASTE_THE_REPORT_FINGERPRINT"
```

For another workspace, append `--data-dir "C:\local\prisma-media"` to both invocations, after npm's `--` separator. Do not switch directories between reporting and execution.

- Expired incomplete Draft sessions lose their staged and partially promoted bytes, then their upload metadata is cleared and draft version advanced. Completed uploads, including their retained staging copies, are protected regardless of expiry or publication state. Active upload references are also protected.
- Unreferenced UUID-named blobs require a 24-hour age grace. Recent blobs, unknown ages and unrecognized names are retained. Missing/changed completed assets, shared references and missing active staging block all deletion; a storage listing failure is an error, never an empty inventory.
- Execution rebuilds the report under the exclusive emulator lease and a SQLite write transaction. Any changed catalogue/inventory or changed candidate selection invalidates confirmation before deletion. References are checked again per target. Committed blobs require their observed ETag. Uncommitted blobs are rechecked against their block list, committed to an empty placeholder only if no committed object exists, then deleted with the new ETag. This relies on the offline local workspace's single writer; it is not a production distributed cleanup protocol.
- Blob operations and SQLite are **not atomic together**. A failed/interrupted run can leave some candidates deleted or an empty placeholder while metadata rolls back. Preserve the whole workspace, resolve the error and run the report again; review its new fingerprint before retrying. Already-missing expired targets can then be cleared safely. Never reset the catalogue or delete lock files to bypass a blocked report. Back up the entire stopped workspace before destructive maintenance when fixtures must be retained.
- Cleanup is explicit, not scheduled. It does not repair missing completed media, remove completed staging copies, scan malware, migrate data or certify emulator recovery after power loss. Tests delete only their disposable fixtures; existing user workspaces were not cleaned as part of implementation.

### Shared MP4 contract

The [common contract](src/lib/mediaContract.ts) defines draft media reads, digest-bound begin/checkpoint, binary blocks, finish/remove and bounded protected range reads. Versions remain opaque to callers. Unknown providers fail explicitly; neither adapter retries ambiguous writes or falls back after denial. A dispatched write failure requires reopening and reconciling the server checkpoint before continuing, including when cancellation cannot stop an already-dispatched SDK request. These client checks do not replace server authorization, digest verification or scan enforcement.

- The [Dataverse adapter](connected/src/dataverseMediaAdapter.ts) wraps existing generated-service interfaces and their validated JSON/base64 decoders. [The connected data source](connected/src/dataSource.ts) exposes `videoMediaAdapter` bound only to Dataverse; existing upload/playback orchestration is unchanged. Read snapshots preserve asset/session IDs, captions, order and linked-asset metadata. Completion retains the legacy readiness policy, with integrity and scanning explicitly `unreported`, not fabricated scan clearance.
- The [local Blob adapter](local-media/adapter.ts) wraps the lab JSON/binary HTTP protocol. [The lab client](local-media/client.ts) exposes `localAttachmentAdapter(actor)`, `uploadAttachment` and `fullAttachment`; earlier video-named exports remain aliases. Local transfers now accept HTML/PDF/PPT/PPTX as well as MP4, bind filename-derived MIME and enforce type-specific limits. Legacy MP4 snapshots may omit MIME; non-video snapshots may not. Upload completion means integrity verified but quarantined; a simulated pass reports ready, rejection remains rejected and scan errors remain quarantined. Readiness is not publication or client-safe clearance: every range still requires server authorization.
- The shared contract retains its video interfaces and adds attachment aliases for the local extension. The Dataverse adapter's upload/resume/range pilot remains MP4-only; existing production document/HTML behavior and orchestration are unchanged. This is not a general storage switch. Image transfers through this contract, metadata writes, live migration, a production Azure adapter, Entra tokens and hosted Power Apps connectivity are not implemented here. Offline inventory/ledger tooling is described below. The only adapter provider values are `dataverse` and `local-blob`; the latter is an emulator lab, not an Azure production endpoint.

The shared scenarios live in [the existing transfer tests](connected/src/mediaTransfer.test.ts), run by `npm run test:connected`. Protocol-shaped fixtures exercise both adapters through begin/resume/block/finish/removal, readiness, pinned and truncated reads, stale writes, lost acknowledgments, provider mismatch, malformed responses, denial and cancellation. Dataverse envelope failures without a reliable HTTP status remain generic failures rather than inferred permission codes.

### Repeatable Edge acceptance

Run the [full local Blob workflow](scripts/local-media/acceptance-edge.mjs) in installed Microsoft Edge, outside the integrated browser:

```powershell
npm run test:media:edge
npm run test:media:edge -- --output "C:\local\prisma-edge-run-001"
npm run test:media:attachments
```

Run from `app/` after `npm install`, using Node 22.13+ (24 recommended) and an installed Microsoft Edge. Headed Edge is the default; `--headless` is an optional automation mode, not the mode used for the acceptance evidence below. Pinned development-only dependencies are `playwright-core` 1.63.0 and `ffmpeg-static` 5.3.0. FFmpeg is downloaded at dependency installation, not served to the application. The runner generates a synthetic 16-second 640 x 360 MP4/AAC clip spanning at least three 4 MiB blocks. No private media, user browser profile, Azure credentials or Dataverse connection is used.

Each run creates its own directory under the OS temporary directory, or the explicitly supplied **new** output directory (whose parent must exist). It refuses an existing output directory. A forked launcher selects an available loopback port and retains a separate SQLite/Azurite workspace. Parent-only IPC reports readiness and requests graceful shutdown, including on parent disconnect. The runner stops/restarts only its own launcher; existing labs are not reused or modified. A visible Edge window opens during the test and closes afterward.

The assertions cover:

- Actual UI upload with the first successful block response deliberately lost, writes locked pending Reopen, and a confirmed 4 MiB server checkpoint. Cross-owner draft access is denied.
- Full launcher/emulator shutdown and restart, exact checkpoint preservation, file reselection and resume. The observed block sequence proves no confirmed block was replayed.
- Completed-upload quarantine: range requests are denied, the player is absent and submission is disabled until the background simulated scan passes.
- Submission, simulated librarian client-safety acknowledgment/publication and CSM present-mode playback through the real lab API.
- Normal-speed playback from zero to the `ended` event, followed by forward/backward seeking with decoded nonblank pixel checks. Desktop 1280px and mobile 390px screenshots and layout checks detect overflow and missing player framing.
- The actual browser Download action through protected HTTP ranges, saved original filename and a SHA-256 comparison of the downloaded bytes with the generated fixture.
- Withdrawal through a separate owner page: new CSM ranges are denied, the catalogue entry disappears, and the already-open player clears its source and disables downloading within its existing 30-second authorization heartbeat.

Reports record Edge/FFmpeg versions, the fixture size/hash, playback completion, download hash and any page errors. The output directory retains `report.json`, desktop/mobile/withdrawal screenshots, fixture/download files, a launcher log and the stopped lab workspace; failed runs also capture failure state/screenshots when available. Exit status is nonzero on assertion or shutdown failure. Do not treat a partial report as a pass. Keep evidence outside the repository; remove only that disposable output directory when no longer needed and after the runner has stopped.

On 2026-09-28, **two consecutive fresh-workspace headed runs passed** in Edge 154.0.4258.37 with FFmpeg 6.1.1. The fixture was 9,658,436 bytes; playback ended at 15.999999 seconds at readyState 4, with no media or page error. Original and downloaded SHA-256 both equaled `8a254e5a29195f6cb6587054e2542edb019922a0b62a4814a0c7ef346985771b`. Evidence was retained under `%TEMP%/prisma-edge-acceptance-Vf0BQp/` and `%TEMP%/prisma-edge-acceptance-iFcw0e/`. All **28 local tests** also passed, including the new launcher IPC lifecycle test.

The attachment command runs that same MP4 workflow followed by HTML, PDF, PPTX and PPT upload/quarantine/scan/publication, protected original download with filename/hash comparison, and owner withdrawal with reader denial. Downloads use native keyboard activation. HTML adds inline interaction, parent/storage/fetch isolation assertions, desktop/mobile captures and iframe removal after withdrawal. Documents assert that no inline viewer exists. Development-only fixture generators are `pdf-lib` 1.17.1, `pptxgenjs` 4.0.0 and `cfb` 1.2.2. PDF and PPTX are generated documents; the PPT fixture is a synthetic CFB container, not an Office-renderable presentation or Office compatibility certification. A targeted PptxGenJS `image-size` override pins 2.0.3 to avoid newly introduced high advisories.

On 2026-09-28, the complete attachment command passed in headed Edge 154.0.4258.37, with evidence at `%TEMP%/prisma-edge-acceptance-6sp0tP/`. All four attachment downloads matched their originals and withdrawal denied access; there were no uncaught page errors. Expected CSP/denied-request diagnostics are retained separately in `consoleErrors`. All **31 local tests**, **65 connected tests**, local type-check, lint and both application builds passed. The connected build retains its existing chunk-size warning.

This closes the repeatable short-fixture local Edge workflow and local document/HTML transfer gaps, not production acceptance. Playback is muted, so audible output is unverified. This runner does not yet cover captions, maximum-size media, hardware/device diversity, real malware scanning, Office rendering, Entra/Dataverse permissions or hosted Power Apps downloads. The npm audit still reports four moderate advisories in the existing Azurite dependency chain (`azurite`, `@azure/ms-rest-js`, `sequelize`, `uuid`); no broad or breaking dependency fix was applied.

### Offline migration dry runs

[The migration CLI](scripts/media-migration.mjs) inventories and reconciles **offline JSON evidence**, without contacting Dataverse, Azure or the running lab. Optional verification independently reads retained source and destination snapshot files. It does not export records, copy, transcode, scan, switch references, execute rollback or delete assets. Matching supplied digests alone is not independent byte verification or permission evidence. Report modes are `dry-run`, `byte-verification` and `rollback-report`; `canSwitch` is always false, and rollback reports also have `canRollback: false`.

Run from `app/`, using Node 22.13+ (24 recommended). No emulator or credentials are needed:

```powershell
npm run migration:media -- --source "C:\local\migration\source.json"
npm run migration:media -- --source "C:\local\migration\source.json" --destination "C:\local\migration\destination.json"
npm run migration:media -- --source "C:\local\migration\source.json" --destination "C:\local\migration\destination.json" --record --ledger "C:\local\migration\migration.sqlite"
npm run migration:media -- --ledger "C:\local\migration\migration.sqlite" --report <report-fingerprint>
npm run test:migration
```

Default invocations print JSON and create no files. Only `--record` together with `--ledger` authorizes writing the selected **local evidence ledger**, not media or metadata. The ledger parent directory must already exist. Exit codes: `0` means the report completed without blocking findings (deferred/unobserved/copy-required items may remain), `2` means a valid report has planning, verification or rollback blockers, `1` means invalid arguments/input or a ledger/read failure. There is no `--execute` option.

#### Manifest contract v1

Each input is limited to 32 MiB and 100,000 assets. Unknown/missing fields, unsupported versions/providers, duplicate asset IDs, reused destination keys and incomplete exports fail closed. IDs use lowercase GUIDs. Versions are nonempty opaque tokens containing only letters, digits, dots, underscores, colons or hyphens, up to 256 characters. Normalize approved exports to this contract; do not pass raw Dataverse responses or invent missing evidence.

Source example (synthetic evidence, not a live inventory):

```json
{
	"schemaVersion": 1,
	"environmentId": "11111111-1111-1111-1111-111111111111",
	"complete": true,
	"assets": [{
		"assetId": "22222222-2222-2222-2222-222222222222",
		"solutionId": "33333333-3333-3333-3333-333333333333",
		"provider": "dataverse",
		"version": "123:456:source",
		"contextSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		"kind": "file",
		"mime": "video/mp4",
		"size": 24,
		"sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"complete": true
	}]
}
```

Root `complete: true` asserts a complete, successfully paged inventory, not an empty substitute for inaccessible records. Source `complete` describes upload completion, not publication, malware scanning or client safety. Source provider must be `dataverse`; `kind` is `file` or `external-link`. Include unfinished uploads, external links and non-MP4 assets so they can be explicitly deferred. Source size, MIME and either digest may be `null` when unknown; a completed MP4 with missing size/digest/context is blocked. MP4 pilot size is 12 bytes through 500 MiB.

`version` must bind the exact source file revision and relevant row versions. `contextSha256` is the SHA-256 of a deterministic canonical JSON snapshot of relevant record state and metadata, including provider/reference identity, solution/asset versions, ownership/shares, workflow/clearance state, captions, ordering and linked-asset metadata. The eventual exporter must collect that evidence consistently, use a stable projection and recursively sorted keys (with stable ordering for unordered sets), and use `null` if evidence is incomplete. This CLI compares the hash; it cannot prove the projection is complete or permissions are current.

Destination example:

```json
{
	"schemaVersion": 1,
	"environmentId": "11111111-1111-1111-1111-111111111111",
	"complete": true,
	"provider": "local-blob",
	"storeId": "33333333-3333-3333-3333-333333333333",
	"assets": [{
		"assetId": "22222222-2222-2222-2222-222222222222",
		"solutionId": "33333333-3333-3333-3333-333333333333",
		"sourceVersion": "123:456:source",
		"contextSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		"container": "final",
		"key": "media/22222222-2222-2222-2222-222222222222",
		"version": "etag-1",
		"size": 24,
		"sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"mime": "video/mp4"
	}]
}
```

Destination `storeId` is a stable, non-secret logical store GUID, not a URL/account key. Its evidence-only provider can be `local-blob` or `azure-blob`; this does not register an Azure frontend adapter. Source and destination environments must match. `sourceVersion` and `contextSha256` describe the source snapshot associated with that destination object. Destination size/SHA-256 must come from independently reading the exact pinned destination version, not copying the source's declarations. Keys are opaque alphanumeric/underscore/hyphen path segments, up to 512 characters; URLs, query strings, SAS tokens and traversal segments are prohibited. Containers use Azure-compatible lowercase names. Use non-secret normalized version identifiers if raw ETags contain quotes. Changing any destination store/reference/version changes the report fingerprint.

#### Findings and ledger recovery

- `destination-unobserved`: no destination manifest was supplied; absence is not assumed. A complete empty destination manifest explicitly records that no destination assets were observed.
- `copy-required`: eligible MP4 source evidence has no destination match. This is a planning result, not permission to copy.
- `matched-evidence`: supplied source revision/context, solution, MIME, size and digest match destination evidence. Live reauthorization, fresh source-state checks, byte verification, malware scanning and hosted acceptance remain mandatory before any future switch.
- `deferred`: unfinished uploads remain on their original provider; external links remain unchanged; other file types are outside this pilot. A destination unexpectedly attached to an unfinished upload or external link is blocked.
- `blocked`: changed source revision/context, missing evidence, size/digest/MIME/solution mismatch, or a destination asset absent from the complete source inventory. Unreferenced destinations are reported, never deleted.

The separate SQLite ledger stores immutable reports containing source/provider/version, destination store/key/version, sizes, digests, checkpoint and outcome. Fingerprints are stable across input ordering; repeating the same evidence records one report, while changed evidence appends another. Reports are retrievable by fingerprint after restart and old reports are historical evidence, never a current execution permit. Transactions use `synchronous=FULL`, a one-second lock timeout and rollback journaling. Process-exit tests cover uncommitted rollback and committed-response-loss replay without duplicates; power-loss durability is not certified.

Existing empty, unrelated, future-version or corrupt databases are rejected, not initialized/reset. Preserve the whole ledger and any journal after interruption; retry the same explicit recording operation to reconcile local transaction recovery. Do not point this tool at the lab's media database. Back up while writers are stopped, use a locally controlled directory with appropriate OS permissions, and do not commit manifests/ledgers to the repository: IDs, hashes and opaque keys can still be sensitive. Fingerprints detect accidental changes, not a malicious local administrator. Validation errors do not echo input payloads or credentials.

#### Independent bytes and restart recovery

For a complete, approved **MP4 pilot inventory of at most 100 entries**, place independently obtained source snapshots at `<source-root>/<assetId>` and destination snapshots at `<destination-root>/<container>/<key>`. The general manifest-only planner still accepts up to 100,000 entries. Do not label a silently truncated inventory complete; establish the pilot scope before exporting it. The exporter and its authorization/version-binding proof remain unimplemented.

Use separate, access-controlled local snapshot directories. Files must be ordinary files, not links or junctions; destination parent segments must be directories. Verification streams SHA-256 in 1 MiB chunks, checks declared size and file identity/timestamps, then rereads the source after reading a matched destination. Missing, changed or corrupt bytes block verification. These are local snapshot checks, not live Dataverse/Azure exact-version reads; files can change again after any report.

Run from `app/`, substituting actual local paths and recorded fingerprints:

```powershell
$evidence = @("--source", "C:\local\migration\source.json", "--destination", "C:\local\migration\destination.json", "--source-root", "C:\local\migration\source-bytes", "--destination-root", "C:\local\migration\destination-bytes")
$ledger = "C:\local\migration\migration.sqlite"
npm run migration:media -- @evidence
npm run migration:media -- @evidence --record --ledger $ledger
npm run migration:media -- @evidence --record --ledger $ledger --resume "REPLACE_WITH_CHECKPOINT_FINGERPRINT"
npm run migration:media -- @evidence --ledger $ledger --rollback-from "REPLACE_WITH_COMPLETED_BASELINE_FINGERPRINT"
```

Verification records `pending`, `source-verified`, `destination-verified`, `blocked` or `deferred` checkpoints, with `complete: true` only after the inventory finishes. `counts` describes manifest planning; `verificationCounts` describes actual byte checks. A source with no destination remains `copy-required` / `source-verified`. Deferred files are not byte-verified. Completion and exit code zero do not mean every asset is ready to migrate.

With `--record`, every stage is an immutable full-report SQLite checkpoint; its fingerprint is printed to stderr, leaving stdout as the final JSON report. Preserve the ledger/journal after interruption and resume using the last recorded fingerprint. Resume requires the same plan fingerprint and **rereads all eligible bytes**, rather than trusting historical verified flags. Identical evidence deduplicates; changes append history. Full snapshots trade simplicity for storage growth, hence the 100-entry verification cap. This is verification recovery, not interrupted-copy recovery or scale certification.

#### Rollback reports

`--rollback-from` loads a completed byte-verification baseline and performs fresh verification using the supplied current manifests/snapshots. It reports `candidate-for-authorized-restore` only when retained source bytes and destination bytes verify and source identity/version/context plus destination store/reference/version remain unchanged. Missing bytes, changed context/references and missing baseline assets block the report. Assets not verified in the baseline are marked `retain-current-provider`; the tool never assumes Blob-native uploads can fall back to Dataverse. A verification baseline is not proof that any asset was actually switched.

Rollback reporting is read-only unless `--record` is also specified, and never restores a reference. Actual rollback still needs fresh live authorization, exact-version conditional Dataverse updates, reconciliation and hosted denial checks. Retaining old bytes is not permission to serve them after an access denial.

### Infrastructure templates

The [Bicep foundation](../infra/media/main.bicep) and [example parameters](../infra/media/example.bicepparam) prepare private storage, separate managed identities, container-scoped roles, private endpoint/DNS integration, retention, diagnostics and alerts. They do not provision API hosting, connect Dataverse or deploy anything automatically. The example contains deliberately unusable IDs, not an approved environment. Required IT inputs, permissions and deployment gates are maintained in the [infrastructure runbook](../docs/architecture/technical-architecture.md#infrastructure-template-runbook).

Install a trusted standalone Bicep CLI (verified with **0.47.16**) on PATH, or set `BICEP_BIN` to its executable. From the repository root:

```powershell
npm --prefix app run check:infra
```

This command compiles both files, checks six groups of compiled ARM properties and deletes only its own temporary outputs. It needs no Azure login, makes no deployment calls and fails if the compiler is absent or diagnostics/checks fail. Compilation is not Azure deployment validation.

The same command also compiles the separate [dev lab template](../infra/media/lab.bicep) and checks that it stays Entra-only, IP allow-listed and limited to container-scoped developer roles.

### Azure lab storage

**Status:** Deployed 2026-09-29 for development only; not the production foundation and not Phase 2 hosted integration.

The workbench can keep its loopback API, SQLite journal, simulated identities and scan worker on the developer machine while storing bytes in real Azure Blob Storage. It targets the Microsoft Azure Sponsorship (Laboratorios) subscription `f997a88d-a154-449c-8e29-5518ffe24c02`, resource group `RG-Prisma-Media-DEV` (East US). Only first-party Azure Storage and RBAC are used; nothing from Marketplace, no support plan, VNet, private endpoint, Log Analytics, Defender, compute or Key Vault. Sponsorship credits do not cover Marketplace or third-party products, so do not add them here.

| Setting | Value |
|---|---|
| Account | `stprismalabiwguqp7gvh`, StorageV2 Standard_LRS Hot, endpoint `https://stprismalabiwguqp7gvh.blob.core.windows.net/` |
| Containers | Private `staging` and `assets`, matching the local adapter (not the production `staging`/`quarantine`/`final` layout) |
| Authentication | Entra ID only: Shared Key, anonymous blobs, local users and SFTP disabled; TLS 1.2+ HTTPS |
| Network | Public endpoint with firewall `Deny` by default, `bypass: None`, and only the listed developer IPs allowed |
| Access | **Storage Blob Data Contributor** per developer on each of the two containers only; no account-wide data role or keys |
| Recovery | 7-day blob and container soft delete; no versioning, change feed, lifecycle deletion or lock |

Run it from `app/` after `az login` (the lab uses `AzureCliCredential`; no keys or SAS are stored):

```powershell
npm run dev:media -- --azure-endpoint https://stprismalabiwguqp7gvh.blob.core.windows.net/
npm run cleanup:media -- --azure          # report-only; --execute --confirm <fingerprint> as for Azurite
npm run test:media:attachments -- --headless --azure-endpoint https://stprismalabiwguqp7gvh.blob.core.windows.net/
$env:PRISMA_LAB_AZURE_ENDPOINT = 'https://stprismalabiwguqp7gvh.blob.core.windows.net/'; npm run test:media
```

The default Azure workspace is `%LOCALAPPDATA%/PRISMA/media-lab-azure`. On first use the launcher writes `azure-storage.json`, binding the workspace to one account and a random `lab-<uuid>/` blob prefix. A workspace never switches between Azurite and Azure: the launcher refuses Azurite state in an Azure workspace and vice versa. Each workspace, test run and developer sees only its own prefix, so cleanup reports cannot delete another workspace's blobs. Azure workspaces use the same exclusive `workspace-lock.sqlite` lease as Azurite. The Azure opt-in test and Edge runner use fresh prefixes; their withdrawn synthetic fixtures remain until cleaned with the evidence workspace or soft-delete expiry.

Blob operations make one attempt, as locally, so ambiguous writes still require Reopen instead of silent retry. Finalization still streams staging bytes through the developer machine into `assets`, so large files incur download and upload time and internet egress. When your public IP changes, requests fail with an authorization error until the firewall list is updated. To add a developer or IP, redeploy with comma-separated values from the repository root (requires Owner on the resource group):

```powershell
$env:PRISMA_LAB_ALLOWED_IPS = '<ip1>,<ip2>'; $env:PRISMA_LAB_PRINCIPAL_IDS = '<objectId1>,<objectId2>'; $env:PRISMA_LAB_OWNER = '<owner-upn>'
bicep build infra/media/lab.bicep --outfile $env:TEMP/lab.json; bicep build-params infra/media/lab.bicepparam --outfile $env:TEMP/lab.parameters.json
az deployment group what-if --subscription f997a88d-a154-449c-8e29-5518ffe24c02 -g RG-Prisma-Media-DEV -n prisma-media-lab --template-file $env:TEMP/lab.json --parameters "@$env:TEMP/lab.parameters.json"
```

Replace `what-if` with `create` after reviewing the changes. Omitting a current developer removes nothing already assigned: incremental deployments do not delete role assignments.

**Verification on 2026-09-29:** what-if showed six creates and no changes/deletes; deployment succeeded. The real Azure round trip (checkpoint, resume, SHA-256 finalization, simulated scan, 1 MiB range reads, publish/withdraw denial, prefixed inventory and removal) passed. The headless Edge acceptance with attachments passed all 12 steps against Azure, including lost-response Reopen, full lab restart/resume, present playback/seeking, checksum-exact downloads, HTML isolation and withdrawal. Shared Key requests returned `KeyBasedAuthenticationNotPermitted` and anonymous listing was rejected. All 34 default local tests, the infrastructure checks and lint pass. Access from a non-allow-listed IP was not tested. This is development evidence for real Blob behavior, not Entra/Dataverse authorization, hosted CSP/CORS, managed identities, private networking, real scanning or production performance.

### Verification on 2026-09-28

The offline migration slice passed **16 focused tests**, including independently streamed snapshot checks, corrupt/missing/replaced-source rejection, pilot limits, directory rejection, actual process-exit checkpoint recovery, rechecking on resume, rollback-report blockers and retained-provider handling. Earlier coverage of strict manifests, deterministic fingerprints, read-only defaults, immutable/idempotent persistence, database formats, payload redaction and tampering remains. Fixtures are disposable and synthetic. The infrastructure template and example parameters compile without diagnostics under **Bicep 0.47.16.16243**, and all **six compiled-ARM check groups** pass. Lint and editor diagnostics also passed. No live inventory, cloud byte reads, reference changes, actual rollback, Azure what-if or deployment acceptance was performed.

The compatibility pass ran all **64 connected tests** and **27 local tests**, local TypeScript, lint, and both connected/PoC builds successfully. The connected build retains its chunk-size warning. Browser checks against the existing worker-enabled lab used the actual client adapter to read a 1 MiB first range and 24-byte tail with one pinned version, reject an unpublished reader, and load the 640 x 360 player to readyState 4. Adapter lifecycle tests use native-protocol fixtures, not hosted Dataverse or Azure. No new hosted acceptance, deployment or migration is implied.

Twenty-seven local tests passed, including concurrent stale mutations, exact-file/expiry checks, simulated access denial, HTTP origin/host guards, SQLite write failures/corrupt state and real Azurite upload/readback/removal. Retained-workspace tests stop/restart the emulator, reject a second workspace owner and resume the saved checkpoint. Separate API workers exit after block staging, staging commit, final-blob promotion, or metadata commit; recovery retains acknowledged counters, denies reads of incomplete assets, creates one final asset and matches the original checksum. Cleanup tests exercise report immutability, expiry/grace rules, stale confirmation/publication references, missing completed assets, injected storage outages/lost deletion responses and changed ETags. Actual cleanup-process exits after the uncommitted-to-empty transition and after deletion leave metadata recoverable; a fresh report/retry completes cleanup while the published fixture remains readable byte-for-byte. CLI tests use disposable workspaces, reject active owners and missing/uninitialized databases, then report/confirm across emulator restarts. Scan tests cover the guarded HTTP endpoint, all actor/read-mode denial combinations, terminal rejection, outage retry, stale versions, forged client clearance, invalid verdict binding, storage/save failure, legacy publication and process exits before/after verdict commit. Background tests add lease fencing, duplicate verdicts, removal/replacement safety, retry/crash exhaustion, timeouts with late results, API responsiveness during a hung scan, failed verdict commits and an actual worker kill/restart with real lease expiry and byte-identical readback. The earlier 56 connected tests remain the baseline for the unchanged Dataverse path; local TypeScript and lint checks cover the workbench.

Quarantine browser acceptance used a separate workspace and the same synthetic MP4 below. After upload, no player/download was rendered, submission was disabled and a direct range request returned 403. Pending state survived launcher restart. A simulated outage survived Reopen and stayed quarantined; retry/pass enabled playback and local submission/publication. CSM present playback reached readyState 4 at 640 x 360, with nonblank pixels after seeking to three seconds. A second upload's simulated rejection survived Reopen with no rescan/player/download and submission disabled. Desktop 1280px and mobile 390px screenshots/layout checks found no horizontal overflow or oversized elements. Existing running labs and production data were left intact; these checks demonstrate simulated workflow behavior, not malware detection.

Background-worker browser acceptance used another separate workspace. The scan request returned a queued, unreleased job while the UI remained usable; outage retries stopped at three and a new pass enabled playback through automatic refresh without Reopen. On mobile, the worker was interrupted during a timeout attempt; the launcher restarted it, the job stayed quarantined through recovery and exhausted its three attempts, and a new pass reached readyState 4 automatically. Desktop video seeking decoded nonblank pixels; 1280px/390px screenshots and layout checks found no horizontal overflow. Older running labs were not restarted. No real scanning, Azure deployment or production data change is implied.

The retained-workspace browser test uploaded the same fixture below to a 4 MiB checkpoint at version 3, stopped/restarted the actual development launcher, reopened that unchanged checkpoint, reselected the original file and resumed to completion. Playback reached readyState 4 at 640 x 360 after restart. The earlier temporary lab was left intact on its existing port; the retained lab selected the next available port.

The actual workbench uploaded a generated 9,879,374-byte, eight-second, video-only MP4. A controlled browser response-loss injection committed the first 4 MiB block, then discarded its response; Reopen reported 4 MiB and Resume completed in three total confirmed blocks. Browser full-file readback matched SHA-256 `b0bf31e75e5b3dd4a6752b715218e00bca5670bae1bdc48cd0fb0c8011a2e7b7`. Local review/publication and CSM present-mode playback reached readyState 4 at 640 x 360; seeking to five seconds decoded nonblank pixels. Withdrawal denied a new read and cleared the already-open player on its heartbeat. Desktop (1280px) and mobile (390px) screenshots/layout checks found no horizontal overflow or oversized control text.

Earlier continuous play-to-ended timed out in the integrated browser: playback advanced but was observed paused at approximately 5.94 seconds without a media error. The [repeatable headed Edge acceptance](#repeatable-edge-acceptance) now verifies normal-speed completion and checksum-exact browser downloads through the local Blob workflow on a separate 16-second MP4/AAC fixture. That resolves the local regular-Edge short-playback uncertainty, not the integrated-browser pause itself. Audible output, captions, maximum-size files, hosted authenticated OS downloads and a device matrix remain unverified by this lab test. Azure/Entra authentication, effective Dataverse permissions, managed identity/RBAC, private networking, hosted CSP/CORS and production performance remain future integration gates.

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

### Review queue and state blocks (2026-10-02)

At the user's request, from `origin/main` `e2ca558` (lint, both builds, 87 connected, 39 PoC and 30 UI tests passed; no newer teammate commits on `origin`), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790978861083), bundle `index-6VijNOOU.js`; the first push attempt failed on a DNS outage and the retry succeeded). The review queue gains area → capability → sort filters and compact state-coloured cards with a small date; returned records show "Waiting for corrections" with the feedback, and published records a green block with any approval note and an explained "Retire from library". No plug-in, schema or PoC data change; published request-changes and a retire reason are parked on `feature/published-changes` until a signed plug-in. The user checked it in Local Play; the hosted app has not been checked yet.

### Review points list (2026-10-02)

At the user's request, from `origin/main` `ee8dc31` (lint, both builds, 87 connected, 39 PoC and 29 UI tests passed; no newer teammate commits on `origin`), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790976926455), bundle `index-zJhI6Cxa.js`). The review checklist's completeness column becomes "Review points — Verify these items before making your decision." as plain bullets; only a requirement the record fails is flagged Missing. No logic, plug-in, schema or PoC data change. The user checked it in Local Play; the hosted app has not been checked yet.

### Librarian review panel (2026-10-02)

At the user's request, from `origin/main` `5460e95` (lint, both builds, 87 connected, 39 PoC and 29 UI tests passed; no newer teammate commits on `origin`), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790976124020), bundle `index-BIYcc6Cr.js`). The review page's librarian panel now shows status and owner, a review checklist (areas, capability and status; internal client beside its client-facing wording; completeness of each publication requirement; earlier feedback on resubmissions), then a review decision: Ready to publish or Request changes, each revealing only its own controls. Review logic, comments and the submission preview below are unchanged. No plug-in, schema or PoC data change. The user checked it in Local Play before publishing; the hosted app has not been checked yet.

### My submissions workspace (2026-10-02)

At the user's request, from `origin/main` `3ee5b4b` (lint, both builds, 87 connected, 38 PoC and 29 UI tests passed; no newer teammate commits on `origin`; Luis's 2026-10-01 commits were already in the previous publish), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790970423723), bundle `index-B4gN9RUY.js`). My submissions gains status filter chips with counts, a separate review-state band (amber for Changes requested), whole-card opening, Edit plus a "•••" Delete menu, and a right-side librarian feedback panel. No plug-in or PoC data change; the manually created `nx_solution.nx_reviewedon` column stays unused (review-date support is parked on `feature/review-date`). The user checked it in Local Play before publishing; the hosted app has not been checked yet.

### All areas note removed (2026-10-01)

At the user's request, from `origin/main` `ee44807` (lint, both builds, 87 connected, 38 PoC and 27 UI tests passed; no newer teammate commits on `origin`), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790891886335), bundle `index-BgC9lJoG.js`). With All selected, the library hero no longer shows "Everything Nextant has built and can show, across all three Specialization Areas."; a chosen area still shows its note. No plug-in, schema or PoC data change. The hosted app has not been checked yet.

### Brand "P" headings (2026-10-01)

At the user's request, from `origin/main` `7b6d5c7` (lint, both builds, 87 connected, 38 PoC and 27 UI tests passed), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790891537048), bundle `index-C6AQilzB.js`). The "Top N" and "Solution Library" headings use `--brand-p`, the colour of the wordmark's "P", instead of the IBO lavender. No plug-in, schema or PoC data change. The user checked it in Local Play before publishing; the hosted app has not been checked yet.

### Submit flow rearranged (2026-10-01)

At the user's request, from `origin/main` `7142984` (lint, both builds, 87 connected, 38 PoC and 27 UI tests passed), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790889030805), bundle `index-BYIbGW_E.js`). Submission steps 2 and 3 are now **Define the solution** and **Solution context**; the client fields show only after "Is this solution associated with a client?" is answered Yes, and Before you start has new copy ([contribution workflow](../docs/workflows/contribution-and-review.md)). No plug-in, schema or PoC data change. The user checked the flow in Local Play before publishing; the hosted app has not been checked yet.

### Demo viewer full screen (2026-10-01)

At the user's request, from `origin/main` `766960c` (lint, both builds, 87 connected, 38 PoC and 26 UI tests passed), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790886873024), bundle `index-ufg3DBFN.js`). Every viewer has a Full screen button for the demo stage ([Demo assets](../docs/workflows/demo-assets.md#viewer-routes)); before publishing, the user confirmed in Local Play that the host grants browser full screen. No plug-in, schema or PoC data change. The hosted app has not been checked yet.

### Top 10 corner heart and dark area tags (2026-10-01)

At the user's request, from `origin/main` `7b83ef4` (lint, both builds, 87 connected, 38 PoC and 26 UI tests passed), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790885430700), bundle `index-BlnBUP6V.js`). Top cards show "♥ 12" as a small corner heart with no circle, level with a title that wraps to two balanced lines; the area tag is gone; in the dark theme AI is a saturated blue and area tags take a richer fill. No plug-in, schema or PoC data change. The hosted UI has not been checked yet.

### Top 3 save counts (2026-10-01)

At the user's request, from `origin/main` `3015bd5` (lint, both builds, 87 connected, 38 PoC, 26 UI and 72 backend tests passed): the Release plug-in, signed with the existing certificate, was pushed with `blob-plugin --execute`, and `inspect-favorites` confirmed `nx_GetTopFavorites` now returns `saves` alongside `solutionIds`. The connected app was then published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790879620244), bundle `index-CFvo8-cN.js`), carrying Luis's library fixes of the same day and Juliana's Top 3 counts, narrower cards and `2xs` area tags. The hosted UI has not been checked yet.

### Merged builder credits on detail (2026-10-01)

At the user's request, from `origin/main` `6fafe44` (86 connected and 26 UI tests, lint and both builds passed), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790864464742), bundle `index-BCgxqy32.js`). The detail page no longer lists builders twice: **At a glance** drops its **Built by** row, and the **Contributor effort** panel becomes **Built by & effort**, with linked names, roles and hours. CSMs stay in their own **At a glance** row. No plug-in, schema or PoC change. The host served the new package, but its frame did not render in the integrated browser, so the hosted UI has not been checked.

### Deep links and Copy link (2026-09-30)

At the user's request, from `origin/main` `06f39ca` plus the uncommitted deep-link change (86 connected, 38 PoC and 26 UI tests, lint and both builds passed), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790805739347), bundle `index-CRgLVpxo.js`). The app now opens `?route=` play links and published detail pages offer **Copy link** ([ADR-0003](../docs/architecture/decisions/adr-0003-hash-routing.md)).

Hosted checks passed:

- The new bundle was served, and the host passed `route` through: the frame hash was `#/s/{id}` before **Begin**, and the solution opened afterwards.
- **Copy link** wrote to the clipboard without the manual fallback. The link came from the host's `appUrl`, kept `tenantId` and `hint`, dropped `sourcetime` and added `route`.
- Opening that copied link reopened the same solution.
- Present mode hid **Copy link**, and turning it off restored the button.

No plug-in, schema or PoC change.

Republished the same day from `origin/main` `7237ea3`, with **Copy link** moved beside the favorite heart ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790806154833), bundle `index-BsjWQEgq.js`). The upload succeeded; the hosted UI was not rechecked.

### Technology name checks (2026-09-30)

At the user's request, from `origin/main` `7ef3060` (38 PoC and 82 connected tests and lint passed), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790801715255), bundle `index-xIM86Vo9.js`, wizard chunk `DraftsView-Dh_ArhiQ.js`). The new-technology field now checks duplicates, similar names and capitalization before creating ([rules](../docs/data_model/reference-data-governance.md#vocabularies)). No plug-in, schema or PoC change. Verified in the local PoC dev server only; the hosted app needed Microsoft sign-in, so the hosted UI has not been checked.

### Faster library and lighter glass (2026-09-30)

At the user's request, from `origin/main` `92cfde5` (82 connected and 25 UI tests and lint passed), the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790798918471), bundle `index-DRtUoDKl.js`). It adds shared published-detail reads and a background library refresh ([client read reuse](../docs/architecture/technical-architecture.md#client-read-reuse)), card thumbnails from the catalogue graph ([details](../docs/architecture/technical-architecture.md#card-thumbnails-in-the-catalogue-graph)), and glass without the SVG refraction ([rendering budget](../docs/design/design-system.md#surface-language--liquid-glass)). Hosted check (privileged account, same day): the host served `index-DRtUoDKl.js` with no refraction class or filter and blur-free welcome facets; after Begin, 6 cards and 3 Top 3 tiles showed their thumbnails; a focused card's detail opened 0.5 s after Enter; Back to the library showed the cards within 0.1 s, all thumbnails immediately, no welcome loader, and made only the four catalogue refresh batches and no image downloads. Present mode listed the same 6 cards with thumbnails and no hearts, Top 3 or builder names; its detail had no credits or effort, and the HTML demo opened in an `allow-scripts`-only sandbox. Leaving present mode restored credits and hearts. No other account or browser was tested.

### Catalogue graph and review follow-ups (2026-09-30)

With explicit approval, from `main` `f751cf1`: the signed Release plug-in (catalogue graph API, plug-in tracing, clearer reader-team error) was pushed with `blob-plugin --execute`, `nx_GetCatalogueGraph` was registered with `catalogue-api --execute`, and the connected app was published to the same app and solution ([open this version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790782788518), bundle `index-BfT_6TEH.js`). The library now loads tags and builder names in one call, and the contributor/review screens load on demand. The API was checked against the per-solution reads through the Web API; the hosted UI has not been rechecked yet. The client service was written in the generated shape because the CLI saw stale metadata ([details](../docs/architecture/technical-architecture.md#bulk-catalogue-graph-deployed-2026-09-30)).

### Library and imagery updates (2026-09-29)

Published to the same PRISMA app with `--solution-id` after each change was checked in Local Play: the favorites ranking (`nx_GetTopFavorites`) and Top 10 shelf, catalogue cards with 16:9 images, thumbnail framing, the screenshot lightbox, the detail hero beside the image, light-theme contrast for white thumbnails, and finally the Top 3 carousel, hero copy, welcome screen, sort and list view (bundle `index-BQ9OwXJ-.js`, from `main` `8fa73e9`). Every push was built from `main` after a fast-forward to `origin/main`, so each one also carried the media work already there. One early push, built before Luis's Blob client reached `main`, replaced his hosted bundle; see the [deployment collision note](../docs/architecture/technical-architecture.md). **Before publishing the app or deploying the backend, fast-forward to `origin/main`.** Backend uploads use Luis's signed `blob-plugin` path, not unsigned `apply`.

### Roles and favorites deployment (2026-09-28)

With explicit approval, `Prisma.Deploy apply` (built from `main` `86cc461`, 49 backend tests passing) deployed the updated plug-in assembly to **Nextant Pulse**: N:N Specialization Area drafts, `nx_clientrole` and contributor `nx_role`, and the new `nx_SetFavorite` / `nx_GetMyFavorites` Custom APIs with User-depth Read on `nx_solutionfavorite` for the three PRISMA roles. No users or teams were assigned.

The connected build (bundle `index-S-q4b2xM.js`, 56 connected and 25 UI tests, lint) was then pushed to the same PRISMA app ID. The first push omitted `--solution-id`, which moved the app out of `PRISMA_Dev`; pushing the same build again with `--solution-id adddc940-98ff-4b2f-9c8a-e89245c2fc33` restored it. **Always pass `--solution-id` when pushing PRISMA.** The user verified in the hosted app that PRISMA is back in `PRISMA_Dev` and that saving and removing a favorite works.

A second `apply` the same day stopped `nx_GetPublishedDetail` from returning contributor credits in present mode and added the Specialization Area N:N to `PRISMA_Dev`; the user verified both. A follow-up push with `--solution-id` (bundle `index-gwvYRZUA.js`, 57 connected tests) added the "Target client role" library filter and hid My favorites on the welcome screen; the user verified both in Local Play.

### Pilot deployment (2026-09-22)

**[Open connected PRISMA](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898)**

Published to **Nextant Pulse**, in **PRISMA_Dev** (`adddc940-98ff-4b2f-9c8a-e89245c2fc33`), as the separate **PRISMA** app (`cffbecd7-c927-474e-b6ed-6c7957ec74cb`). The user explicitly authorized a pilot-only upload with outstanding acceptance gates deferred and confirmed the GPL distribution review was cleared for this deployment. This is not general-release acceptance. The environment's hosted banner identifies it as a Developer environment for development/test use.

The connected production build, 51 connected tests, 12 shared UI checks and lint passed. The CLI confirmed upload and solution addition; its generated app ID is retained in [connected/power.config.json](connected/power.config.json). The PoC app/configuration, backend, sharing and permissions were unchanged.

Authenticated hosted checks loaded the empty published catalogue, both existing owned drafts, the empty authorized librarian queue, and the empty cleared catalogue in present mode. Relative logos loaded. Checks used dispatched activation after an integrated-browser pointer click did not activate; they do not establish full pointer acceptance. No business records were changed. Published detail/viewer and packaged video preparation/playback remain unverified.

**Font/image fix published and verified (2026-09-22):** the initial upload's Google Fonts and protected thumbnail failures are resolved. The connected bundle now includes the original font families and license notices. Protected thumbnails, gallery images and full image previews retain authenticated Dataverse retrieval, then use bounded in-memory PNG/JPEG `data:` URLs; unsupported MIME types and images over 20 MiB are rejected by the display helper (the existing 5 MiB upload limit is unchanged). No persistent image cache or public image endpoint was added. Canceled results are ignored and changing the image item cannot display the previous item's URL.

The update passed 52 connected tests, 12 shared UI checks, build and lint, then uploaded to the same app ID with approval. Hosted verification loaded all three font families from the app origin, decoded both initial draft thumbnails at 1187 x 651, and opened the saved gallery JPEG in the full image viewer at 420 x 420 using `data:`. At a 390px browser viewport, app content fit the mobile iframe and the loaded thumbnail decoded. Checks were read-only and used dispatched activation. A normal reload initially retained the older package; opening the CLI-returned URL with its `sourcetime` loaded the new package.

**Hosted media policy resolved (2026-09-22):** with explicit approval for its environment-wide scope, the admin-center code-app CSP gained only `media-src blob:`, `worker-src 'self'`, `connect-src 'self'` and `script-src 'wasm-unsafe-eval'`. Enforcement remains On; reporting and all other directives are unchanged. Saved settings and PRISMA's response header were independently verified. This affects all code apps in Nextant Pulse, including the PoC, but not Nextant Pulse Prod. No app/backend republish, user/role change or Dataverse write was required. See [configuration and rollback](../docs/architecture/security-model.md#code-app-hosting-policy).

The already-published encoder compressed a local short fixture from 55,704 to 52,413 bytes in 27.6 seconds. Hosted Blob decoding/seeking, progressive 1080p buffering/forward-backward seeking and caption tracks passed. These checks used local fixture bytes inside the real hosted app, not an end-to-end Dataverse upload/review run. The hidden integrated browser paused continuous playback; audible output, continuous playback, OS downloads and effective non-admin/cross-account access remain unverified. Full evidence: [hosted media compatibility](../docs/workflows/demo-assets.md#published-host-compatibility).

**Deployed interactive workflow passed (2026-09-22):** a fresh synthetic submission completed the actual six-step wizard, image/HTML/video uploads, save/reopen, submit, librarian return with feedback, contributor revision/resubmission, independent review confirmation and final publication. Library search and fresh-reload published detail passed. Present mode excluded the invented internal client marker from display and search, retained authored anonymous context, and opened interactive sandboxed HTML and a protected captioned MP4 that played to its two-second end. The labeled test solution **[PRISMA TEST] Hosted workflow 2026-09-22** (`3e16f641-b8b6-f111-aaac-6045bd049fba`) remains published for inspection; existing submissions were untouched. This was a same-account privileged functional test, not non-admin or separate-reviewer security acceptance. No code/deployment changes were needed. [Full results, evidence and limits](../docs/workflows/contribution-and-review.md#deployed-interactive-workflow).

**Video fallback notice published and verified (2026-09-22):** expected MP4 streaming limitations now display an explanatory status and the explicit **Load full video** action, rather than the generic playback/access error. Genuine failures retain the error path; protected reads and full-file access checks are unchanged. The connected build and all 53 connected tests passed (lint passed before deployment). The user-authorized push updated the same app in PRISMA_Dev to package `20260922t192500zefd2dbd388`. Power Apps initially served its cached package; the host's Refresh banner loaded the verified new bundle. Hosted search, detail, images, all three font families and present-mode redaction passed. The retained captioned fixture showed the new notice without an error alert in both normal and present modes; full loading cleared it and decoded the 640 x 360, two-second video with its subtitle track and no media error. This check did not repeat continuous playback or non-admin acceptance. No business records, backend, permissions, CSP or PoC deployment changed.

**Welcome screen published and verified (2026-09-22):** the connected app now holds its liquid-glass welcome screen until authenticated catalogue loading finishes and the user selects **Begin**. Motion stays enabled without a checkbox; the operating system's reduced-motion preference disables motion and skips the single light-flash entry transition. Entry preserves the requested hash route, moves keyboard focus into the app, and does not gate routine catalogue refreshes or present-mode changes again. The existing timeout/error/retry paths remain intact.

The user-authorized push updated the same PRISMA app in PRISMA_Dev to package `20260922t194630zf0bd27f498` (bundle `index-D7POJYjM.js`). Build, 53 connected tests, 15 shared UI tests and lint passed. After the Power Apps Refresh banner replaced its cached version, hosted checks verified the ready screen, missing motion checkbox, keyboard Begin, flash insertion/cleanup, focus handoff and preserved detail route. Search, detail, protected images, all three font families, present-mode redaction and the sandboxed HTML viewer passed with the existing published synthetic fixture. Mobile/light-theme and reduced-motion entry checks passed locally. No business records, backend components, permissions, CSP or PoC deployment changed; existing non-admin acceptance gaps remain open.

**Two-field story published and verified (2026-09-22):** with explicit approval, the current connected build (including existing profile-photo changes) was uploaded to the same app and solution as package `20260922t200947z29bb140bb5`, bundle `index-C3DXp7fc.js`. The existing plug-in assembly was updated, the isolated retired-field row was removed from the Solution Information form, and the column plus its one stored value were permanently deleted. Published/editable metadata both confirm absence; all other form controls remain. See [migration details](../docs/architecture/technical-architecture.md#story-column-retirement). No role, CSP or PoC deployment changes were made.

Both app builds, the standalone walkthrough build, lint and 140 tests passed (54 connected, 19 UI, 20 PoC, 47 backend). After the host Refresh banner replaced its cached bundle, the added Office 365 Users connection prompted for consent, which the user approved; the first catalogue read failed while consent was pending and Retry recovered. Hosted desktop/mobile checks found exactly two story textareas with no app horizontal overflow. A disposable draft `ca8e071a-c2b6-f111-aaac-6045bd049fba` saved and reopened both values exactly, then was deleted through the UI. Existing published search/detail, present-mode redaction, images, all three font families and interactive sandboxed HTML passed. These remain privileged-account checks, not non-admin acceptance. Refresh older open app tabs before editing.

**Shared loading states published (2026-09-22):** the approved update uploaded to the same PRISMA app and solution as package `20260922t203901zafccbc113e`, bundle `index-DBM6X0xV.js`. Page, media and inline waits now share the [loading-state conventions](../docs/design/design-system.md#loading-states), including measured progress and reduced-motion support. The final connected build, 54 connected tests and 22 UI tests passed; both app builds, lint and local desktop/mobile light/dark and reduced-motion checks passed during implementation. Local browser fixtures verified that download indicators clear on success and failure.

After the Power Apps Refresh banner replaced its cached package, the hosted app loaded the exact new bundle. Read-only checks captured the new My submissions, review queue and submission-editor loaders with their polite status, rail and relative prism asset. All three fonts, relative logos, search input/hash updates and present-mode internal-navigation restrictions passed. The current account saw empty published, owned and review lists, so populated search results, detail, protected images and media playback were not reverified in this deployment. The blank editor was left without saving; no business records, backend components, permissions, CSP or PoC deployment changed. App configurations retained their existing IDs. [Open this published version](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/cffbecd7-c927-474e-b6ed-6c7957ec74cb?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898&sourcetime=1790109538223).

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

Search, facets and cards reuse the PoC views; connected detail/viewer uses caller-authorized contributor, project and finalized-media reads. The masthead and My submissions expose review navigation only when the server reports the explicit Librarian role. Returning to the library refreshes catalogue state in the background while the current catalogue stays on screen; cards, tiles and the detail page share published-detail reads ([client read reuse](../docs/architecture/technical-architecture.md#client-read-reuse)). Routes never reach PoC write views. The build rejects mock catalogue, IndexedDB adapter, PoC entry-point and demo-document imports. Shared metadata lives in [src/data/catalogueMetadata.ts](src/data/catalogueMetadata.ts).

Connected submission and the PoC now use shared safety, identity, story, contributor-row, media, review-summary, footer and success components from [SubmissionForm](src/components/SubmissionForm.tsx), extracted from the PoC baseline. Both targets also share [TagPicker](src/components/TagPicker.tsx) and the queue plus review-action panel in [ReviewQueue](src/components/ReviewQueue.tsx). One wizard state coordinates core/graph saves; media keeps its protected upload adapter behind the shared stacked layout, caption tiles and file controls. Live effort previews use the backend's 2020-2035 observed US federal holiday policy, with server-calculated totals authoritative at final review. My submissions reuses the PoC card grid and hydrates saved technology chips; owner/reviewer/published detail reuses [DetailView](src/views/DetailView.tsx) and its gallery styling, and both viewers share [ViewerFrame](src/components/ViewerFrame.tsx) and asset-type labels. Document actions download directly through the protected SDK. Connected confirmations use [ConfirmDialog](src/components/ConfirmDialog.tsx), not native confirm boxes. No mock persistence is imported. Complete inheritance, including the remaining gaps, is a requirement: see the [UI/UX parity acceptance inventory](../docs/design/end-to-end-design.md#31-contribution--publication).

Parity checks: `npm run test:ui` renders shared controls and verifies adapter wiring using the existing Vite/React toolchain with an isolated temporary cache. Eight checks cover required field examples, contributor structure, media/linked-asset controls, locked wizard actions and independent review clearance. The current frontend suites contain 16 PoC, 34 connected and 8 UI checks. Both form contents fit mobile widths. Earlier local PoC image-upload automation stalled on `Image.decode()` in a hidden integrated-browser tab and is not counted as a pass; its temporary backup was removed. The connected protected upload path was subsequently verified live as described below. Continue checkpoints, safety reconfirmation and withdrawal remain truthful connected workflows rather than local success simulations.

**Integrated caption saving (2026-09-22):** captions remain in wizard memory across Back navigation and save with Save draft & close or Continue. Protected uploads/removals flush pending captions first. Each confirmed metadata version feeds the next core/graph save, preserves other media metadata and clears safety acknowledgment. Unconfirmed writes keep edits visible and require reopen, never blind retries. No separate Save captions action is needed. Captions are still excluded from tab-reload recovery. Local Play verified PNG and HTML upload, caption save/reopen, a simultaneous summary edit after Back, upload-time caption flush, Continue to final review, and stale-version rejection/reopen. Fixture `ce2e6482-85b6-f111-aaac-6045bd049fba` and its media were deleted through the controlled owner workflow; exactly three original drafts remain. These were privileged-owner tests, not librarian or least-privilege acceptance. No backend deployment, permission changes or app publication occurred.

**Connected persistence:** `#/submit` creates a draft; `#/my-submissions` lists every caller-owned state; `#/submission/:id` inspects/submits/withdraws; `#/submit?draft=<id>` edits owned Drafts. Core limits are name 100, summary/client contexts 200, long descriptions 4000. The story section contains only What it does and Business value. Graph saves persist contributors/effort and native tags/projects. Media uses private server-held sessions and sequential chunks, with read-only finalized access. String versions prevent stale writes; uncertain responses require reopen rather than blind retries. No local-success fallback is used.

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
