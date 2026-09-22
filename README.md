# PRISMA — Nextant Solution Library

**Status:** Mock PoC preserved; separate connected graph/media/review backend deployed; owner workflow verified; non-admin and librarian acceptance block connected publication.
**Last updated:** 2026-09-22

An internal marketplace for the PoCs, prototypes, demos, and production solutions Nextant builds across its three Specialization Areas — **AI & Automation**, **Data Solutions**, and **Intelligent Business Operations**.

Builders publish what they made, a librarian curates it, and Customer Success Managers browse, search, and present it live to clients. Built as a **Power Platform code app** (React + TypeScript) over **Dataverse**, with Microsoft Entra ID SSO for internal Nextant users only.

## Published PoC

**[Open PRISMA PoC](https://apps.powerapps.com/play/e/ce09ad9b-57d1-e5df-9400-8ce973c86213/app/69a956d5-2180-4ad6-9136-136c48cc197f?tenantId=d232b207-f86f-4fba-8891-ccbf30b12898)** - published on 2026-09-18. Requires app access and a Power Apps Premium licence.

The deployed app uses mock data, with no Dataverse persistence. Build and upload succeeded; hosted UI validation is pending. See [deployment details and update commands](app/README.md#poc-deployment).

The Power Platform solution **`PRISMA_Dev`** exists in **Nextant Pulse** (environment ID: `ce09ad9b-57d1-e5df-9400-8ce973c86213`, not Nextant Pulse Prod). This is distinct from the published code app named **PRISMA PoC**; see [environment and solution context](docs/architecture/technical-architecture.md#environment-and-solution).

The separate connected target implements caller-owned drafts, contributors/tags/projects, protected gallery/attachment uploads, submission/review and published detail/viewer routes, using the server-side 2020-2035 US calendar. Owner persistence and submit/withdraw are verified; successful librarian and least-privilege tests remain open. No connected app was published and no users were assigned. See [connected setup and release gates](app/README.md#connected-prisma-target). The mock PoC remains separate.

The sections below describe the target product, not the current PoC's implemented capabilities.

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

The first step includes specialization area, capability (both single-valued lookups), and multiple builders, searchable by name or email without duplicates. Ideas and working prototypes use direct hours. For client demos and production, each person has inclusive start/end dates and allocation (0-100%); effort uses Monday-Friday excluding observed US federal holidays, enforced in code for 2020-2035. Hours are previewed per person and summed for the solution; [workflow details](docs/workflows/contribution-and-review.md).

### Discovery → presentation (the hero flow)

Search or browse → results grid with facet rail → solution detail → asset viewer → present mode.

Search matches across name, summary, what-it-does, business value, all builder names, tags, and an editorial keyword field, updating as the CSM types. Facets (specialization, capability, technology, industry, status, shareability) are additive, show live counts, and are URL-encoded so a filtered view can be bookmarked or pasted into Teams.

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
- **Native N:N relationships** for solution↔technology/industry and solution↔project; no hand-built junction tables for these. Capability is single-valued (same shape as specialization area), not a tag. Contributor effort uses a child table with relationship attributes, since that link carries dates and allocation.
- **Client-side search.** At ~40 solutions, the published catalogue loads once per session and searches instantly in memory. Documented ceiling: revisit past a few thousand records.
- **Present mode and publication status are enforced at the platform level**, not just in the UI. Unpublished records are invisible to CSMs via security roles; `Library Notes` and `Publication Status` carry field-level security.

---

## Data model

Shared reference/directory tables retain live user/team ownership: `nx_specializationarea`, `nx_capability`, `nx_technology`, `nx_industry`, and existing `cr6b0_consultant`. Global reference Read privileges replace the earlier organization-ownership assumption; Consultant security is unchanged.
Core/child tables (user/team-owned): `nx_solution`, `nx_solutioncontributor`, `nx_demoasset`, `nx_solutionimage`, `nx_demorequest`.
Existing table: `cr6b0_project`, with fixed columns and its existing Project Owner lookup to `cr6b0_consultant`; connected to Solutions only through a native N:N relationship (no junction table).

**12 tables total:** the 11 existing business tables plus private organization-owned `nx_uploadsession` for server-held upload state. Native N:N intersect tables are excluded. The approved empty media-custodian and publication-readers teams and exact schema are documented in [ADR-0009](docs/architecture/decisions/adr-0009-mediated-media-and-publication-access.md).

`nx_solutioncontributor` replaces the single builder lookup and solution-wide effort category. In Calendar mode, one row per Solution/person stores dates and allocation. Person hours = business days × 8 × allocation / 100, rounded to two decimals; total effort sums those rounded hours. `Business Days` counts Monday-Friday between Start Date and End Date, inclusive, excluding observed US federal holidays calculated in code for 2020-2035. There are no calendar tables or contributor calendar lookups; dates outside supported coverage are rejected. These are capacity-based hours, not actual timesheets or deployment lead time. Ideas and working prototypes use directly reported hours instead. See the [schema contract](docs/data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort).

Vocabulary governance: capabilities, industries, and specialization areas are **governed** (librarian-managed); technologies are **open** (contributors extend inline, librarian merges duplicates). `Capability` is single-valued, same shape as `Specialization Area`, not a tag. Use case is a freeform text column on `nx_solution`, not a vocabulary. Industry tags are optional at schema level, with at least one industry or "Cross-industry" expected at review.

Full column-by-column spec: [docs/data_model/SchemaV2.md](docs/data_model/SchemaV2.md)

The [original schema entry point](docs/data_model/nextant-solution-library-dataverse-schema.md) is now a synchronized companion, not an unchanged v1 snapshot. V2 remains authoritative.

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
  README.md                                                Documentation map — start here
  design/                                                  End-to-end design · design system · accessibility
  architecture/                                            Technical architecture · security model · ADRs
  data_model/                                              Dataverse schema spec · reference data governance
  workflows/                                               Contribution · discovery · assets · present mode · demo requests
  delivery/                                                Roadmap · metrics · risks · decision log
  operations/                                              Librarian runbook · content health
examples/
  nextant-solution-library 1.html                          HTML prototype — the visual baseline
run-poc.bat                                                Build and serve the PoC locally
```

The prototype defines the palette (steel blue `#1C567C`, per-specialization accents), typography (Schibsted Grotesk / Source Sans 3 / IBM Plex Mono), light and dark themes, motion, and WCAG 2.1 AA behaviour. The PoC in `app/` evolves that baseline into a liquid-glass design system — same palette and type, translucent refractive surfaces — and is the current visual reference. See [app/README.md](app/README.md) for what it implements.

---

## Open questions

Tracked in the [decision log](docs/delivery/decision-log.md) — librarian ownership, pilot group size, launch timing, source of the initial 40 solutions, code app licensing, demo-request routing, and one-pager templates.