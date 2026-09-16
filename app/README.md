# PRISMA — Nextant Solution Library code app PoC

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

```powershell
npm install
npm run dev          # design preview at http://localhost:5173
```

`npm run dev` warns that `power.config.json` is missing. That is expected until the app is initialized against an environment.

To run it as a real code app and publish:

```powershell
npm install --global @microsoft/power-apps-cli
pa app init --display-name "Nextant Solution Library" --environment-id <environment-id>
pa app run           # open the "Local Play" URL in your Power Platform browser profile
npm run build
pa app push
```

Prerequisites: code apps enabled on the environment (Power Platform admin center → Environments → Settings → Product → Features), and a Power Apps Premium licence for end users.

Optionally hide the Power Apps chrome, which suits present mode:

```powershell
pa app set-setting --show-header false
```

---

## Not in the PoC

Deliberately out of scope so the demo shows only what the platform can actually do:

- Dataverse reads and writes — the catalogue is mock data
- The guided submission form, the librarian review queue, and demo-request writes
- Real thumbnails, videos, and uploaded HTML payloads (generated stand-ins are used, and clearly labelled)
- Security roles and field-level security, which are platform configuration rather than app code
