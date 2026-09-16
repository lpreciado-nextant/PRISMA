# PRISMA — Nextant Solution Library

An internal marketplace for the PoCs, prototypes, demos, and production solutions Nextant builds across its three Specialization Areas — **AI & Automation**, **Data Solutions**, and **Intelligent Business Operations**.

Builders publish what they made, a librarian curates it, and Customer Success Managers browse, search, and present it live to clients. Built as a **Power Platform code app** (React + TypeScript) over **Dataverse**, with Microsoft Entra ID SSO for internal Nextant users only.

---

## Why it exists

Today that work is scattered across individual machines, team channels, and people's memories. When a CSM sits down with a prospect, there's no reliable way to answer *"what have we already built that proves we can do this?"*

Four co-primary goals, all equally weighted in v1:

| # | Goal | What "working" looks like |
|---|---|---|
| G1 | **CSM enablement** | Problem statement to presentable demo in under two minutes, unaided |
| G2 | **Knowledge capture** | Every PoC, demo, and solution has a durable record with an owner, an asset, and context |
| G3 | **Sales acceleration** | Demos surface earlier and more often in the sales cycle |
| G4 | **Internal reuse** | Delivery teams check the library before building — and find prior art |

**Not in v1:** CRM/Dynamics integration, leadership analytics, external client access, social features (ratings/comments), automated demo hosting.

---

## Roles

| Role | Does | Cannot |
|---|---|---|
| **Contributor** (builder) | Creates and edits own records, uploads assets, submits for review | Publish own work; edit others' records |
| **CSM** (consumer) | Searches, filters, opens demos, enters present mode, requests live demos | Edit anything — read-only on published records |
| **Librarian** (admin) | Reviews the queue, edits any record, sets publication status, manages reference data | — |

The Librarian is the **only** role that can publish. That gate is what makes it safe to put a solution on a client's screen.

---

## Team

| Name | Role |
|---|---|
| **Mauricio Cubillos** | Delivery Manager |
| **Luis David Preciado** | Developer |
| **Juliana Castelblanco** | Developer |

---

## Core flows

### Contribution → publication

`Draft → Pending review → Published → Retired`

A guided seven-step submission form with draft saving at every step: what is it → what does it do and why does it matter → tag it → attach the demo → images (card thumbnail + detail screenshots) → safety & sharing → review & submit. Target friction budget is under 10 minutes; beyond that, builders stop submitting and G2 fails.

### Discovery → presentation (the hero flow)

Search or browse → results grid with facet rail → solution detail → asset viewer → present mode.

Search matches across name, summary, what-it-does, business value, tags, and an editorial keyword field, updating as the CSM types. Facets (specialization, capability, technology, industry, status, shareability) are additive, show live counts, and are URL-encoded so a filtered view can be bookmarked or pasted into Teams.

### Present mode

One switch, flipped before screen-sharing. It suppresses internal-only content, **restricts the catalogue server-side** to solutions flagged shareable with clients, applies client-safe redaction via a dedicated redacted-context field, and switches to presentation chrome. State is persistent and obvious; exiting is deliberate.

### Demo assets

Behaviour is type-dependent — the CSM never has to guess what a click will do:

| Asset type | Behaviour |
|---|---|
| Self-contained HTML | Rendered in a sandboxed full-screen viewer from the Dataverse File column |
| Hosted web app (URL) | Embedded if allowed, otherwise opened in a new tab |
| Power Apps / Power BI | Deep-linked out (embedding auth-stalls in frames) |
| Video walkthrough | Played inline — the universal fallback |
| Desktop app / script | Not runnable in-app — video plus "request live demo" |
| One-pager / slide | Download |

Every solution needs at least one asset a CSM can show with no setup. **Request a live demo** is the escape hatch for everything else.

---

## Architecture

```
React + TypeScript code app
  └─ Power Apps SDK
       └─ Dataverse (source of truth)
            ├─ File / Image columns (assets, thumbnails)
            └─ Power Automate → Teams / Outlook (notifications only)
```

Key decisions:

- **Dataverse is the single source of truth.** No separate search index in v1.
- **Assets live in Dataverse File and Image columns** — no external blob storage to provision.
- **Native N:N relationships** for solution↔capability/technology/industry/use-case. No hand-built junction tables.
- **Client-side search.** At ~40 solutions, the published catalogue loads once per session and searches instantly in memory. Documented ceiling: revisit past a few thousand records.
- **Present mode and publication status are enforced at the platform level**, not just in the UI. Unpublished records are invisible to CSMs via security roles; `Library Notes` and `Publication Status` carry field-level security.

---

## Data model

Reference tables (organization-owned): `nx_specializationarea`, `nx_capability`, `nx_technology`, `nx_industry`, `nx_usecase`.
Core tables (user/team-owned): `nx_solution`, `nx_demoasset`, `nx_solutionimage`, `nx_demorequest`.

Vocabulary governance: capabilities, industries, use cases, and specialization areas are **governed** (librarian-managed); technologies are **open** (contributors extend inline, librarian merges duplicates).

Full column-by-column spec: [docs/data_model/nextant-solution-library-dataverse-schema.md](docs/data_model/nextant-solution-library-dataverse-schema.md)

---

## Delivery phases

1. **Foundation** — schema, security roles, seeded reference data, librarian bulk entry of an initial set
2. **Discovery** — card grid, tabs, search, facets, detail, asset viewer
3. **Present mode** — client-safe restriction, redaction, presentation chrome
4. **Contribution** — submission form, drafts, review queue, notifications
5. **Handoff** — demo requests, contributor dashboards, one-pager downloads

Phases 2 and 3 justify the project to a CSM; phase 4 keeps it alive.

---

## Year-one targets

- **40 solutions published**, with **≥8 in each specialization area**
- **Under 2 minutes** median from landing to opening a demo

Remaining metrics (monthly active CSMs, demos in active pursuits, live-demo requests, reuse instances) ship instrumented in v1 and get baselined during the pilot.

---

## Repository

```
app/                                                       Working code app PoC (React + TS + Vite + Tailwind)
docs/
  design/end-to-end-design.md                              Full end-to-end design
  data_model/nextant-solution-library-dataverse-schema.md  Dataverse schema spec
examples/
  nextant-solution-library 1.html                          HTML prototype — the visual baseline
run-poc.bat                                                Build and serve the PoC locally
```

The prototype defines the palette (steel blue `#1C567C`, per-specialization accents), typography (Schibsted Grotesk / Source Sans 3 / IBM Plex Mono), light and dark themes, motion, and WCAG 2.1 AA behaviour. The PoC in `app/` evolves that baseline into a liquid-glass design system — same palette and type, translucent refractive surfaces — and is the current visual reference. See [app/README.md](app/README.md) for what it implements.

---

## Open questions

See [§11 of the design doc](docs/design/end-to-end-design.md) — librarian ownership, pilot group size, launch timing, source of the initial 40 solutions, code app licensing, demo-request routing, and one-pager templates.