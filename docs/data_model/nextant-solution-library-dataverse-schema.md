# Nextant Solution Library — Dataverse schema spec

This spec assumes the code app talks to Dataverse via the Web API / Power Platform SDK. Table (logical) names below use an `nx_` publisher prefix — swap for whatever your actual solution prefix is.

## Conventions used throughout

- **Primary key vs primary name column** — every Dataverse table auto-generates a GUID primary key (e.g. `nx_solutionid`). That's separate from the *primary name column*, the required text field used as the row's display label wherever it shows up in a lookup or subgrid. Neither needs to be defined manually beyond picking what the name column represents.
- **System columns are automatic** — `createdon`, `createdby`, `modifiedon`, `modifiedby`, `ownerid`, `statecode`/`statuscode` exist on every table without being modeled. `ownerid` (who can manage the record, security-wise) is distinct from `nx_builtby` below (who gets credited on the card) — related people, not the same column.
- **Global vs local choices** — every Choice column below is called out as **global** or **local**. Global choices are defined once and reused; use them for anything that mirrors the values on your old `Lists` tab, since that's exactly the "add a value and it becomes selectable everywhere" behavior you want.
- **Ownership model** — `Solution` is **user/team-owned** (needs row-level security since different practices submit their own work). `SpecializationArea`, `Capability`, and `Technology` are **organization-owned** (shared reference data — everyone reads them, only admins/library team write to them).
- **Native N:N over custom junction tables** — `Solution_Capability` and `Solution_Technology` don't need any extra attributes of their own (no "date tagged", no "confidence score"), so build them as **native many-to-many relationships** rather than modeling junction tables by hand. Dataverse creates and manages the intersect table for you; you just add a subgrid to the form and query the relationship's navigation property from the code app. This drops two tables from the build.

---

## Reference tables (organization-owned)

### `nx_specializationarea`

| Column | Type | Required | Notes |
|---|---|---|---|
| Specialization Area *(primary name)* | Single line of text (100) | Yes | "AI & Automation", "Data Solutions", "Intelligent Business Operations" |
| Description | Multiple lines of text (plain, 500) | No | Powers the per-tab note in the public app |
| Sort Order | Whole Number | No | Controls tab order |

### `nx_capability`

| Column | Type | Required | Notes |
|---|---|---|---|
| Capability *(primary name)* | Single line of text (100) | Yes | "AI & agents", "Planning & analytics", etc. |
| Sort Order | Whole Number | No | Controls chip order |

### `nx_technology`

| Column | Type | Required | Notes |
|---|---|---|---|
| Technology *(primary name)* | Single line of text (100) | Yes | Open vocabulary — "React", "Dataverse", "Power Apps code app". Don't over-govern this one; it grows organically per solution. |

---

## Core table (user/team-owned)

### `nx_solution`

| Column | Type | Required | Notes |
|---|---|---|---|
| Solution Name *(primary name)* | Single line of text (100) | Yes | |
| One-line Summary | Single line of text (200) | Yes | |
| What It Does | Multiple lines of text (plain, 4000) | No | |
| Business Value | Multiple lines of text (plain, 4000) | No | |
| Specialization Area | Lookup → `nx_specializationarea` | Yes | |
| Built By | Lookup → `systemuser` | Yes | Platform table — no schema work needed, just add the lookup column |
| Status | Choice — **global**, single-select | Yes | See `nx_solutionstatus` below — describes the solution's own maturity |
| Publication Status | Choice — **global**, single-select | Yes | See `nx_publicationstatus` below — describes library visibility, independent of Status |
| Shareable with Clients | Choice — **global**, single-select | Yes | See `nx_shareability` below |
| Sample Data Level | Choice — **global**, single-select | Yes | See `nx_sampledatalevel` below |
| Client / Context | Single line of text (200) | No | Freeform for now; revisit as a lookup if you need to report by client later |
| Date Added | Date Only | No | Business date, distinct from the automatic `createdon` audit timestamp |
| Library Notes | Multiple lines of text (plain, 2000) | No | **Enable field-level security** on this column — internal-only, should not be readable by the app's general audience even if they can see the rest of the row |
| Search Keywords | Single line of text (500) | No | Editorial boost terms not naturally present in the visible text |

**Choice: `nx_solutionstatus`** (global) — Idea / concept · Working prototype · Client demo · Live in production · Retired

**Choice: `nx_publicationstatus`** (global) — Draft · Pending review · Published · Retired

**Choice: `nx_shareability`** (global) — Yes · Yes, with names removed · No – internal only

**Choice: `nx_sampledatalevel`** (global) — Yes – all data is invented · Partly – some real figures · No – contains real client data

> Note on `nx_publicationstatus`: Dataverse's built-in `statecode`/`statuscode` (Active/Inactive + status reason) could technically carry this instead, but state-transition rules are more rigid than a plain choice column and buy you little for a young app with one team managing the workflow. A custom Choice column gives you the same filtering with far less ceremony — reach for native status/state later only if you need workflow automation keyed off record state.

---

## Child table (user/team-owned, inherits visibility from parent Solution)

### `nx_demoasset`

| Column | Type | Required | Notes |
|---|---|---|---|
| Name *(primary name)* | Single line of text (100) | Yes | e.g. auto-set to "{Solution name} demo" |
| Solution | Lookup → `nx_solution` | Yes | 1:N — a solution can have more than one asset (e.g. a live URL plus a fallback video) |
| Asset Type | Choice — **global**, single-select | Yes | Self-contained HTML file · Hosted web app (URL) · Power Apps · Power BI · Desktop app or script · Video walkthrough only |
| File | File column | No | Use when Asset Type is "Self-contained HTML file" — Dataverse's native File column stores the payload directly on the row, no external storage needed |
| External URL | Single line of text, **URL format** (500) | No | Use when Asset Type is a hosted/embedded link |
| Embed Hint | Multiple lines of text (plain, 500) | No | The "sign-in may stall in this frame" style note shown in the viewer |
| Allows Embedding | Yes/No | No | Default Yes; set No for assets that refuse to render in an iframe (X-Frame-Options), so the app knows to go straight to pop-out |

---

## Relationships summary

| From | To | Type |
|---|---|---|
| `nx_solution` | `nx_specializationarea` | N:1 (lookup) |
| `nx_solution` | `systemuser` | N:1 (lookup, built-in table) |
| `nx_solution` | `nx_capability` | Native N:N |
| `nx_solution` | `nx_technology` | Native N:N |
| `nx_demoasset` | `nx_solution` | N:1 (lookup) |

That's 5 custom tables total (`nx_solution`, `nx_demoasset`, `nx_specializationarea`, `nx_capability`, `nx_technology`) plus a lookup to the built-in `systemuser` table and two native N:N relationships that need no tables of their own.

## Open for a later pass

- Security roles (who can create/edit `nx_solution` rows vs. who can only read published ones vs. who can toggle `nx_publicationstatus`)
- Views and forms per specialization area
- Whether `nx_technology` needs any governance at all, or stays a free-for-all tag list
