# PRISMA — Nextant Solution Library code app PoC

**Status:** PoC published to Power Apps; local searchable contributors, multi-person effort and US-only calendar not yet deployed; hosted UI validation pending.
**Last updated:** 2026-09-18

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
| Multiple builders with individual dates, calendar, allocation and calculated hours | `src/views/SubmitView.tsx`, `src/views/DetailView.tsx`, `src/lib/effort.ts` |
| Searchable Person field by name/email, keyboard selection and duplicate prevention | `src/views/SubmitView.tsx` |
| Captioned screenshot gallery (`nx_solutionimage`) on the detail page | `src/views/DetailView.tsx` |
| Guided seven-step submission form with draft saving, thumbnail + gallery upload | `src/views/SubmitView.tsx` |
| Type-dependent asset behaviour (viewer / pop-out / download / request) | `src/views/DetailView.tsx` |
| Self-contained HTML rendered in a sandbox with no same-origin access | `src/views/ViewerView.tsx` |
| Present mode — catalogue restriction, redaction, suppressed internal notes | `src/App.tsx` |
| Liquid-glass design system, light and dark, reduced-motion aware | `src/index.css` |

Present mode **restricts the catalogue** rather than hiding rows: the source list is filtered before render, which is the client-side mirror of the server-side Dataverse filter the real app will issue.

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

## Contributor effort

The current [schema](../docs/data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort) replaces a Solution's single builder and effort category with contributor rows. Each has a person, inclusive start/end dates, allocation (0-100%) and an automatically assigned US business calendar. Hours = Monday-Friday business days excluding calendar holidays × 8 × allocation / 100, rounded per person to two decimals and then summed. These are calculated capacity hours, not timesheet actuals or deployment duration.

The submission form adds/removes contributors, saves inputs in the session draft, validates calendar coverage and previews totals. Its Person field searches the mock people list by name or email, excludes already assigned people and supports arrow keys/Enter or pointer selection. Escape or leaving the field restores the committed selection; unmatched search text is never stored as a person. This is not a live directory integration. Catalogue search includes every builder. Detail shows a person-by-person breakdown internally; present mode keeps builder names and total hours but omits dates/allocation/calendar details.

All contributors use **US business calendar (2026)** automatically, with no calendar dropdown: Monday-Friday excluding the eleven [OPM observed federal holidays](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/#url=2026), including July 3 for Independence Day. Coverage is January 1-December 31, 2026; state-specific and company holidays are not included. Both demo calendars have been removed; mock records and restored session drafts are reassigned to the US calendar and their totals recalculated. All contribution dates/allocations remain sample data. Production needs reviewed calendars and server-enforced validation/access rules ([ADR-0007](../docs/architecture/decisions/adr-0007-contributor-effort.md)). This change does not create Dataverse tables or publish the app.

## PoC deployment

**[Open PRISMA PoC](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/69a956d5-2180-4ad6-9136-136c48cc197f?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898)**

Published on 2026-09-18. The production build and `pa app push` succeeded; the hosted UI still needs a browser smoke test of search, detail, viewer, present mode, and asset loading.

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

- Dataverse reads and writes — the catalogue is mock data, and the submission form collects a full draft (including thumbnail and gallery uploads, kept in memory) without persisting it anywhere
- The librarian review queue, my-submissions, demo-request writes, and reference-data admin
- Status and shareability facets on the rail (capability / technology / industry are implemented)
- Real demo videos and uploaded HTML payloads — generated stand-ins are used, and clearly labelled
- Security roles and field-level security, which are platform configuration rather than app code
