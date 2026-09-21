# PRISMA — Nextant Solution Library code app PoC

**Status:** PRISMA PoC remains the published browser-local UI test app; separate unpublished PRISMA target initialized with 11 generated Dataverse services. Connected UI and controlled writes pending; full read/write required before publication. PoC authenticated hosted UI verification remains pending.
**Last updated:** 2026-09-21

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
- **No `initialize()`.** The client library is v1.0+, where initialization was removed. The only SDK call is `getContext()` for the signed-in user, wrapped so the app still renders outside the host.
- **No server-side code.** No API routes, no SSR, no build-time secrets.
- **Relative asset references.** `./nextant-mark.svg` rather than `/nextant-mark.svg`, so assets resolve under the published base path.
- **Nothing sensitive in the bundle.** Compiled assets are served from a public endpoint; all real data will come from Dataverse after authentication.

One soft dependency: fonts load from Google Fonts. Allowed today, but if the tenant later enforces a strict Content Security Policy, self-host the three families instead.

Not used, because code apps don't support them: Power BI `PowerBIIntegration`, SharePoint form integration, Power Platform Git integration.

---

## Running it

From the repo root, double-click `run-poc.bat` — it installs dependencies if needed, builds, and serves the production bundle at `http://localhost:4173/`. Or by hand:

```powershell
cd app
npm install
npm run dev          # design preview at http://localhost:5173
npm test             # Node 22.6+; business-calendar calculations, mock data and builder search
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

The separate [connected/power.config.json](connected/power.config.json) targets **PRISMA** in the same Nextant Pulse environment, with `appId: null`, local URL `http://localhost:5174`, and its own future `dist` output. It has not been published and does not yet have a runnable UI entry point. Port 5174 is configuration only; no connected-app dev server is running. Existing PoC commands, app ID, source entry point and persistence remain unchanged.

PAC generated live models/services for all 11 inventoried tables under [connected/src/generated/index.ts](connected/src/generated/index.ts), plus required metadata under `connected/.power/schemas/`. Keep both generated directories with this target; services import their schema configuration. Generation reads metadata, not business records, and does not create or modify Dataverse rows. Generated CRUD methods do not implement the authorization/transition guarantees in [ADR-0008](../docs/architecture/decisions/adr-0008-controlled-submission-transitions.md); do not wire direct status/review writes into the UI.

The verified non-interactive command, run from `app/connected/`, is:

```powershell
pac code add-data-source --apiId dataverse --table nx_solution --environment https://nextantpulse.crm.dynamics.com
```

Substitute another live logical table name only when adding an unregistered source. Do not run it in `app/`, which targets the mock PoC. The organization URL is not the `/api/data/v9.2` Web API endpoint. PAC 2.10.1 succeeded with the explicit URL; the earlier `pa` attempt rejected an advertised environment flag and then prompted for an organization URL without one.

Generated services type-check against the installed SDK, all 11 table registrations are verified, and `npm run lint` passes. Type-check from `app/`:

```powershell
npx tsc --noEmit --strict --skipLibCheck --target ES2022 --lib ES2022,DOM,DOM.Iterable --module ESNext --moduleResolution bundler --verbatimModuleSyntax connected/src/generated/index.ts
```

**Release gate:** full read/write contribution, file/image persistence, authorized review, concurrency and present-mode enforcement must pass before publishing PRISMA. Metadata generation is not a runtime data-access or permission test. The [integration plan and live-schema gaps](../docs/architecture/technical-architecture.md#connected-app-integration-plan) describe the remaining work. Do not publish a placeholder, copy the PoC app ID, or replace the PoC's mock data source.

---

## Not in the PoC

Deliberately out of scope so the demo shows only what the platform can actually do:

- Dataverse reads/writes, shared production persistence and notifications
- Production review authorization, revision diffs/history, demo-request writes, reference-data admin and optional AI writing assistance
- Status facets on the rail (capability / technology / industry are implemented)
- Permission-dependent media submission and access-request controls; some existing catalogue demos still use stand-ins
- Security roles and field-level security, which are platform configuration rather than app code
