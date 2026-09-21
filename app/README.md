# PRISMA — Nextant Solution Library code app PoC

**Status:** Local safety-first submission revision implemented; published Power Apps deployment still reflects the September 18 version. No upload performed for this revision.
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
| My submissions, inspection and editing; no welcome page | `src/views/MySubmissionsView.tsx`, `src/App.tsx` |
| Searchable tag pickers with case-insensitive technology deduplication | `src/views/SubmitView.tsx` |
| Type-dependent asset behaviour (viewer / pop-out / download / request) | `src/views/DetailView.tsx` |
| Self-contained HTML rendered in a sandbox with no same-origin access | `src/views/ViewerView.tsx` |
| Present mode — catalogue restriction, redaction, suppressed internal notes | `src/App.tsx` |
| Liquid-glass design system, light and dark, reduced-motion aware | `src/index.css` |

Present mode **restricts the catalogue** rather than hiding rows: the source list is filtered before render, which is the client-side mirror of the server-side Dataverse filter the real app will issue.

Eligibility requires Published, Safety Acknowledged and librarian-controlled Client Safe Reviewed. Client identity, projects and notes are removed from the present-mode catalogue before search/render; only separately authored anonymous context is shown. Acknowledgment replaces the old sharing/sample-data fields but never grants approval.

Submissions appear in **My submissions** as Pending review, without changing the published catalogue. They and their media remain in memory across navigation until reload. Text drafts use tab storage; media is not restored. No notification, Dataverse write or actual librarian queue entry occurs. New attachments support images, HTML, MP4/WebM video and PDF/PPT/PPTX documents; existing catalogue URL formats remain readable but cannot be newly submitted. See [media rules and local limits](../docs/workflows/demo-assets.md).

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

Calendar-mode contributors use **US business calendar (2026)** automatically, without a dropdown: Monday-Friday excluding the eleven [OPM observed federal holidays](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/#url=2026). Coverage is January 1-December 31, 2026. Direct-mode contributors need no dates or calendar. Mock idea/prototype totals were preserved as direct hours; production migration needs explicit confirmation, reviewed calendars and server-enforced validation ([ADR-0007](../docs/architecture/decisions/adr-0007-contributor-effort.md)). No Dataverse tables were created and the app was not published.

## PoC deployment

**[Open PRISMA PoC](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/69a956d5-2180-4ad6-9136-136c48cc197f?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898)**

Updated on 2026-09-18 with searchable contributors, multi-person effort, the US-only calendar and submission field descriptions with examples only in placeholders. The latest update aligns contributor fields and protects the first contributor from removal. The production build, all seven tests, lint and `pa app push` succeeded; contributor layout and removal were also checked locally at desktop and mobile widths. The hosted UI still needs a browser smoke test of search, detail, viewer, present mode, submission hints, contributor controls and asset loading.

| Setting | Value |
|---|---|
| Display name | PRISMA PoC |
| Environment ID | `ce09ad9b-57d1-e5df-9400-8ce973c86213` |
| App ID | `69a956d5-2180-4ad6-9136-136c48cc197f` |
| Build output / entry point | `dist` / `index.html` |

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

---

## Not in the PoC

Deliberately out of scope so the demo shows only what the platform can actually do:

- Dataverse reads/writes and durable submission/media persistence
- Librarian review UI, demo-request writes, reference-data admin and optional AI writing assistance
- Status facets on the rail (capability / technology / industry are implemented)
- Permission-dependent media submission and access-request controls; some existing catalogue demos still use stand-ins
- Security roles and field-level security, which are platform configuration rather than app code
