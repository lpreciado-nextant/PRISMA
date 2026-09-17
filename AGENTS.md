# AGENTS.md

Guidance for coding agents working in the PRISMA repository.

## What this project is

PRISMA is Nextant's internal solution library — an internal marketplace where builders publish PoCs/demos/solutions, a librarian curates them, and Customer Success Managers (CSMs) search, browse, and present them live to clients. It is built as a **Power Apps code app** (React 19 + TypeScript + Vite + Tailwind v4) over **Dataverse**, Entra ID SSO, internal users only.

The current state is a **look-and-feel PoC** in [`app/`](app/README.md): all data is an in-memory mock catalogue shaped exactly like the Dataverse schema. There are no Dataverse reads/writes yet. The UI is the deliverable; the data layer is designed to be swapped for generated Power Platform services without touching the UI.

## Repository map

| Path | Contents |
|---|---|
| `app/` | The code app PoC. `src/views/` (Library, Detail, Viewer, Submit), `src/components/`, `src/lib/` (router, search, theme, Power Apps SDK wrapper), `src/data/solutions.ts` (mock catalogue), `src/types.ts`. Present-mode state lives in `src/App.tsx` |
| `docs/README.md` | **Documentation map — start here.** Every project aspect has a dedicated doc |
| `docs/design/end-to-end-design.md` | Source of truth for scope, users, workflows, principles |
| `docs/data_model/` | Dataverse schema spec (column-by-column) + reference-data governance |
| `docs/architecture/` | Technical architecture, security model, ADRs in `decisions/` |
| `docs/workflows/` | Contribution, discovery, demo assets, present mode, demo requests |
| `docs/delivery/` | Roadmap, metrics, risk register, decision log (open questions) |
| `docs/operations/` | Librarian runbook, content health |
| `examples/` | The original HTML prototype — historical visual baseline; do not edit |

## Commands

Run from `app/`:

```powershell
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build
npm run lint     # eslint
```

Or from the repo root, `run-poc.bat` installs, builds, and serves the production bundle at `http://localhost:4173/`.

`npm run dev` warns that `power.config.json` is missing — **expected** until the app is initialized against a Power Platform environment. Don't try to fix it.

## Hard constraints — Power Apps code app

A published code app is served from `/play/e/{environmentId}/a/{appId}`. These rules are not stylistic; violating them breaks the published app:

- **Hash routing only.** All navigation goes through `window.location.hash` via `src/lib/router.ts`. Never introduce path-based routing or a router library that owns the path segment. Routes: `#/`, `#/s/:id`, `#/s/:id/demo/:assetId`, `#/submit`.
- **Single-page app, no server-side code.** No API routes, no SSR, no build-time secrets, nothing sensitive in the bundle.
- **Relative asset references** (`./file.svg`, never `/file.svg`) so assets resolve under the published base path.
- **No `initialize()`.** The Power Apps client library is v1.0+; the only SDK call is `getContext()`, wrapped so the app still renders outside the host.
- **Unsupported in code apps:** Power BI `PowerBIIntegration`, SharePoint form integration, Power Platform Git integration. Don't add them.

## Product invariants

These come from the design principles and must not regress:

- **Present mode restricts, it never merely hides.** The catalogue source list is filtered *before* render (client-side mirror of the future server-side Dataverse filter — ADR-0005). Never implement present-mode safety as CSS hiding or post-render filtering.
- **Redaction uses the dedicated redacted field**, never runtime string-scrubbing of client names.
- **User-supplied HTML renders only in a sandboxed iframe** with a restrictive policy and no same-origin access to the host app (`src/views/ViewerView.tsx`).
- **The hero flow is sacred:** search → grid → detail → viewer must stay fast and unobstructed. Anything adding a click to that path needs to earn it.
- **Accessibility must not regress:** WCAG 2.1 AA — keyboard-navigable, visible focus, `prefers-reduced-motion` respected, semantic landmarks. Checklist in `docs/design/accessibility.md`.
- **Mock data stays schema-shaped.** `src/data/solutions.ts` and `src/types.ts` mirror the Dataverse schema spec (`nx_solution`, `nx_demoasset`, `nx_solutionimage`, reference tables). If you change one, keep the other and the schema doc consistent.

## Design system

Liquid-glass surfaces over an aurora ground; light and dark themes both first-class. Steel blue `#1C567C` base with per-specialization accents. Type: Schibsted Grotesk (display) / Source Sans 3 (body) / IBM Plex Mono. Tokens and surface styles live in `app/src/index.css`; theme logic in `app/src/lib/theme.ts`. Match the existing component idiom in `src/components/` before inventing new patterns. Full spec: `docs/design/design-system.md`.

## Documentation conventions

- `docs/README.md` is the map; each doc owns one aspect and cross-links rather than duplicates. If a detail doc and the end-to-end design disagree, fix the design doc first.
- Every doc carries a **Status** line and **Last updated** date — update both when editing.
- Decisions with lasting technical consequences get an ADR in `docs/architecture/decisions/` (template in its README). Open questions go in `docs/delivery/decision-log.md` until resolved.
- Do not create new markdown files to describe changes you made; update the existing living docs instead.

## Things not to do

- Don't wire up real Dataverse, auth, or Power Automate in the PoC without being asked — its scope is deliberately look-and-feel only.
- Don't edit `examples/nextant-solution-library 1.html`; it is a frozen reference.
- Don't add social features, analytics dashboards, external/client access, or CRM integration — explicitly out of scope for v1.
- Don't self-host or swap fonts without checking the CSP note in `app/README.md`.
