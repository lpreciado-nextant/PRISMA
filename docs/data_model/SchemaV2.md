# Nextant Solution Library — Dataverse schema (v2)

**Status:** Current — agreed model · **Last updated:** 2026-09-17

This is the current, agreed model. It replaces [nextant-solution-library-dataverse-schema.md](nextant-solution-library-dataverse-schema.md) (v1) — refined through several rounds of review: in v1, `Use Case` was already a plain field on `nx_solution` (not a governed table) and `Capability` was already a reference table with a native N:N to `nx_solution`; an earlier v2 draft flattened every tag relationship to a single-valued lookup, but that was reverted for `Capability`, `Industry`, and `Technology` — they stay **native N:N** as in v1, while `SpecializationArea` alone remains a single-valued lookup; a `Project` concept was added (confirmed in scope) to separate "the reusable Solution" from "the evidence it's been built before" — though `nx_project` itself already exists in Dataverse with fixed columns, so it never gets touched directly; and Solution↔Project, which needed to stay many-sided, got its own junction table instead of a single lookup on either side.

## Conventions

- **Primary key vs. primary name** — every table gets an auto-generated GUID key (e.g. `nx_solutionid`) plus a required text *primary name* column, used as its display label in lookups.
- **System columns are automatic** — `createdon`, `createdby`, `modifiedon`, `modifiedby`, `ownerid`, `statecode`/`statuscode` exist on every table without being modeled.
- **Ownership** — `Solution`, `DemoRequest`, and `SolutionProject` are **user/team-owned** (row-level security, since different practices submit their own work). `SpecializationArea`, `Capability`, `Industry`, and `Technology` are **organization-owned** (shared reference data). `nx_project` already exists in Dataverse — its ownership model is out of scope here.
- **One single-valued tag, three multi-valued tags** — each `Solution` points to exactly one `SpecializationArea` via a lookup column. `Capability`, `Industry`, and `Technology` are **native N:N** relationships: a solution can carry several of each, and Dataverse creates and manages the intersect tables — no hand-built junction tables for these three.
- **`nx_project` is fixed** — it already exists in Dataverse with its own columns. Nothing new gets added to it, and it gets no new lookup pointing out of it either. Where a Solution needs to link to *several* Projects, a small junction table (`nx_solutionproject`) sits in between instead.
- **Governance** — `SpecializationArea`, `Capability`, and `Industry` are governed (only the Librarian adds new values). `Technology` is open (anyone adds a value inline; the Librarian periodically merges duplicates).

---

## Visual schema

```mermaid
erDiagram
    nx_specializationarea ||--o{ nx_solution : "tag (1:N)"
    nx_capability }o--o{ nx_solution : "tag (N:N)"
    nx_industry }o--o{ nx_solution : "tag (N:N)"
    nx_technology }o--o{ nx_solution : "tag (N:N)"
    nx_solution ||--o{ nx_demoasset : "1:N"
    nx_solution ||--o{ nx_solutionimage : "1:N"
    nx_solution ||--o{ nx_demorequest : "1:N"
    nx_solution ||--o{ nx_solutionproject : "1:N"
    nx_project ||--o{ nx_solutionproject : "1:N"
    systemuser ||--o{ nx_solution : "Built By"
    systemuser ||--o{ nx_demorequest : "Requested By"
    systemuser ||--o{ nx_project : "Project Owner"

    nx_solution {
        guid nx_solutionid PK
        text SolutionName
        text OneLineSummary
        text WhatItDoes
        text BusinessValue
        lookup SpecializationArea FK
        text UseCase
        text ClientContext
        text ClientContextRedacted
        lookup BuiltBy FK
        choice Status
        choice PublicationStatus
        choice ShareableWithClients
        choice SampleDataLevel
        choice EffortTimeToDeploy
        image Thumbnail
        date DateAdded
        text LibraryNotes
        text SearchKeywords
    }
    nx_specializationarea {
        guid nx_specializationareaid PK
        text SpecializationArea
        text Description
        int SortOrder
    }
    nx_capability {
        guid nx_capabilityid PK
        text Capability
        int SortOrder
    }
    nx_industry {
        guid nx_industryid PK
        text Industry
        int SortOrder
    }
    nx_technology {
        guid nx_technologyid PK
        text Technology
    }
    nx_demoasset {
        guid nx_demoassetid PK
        text Name
        lookup Solution FK
        choice AssetType
        file File
        url ExternalURL
        text EmbedHint
        boolean AllowsEmbedding
        int SortOrder
    }
    nx_solutionimage {
        guid nx_solutionimageid PK
        text Name
        lookup Solution FK
        image Image
        text Caption
        int SortOrder
    }
    nx_demorequest {
        guid nx_demorequestid PK
        text Name
        lookup Solution FK
        lookup RequestedBy FK
        text ClientOpportunityContext
        date NeededBy
        choice RequestStatus
    }
    nx_project {
        guid nx_projectid PK
        text ProjectName
        lookup ProjectOwner FK
    }
    nx_solutionproject {
        guid nx_solutionprojectid PK
        text Name
        lookup Solution FK
        lookup Project FK
    }
```

The three N:N tag relationships (`nx_capability`, `nx_industry`, `nx_technology`) are native Dataverse many-to-many — the intersect tables exist but are platform-managed and not modeled here.

`nx_project` stays untouched — no lookup added to it, no lookup pointing out of it. `nx_solutionproject` is the new junction table that lets one `Solution` link to several `Project` rows (and, structurally, vice versa), without either of those two tables needing a multi-valued column of their own.

---

## Reference tables

Shared, organization-owned vocabularies. `SpecializationArea` connects via a single lookup column on `nx_solution`; `Capability`, `Industry`, and `Technology` connect as native many-to-many tags.

### `nx_specializationarea`

| Column | Type | Required | Notes |
|---|---|---|---|
| Specialization Area *(primary name)* | Text (100) | Yes | AI & Automation · Data Solutions · Intelligent Business Operations |
| Description | Text, multi-line (500) | No | Powers the per-tab note in the public app |
| Sort Order | Whole Number | No | |

1:N with `nx_solution` — each solution has exactly one specialization area, set via a lookup column on `nx_solution`.

### `nx_capability`

Reintegrated after review — dropped from the first v2 draft, brought back with a narrower scope than v1: it only connects to `nx_solution`, nothing else.

| Column | Type | Required | Notes |
|---|---|---|---|
| Capability *(primary name)* | Text (100) | Yes | "AI & agents", "Planning & analytics", etc. |
| Sort Order | Whole Number | No | Controls chip order |

Native N:N with `nx_solution` only — a solution can carry several capabilities. Not connected to `nx_project`.

### `nx_industry`

| Column | Type | Required | Notes |
|---|---|---|---|
| Industry *(primary name)* | Text (100) | Yes | "Financial services", "Manufacturing", etc. Seed a **"Cross-industry"** value for industry-agnostic solutions |
| Sort Order | Whole Number | No | |

Native N:N with `nx_solution` — a solution can carry several industries. Tagging at least one industry (or "Cross-industry") is expected in practice, but enforced at review, not schema-level — Dataverse can't make an N:N relationship required.

### `nx_technology`

| Column | Type | Required | Notes |
|---|---|---|---|
| Technology *(primary name)* | Text (100) | Yes | Open vocabulary — "React", "Power BI", "LangChain". Grows organically. |

Native N:N with `nx_solution` — a solution can carry several technologies.

---

## Main table

### `nx_solution`

The reusable offering — the unit of value shown to a CSM.

| Column | Type | Required | Notes |
|---|---|---|---|
| Solution Name *(primary name)* | Text (100) | Yes | |
| One-line Summary | Text (200) | Yes | |
| What It Does | Text, multi-line (4000) | No | |
| Business Value | Text, multi-line (4000) | No | |
| Specialization Area | Lookup → `nx_specializationarea` | Yes | Single-valued — the only single-valued tag |
| Use Case | Text (200) | No | The client-side framing of the problem — "reduce manual invoice handling", "forecast demand". Bridges how a client describes their pain and how Nextant describes its capability. |
| Client / Context | Text (200) | No | Freeform for now; revisit as a lookup if reporting by client is needed later. **Internal-only** — never rendered in present mode |
| Client Context (Redacted) | Text (200) | No | The client-safe substitute shown in present mode — "a national logistics provider". Required in practice whenever Shareable with Clients is "Yes, with names removed"; enforced at review, not schema-level |
| Built By | Lookup → `systemuser` | Yes | |
| Status | Choice — global | Yes | Idea / concept · Working prototype · Client demo · Live in production · Retired |
| Publication Status | Choice — global | Yes | Draft · Pending review · Published · Retired — **field-level security, Librarian-only write** |
| Shareable with Clients | Choice — global | Yes | Yes · Yes, with names removed · No – internal only |
| Sample Data Level | Choice — global | Yes | Yes – all invented · Partly · No – real client data |
| Effort / Time to Deploy | Choice — global | No | Days · Weeks · Months · Ongoing programme |
| Thumbnail | Image | No | |
| Date Added | Date Only | No | |
| Library Notes | Text, multi-line (2000) | No | **Field-level security** — internal-only |
| Search Keywords | Text (500) | No | Editorial boost terms not naturally present in the visible text — distinct from Use Case, which frames the problem in the client's own words |

Links to `nx_specializationarea` via the single lookup column above. `Capability`, `Industry`, and `Technology` are **not columns** — they attach through native N:N relationships (multi-valued tags, several per solution). Its link to `nx_project` (potentially several) goes through `nx_solutionproject` below, not a column here.

---

## Tables related to Solution

### `nx_demoasset` — the demo

The curated, presentable asset a CSM opens and shows. Unchanged from v1. Required lookup to `nx_solution`; inherits the parent's visibility rules.

| Column | Type | Required | Notes |
|---|---|---|---|
| Name *(primary name)* | Text (100) | Yes | |
| Solution | Lookup → `nx_solution` | Yes | |
| Asset Type | Choice — global | Yes | Self-contained HTML · Hosted web app (URL) · Power Apps · Power BI · Desktop app or script · Video walkthrough · One-pager / slide |
| File | File | No | For self-contained HTML |
| External URL | URL (500) | No | For hosted/embedded links |
| Embed Hint | Text, multi-line (500) | No | The "sign-in may stall in this frame" style note shown in the viewer |
| Allows Embedding | Yes/No | No | |
| Sort Order | Whole Number | No | |

### `nx_solutionimage` — the gallery

Detail-page screenshots beyond the card thumbnail. Unchanged from v1. The `Thumbnail` image column on `nx_solution` stays the single card-grid hero image; this table carries as many captioned screenshots as the story needs. Required lookup to `nx_solution`; inherits the parent's visibility rules.

| Column | Type | Required | Notes |
|---|---|---|---|
| Name *(primary name)* | Text (100) | Yes | Auto: "{Solution name} — image {n}" |
| Solution | Lookup → `nx_solution` | Yes | |
| Image | Image | Yes | The screenshot payload; enable "can store full images" so the detail page isn't limited to the thumbnail rendition |
| Caption | Text (200) | No | Shown under the image in the gallery |
| Sort Order | Whole Number | No | Gallery display order |

### `nx_demorequest` — the live-demo ask

The "request a live demo" escape hatch, and a signal of which solutions the business actually pulls on. Required lookup to `nx_solution`; inherits the parent's visibility rules.

| Column | Type | Required | Notes |
|---|---|---|---|
| Name *(primary name)* | Text (100) | Yes | Auto: "{Solution name} — {Requester}" |
| Solution | Lookup → `nx_solution` | Yes | |
| Requested By | Lookup → `systemuser` | Yes | |
| Client / Opportunity Context | Text, multi-line (1000) | No | |
| Needed By | Date Only | No | |
| Request Status | Choice — global | Yes | New · Acknowledged · Scheduled · Delivered · Declined |

### `nx_project` — the evidence (already exists in Dataverse, fixed columns)

`nx_project` isn't being designed in this document — it already exists as a table in Dataverse, and its columns don't change here at all. The one connection that already lives on it:

- **Project Owner** — Lookup → `systemuser`, already on the existing table.

It gets **no** new lookup — not to `nx_solution`, not to `nx_technology`. Any new relationship to it is modeled from the other side, via the junction table below.

### `nx_solutionproject` — linking Solutions to delivery evidence

New table, fully ours to design (unlike `nx_project`). Its only job is to let one `Solution` connect to several `Project` rows — the reuse signal (G4): the same reusable Solution, delivered to more than one client.

| Column | Type | Required | Notes |
|---|---|---|---|
| Name *(primary name)* | Text (100) | Yes | Auto: "{Solution Name} — {Project Name}" |
| Solution | Lookup → `nx_solution` | Yes | |
| Project | Lookup → `nx_project` | Yes | |

One row = one link. A Solution with three delivered engagements gets three rows here, each pointing to the same Solution and a different Project. A `Project` not yet linked to any Solution simply has no row in this table — that absence *is* the Librarian's classification queue.

### Intake triage: not every legacy record gets linked to a Solution

Nextant already has systems of record for delivered work — the BPM Project Inventory (SharePoint), individual GitHub repos, and whatever the equivalent turns out to be for Data Solutions. Creating a `nx_solutionproject` row to link one of those Project rows to a Solution is a deliberate decision, gated by four questions asked at intake:

1. Is there (or could there easily be) a presentable asset — not just internal automation glue?
2. Could the same approach be repeated for a different client?
3. Would an external prospect recognize the problem it solves?
4. Can it be described without breaking confidentiality? (Answered via the `nx_solution`'s own `Shareable with Clients`.)

A row that fails this — internal tooling maintenance, one-off support tied to a single stakeholder relationship, culture/ops apps with no sales relevance — never gets a `nx_solutionproject` row, or stays in its source system entirely. Nothing here needs to catch up to it; the source system keeps existing independently, and PRISMA doesn't replace it.

---

## Relationships summary

| From | To | Type |
|---|---|---|
| `nx_specializationarea` | `nx_solution` | 1:N |
| `nx_capability` | `nx_solution` | Native N:N |
| `nx_industry` | `nx_solution` | Native N:N |
| `nx_technology` | `nx_solution` | Native N:N |
| `systemuser` | `nx_solution` | 1:N (Built By) |
| `nx_solution` | `nx_demoasset` | 1:N |
| `nx_solution` | `nx_solutionimage` | 1:N |
| `nx_solution` | `nx_demorequest` | 1:N |
| `systemuser` | `nx_demorequest` | 1:N (Requested By) |
| `nx_solution` | `nx_solutionproject` | 1:N |
| `nx_project` | `nx_solutionproject` | 1:N |
| `systemuser` | `nx_project` | 1:N (Project Owner) |

**10 tables in this model:** `nx_solution`, `nx_specializationarea`, `nx_capability`, `nx_industry`, `nx_technology`, `nx_demoasset`, `nx_solutionimage`, `nx_demorequest`, `nx_solutionproject`, and `nx_project` (the last one pre-existing, fixed columns — connected only through the junction table and its own existing `Project Owner` lookup to `systemuser`). The three native N:N intersect tables are platform-managed and don't count toward the build.

**Dropped from v1:** `nx_usecase` as a governed table — the concept now lives as a plain `Use Case` field on `nx_solution`.

**Dropped from the first v2 draft, then reintegrated:** `nx_capability` — brought back as a reference table, scoped to a single connection (`nx_solution` only, not `nx_project`).

**Reverted from the first v2 draft:** the flattening of `Capability`, `Industry`, and `Technology` to single-valued lookups — all three are back to native N:N as in v1, since a solution's profile routinely carries more than one of each. `Industry` also moved from required to optional-with-a-`Cross-industry`-value.

**Dropped from the first v2 draft, and still dropped:** `nx_projectevidence` (no attachments table).

**Changed this round:** the `Solution` ↔ `Project` connection moved off both fixed tables' direct columns entirely and into a new junction table, `nx_solutionproject`. This restores the one-Solution-to-many-Projects reuse signal that a single lookup (on either side) couldn't carry, without ever touching `nx_project`'s fixed columns.

---

## Security model

| Role | `nx_solution` | `nx_demoasset` / `nx_solutionimage` | Reference tables | `nx_demorequest` | `nx_solutionproject` |
|---|---|---|---|---|---|
| Contributor | Create; Read/Write own; Read published | Same as parent | Read; Create on `nx_technology` only | Read own | Create; Read/Write own |
| CSM | Read published only | Read (published parents) | Read | Create; Read own | Read (context on Solution detail) |
| Librarian | Full | Full | Full | Full | Full |

Unpublished `nx_solution` rows stay invisible to CSMs at the platform level. `Publication Status` and `Library Notes` carry field-level security. `nx_project`'s own security model lives with the existing table, not here.

## Still open

- Who creates the `nx_solutionproject` link — the Librarian during triage, or the Contributor who owns the Solution?

*(Resolved: `Capability`, `Industry`, and `Technology` cardinality — settled as native N:N, multi-valued. `nx_project` + `nx_solutionproject` — confirmed in scope.)*

---

## Example: one Solution, several Projects, via the junction table

Each `Solution` has exactly one `SpecializationArea`, but can now link to **several** `Project` rows again — through `nx_solutionproject`, not through a column on either fixed side.

```mermaid
graph LR
    subgraph SA["Specialization Areas"]
        SA1[AI & Automation]
        SA2[Data Solutions]
        SA3[Intelligent Business Operations]
    end

    subgraph SOL["Solutions — nx_solution"]
        S1["S1 Invoice Reconciliation<br/>Published"]
        S2["S2 Customer Churn Predictor<br/>Published"]
        S3["S3 Contract Review Copilot<br/>Published"]
        S4["S4 Warehouse Ops Dashboard<br/>Draft"]
    end

    subgraph JOIN["nx_solutionproject"]
        J1[( )]
        J2[( )]
        J3[( )]
        J4[( )]
    end

    subgraph PROJ["Projects — nx_project (pre-existing)"]
        P1["P1 Acería del Norte"]
        P2["P2 Retail Co X"]
        P3["P3 Banco XYZ — Churn"]
        P4["P4 Banco XYZ — Legal"]
        P5["P5 Client TBD<br/>(no link yet)"]
    end

    SA1 -- 1:N --> S1
    SA1 -- 1:N --> S3
    SA2 -- 1:N --> S2
    SA3 -- 1:N --> S4

    S1 --> J1 --> P1
    S1 --> J2 --> P2
    S2 --> J3 --> P3
    S3 --> J4 --> P4

    style S4 stroke-dasharray: 5 5
    style P5 stroke-dasharray: 5 5
```

S1 links to **both** P1 (Acería del Norte) and P2 (Retail Co X) — the reuse signal is back, carried by two separate `nx_solutionproject` rows, not by either fixed table. S4 (Draft) and P5 (no link yet) are dashed — the same two "pending" states as before, just represented as the *absence* of a junction row rather than an empty lookup.

## Example: everything hanging off one Solution — including a Solution with no Projects yet

Zooming into a single Solution (S1) shows every other table it touches: its specialization-area lookup and N:N tags, the demo asset the CSM opens, a live-demo request raised against it, and — through the junction table — its delivery evidence.

```mermaid
graph TD
    S1["POC Forge"]

    SA1[AI & Automation] -- 1:N --> S1
    CAP1[AI & agents] -- N:N --> S1
    CAP2[Process automation] -- N:N --> S1
    IND1[Manufacturing] -- N:N --> S1
    TECH1[LangChain] -- N:N --> S1
    TECH2[Power Automate] -- N:N --> S1

    S1 -- 1:N --> DA1["nx_demoasset<br/>Hosted web app URL"]
    S1 -- 1:N --> DR1["nx_demorequest<br/>Carlos Mejía — Needed 2026-09-25"]
    S1 -.->|"no nx_solutionproject rows"| NoProj(( ))

    style NoProj stroke-dasharray: 5 5
```

One Solution row is the hub: the tags describe *what it is* (exactly one specialization area, plus as many capabilities, industries, and technologies as apply), with a plain `Use Case` text field for how the client would phrase the problem. `nx_demoasset` is *what a CSM can show*, and `nx_demorequest` is *who's asking for a live one right now* — both stay populated regardless of delivery history. `nx_solutionproject` is the bridge to *proof it already happened*, and `POC Forge` simply has no rows there yet: a reusable Solution the Librarian hasn't linked to a delivered `nx_project` (still fixed, never touched directly), not an error state — it's demoable and requestable on its own until the reuse signal shows up.
