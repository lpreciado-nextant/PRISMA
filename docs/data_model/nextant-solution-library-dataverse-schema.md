# PRISMA — Nextant Solution Library — Dataverse schema spec

> **Legacy entry point, synchronized with v2.** This file retains the original schema layout but now reflects the current tables and contributor-effort model. It is no longer an unchanged historical snapshot. [SchemaV2.md](SchemaV2.md) remains the authoritative specification for implementation, validation and migration rules.
>
> **Status:** Maintained companion to v2, including approved code-based US calendar policy; app alignment pending · **Last updated:** 2026-09-21

This spec assumes the code app talks to Dataverse via the Web API / Power Platform SDK. Table (logical) names below use an `nx_` publisher prefix — swap for whatever your actual solution prefix is.

## Conventions used throughout

- **Primary key vs primary name column** — every Dataverse table auto-generates a GUID primary key (e.g. `nx_solutionid`). That's separate from the *primary name column*, the required text field used as the row's display label wherever it shows up in a lookup or subgrid. Neither needs to be defined manually beyond picking what the name column represents.
- **System columns are automatic** — `createdon`, `createdby`, `modifiedon`, `modifiedby`, `ownerid`, `statecode`/`statuscode` are platform-managed as applicable to table ownership. `ownerid` is distinct from builder credit: each `nx_solutioncontributor` row points to one credited `cr6b0_consultant`. Credit does not grant edit access.
- **Global vs local choices** — every Choice column below is called out as **global** or **local**. Global choices are defined once and reused; use them for anything that mirrors the values on your old `Lists` tab, since that's exactly the "add a value and it becomes selectable everywhere" behavior you want.
- **Ownership model** — `Solution`, `SolutionContributor`, `DemoAsset`, `SolutionImage`, and `DemoRequest` are **user/team-owned**. `SpecializationArea`, `Capability`, `Technology`, and `Industry` are **organization-owned**, and so is `cr6b0_consultant`. `cr6b0_project` already exists; its ownership and columns are unchanged.
- **Native N:N over custom junction tables** — the tagging relationships that stay multi-valued (technology, industry) don't need any extra attributes of their own (no "date tagged", no "confidence score"), so build them as **native many-to-many relationships** rather than modeling junction tables by hand. Dataverse creates and manages the intersect table for you; you just add a subgrid to the form and query the relationship's navigation property from the code app. `Capability`, like `SpecializationArea`, is single-valued instead — a plain 1:N lookup column on `nx_solution`, not a tag. The `Solution`↔`Project` link is native N:N too, for the same reason (no attributes of its own) — see below.
- **Vocabulary governance** — `Capability`, `Industry`, and `SpecializationArea` are **governed**: contributors pick from existing values only, and the library team adds new ones. `Technology` is **open**: contributors can create values inline, and the library team periodically merges duplicates.

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

1:N with `nx_solution` — each solution has exactly one capability, set via a single lookup column, same shape as `SpecializationArea`. Not a tag, not connected to anything else.

### `nx_technology`

| Column | Type | Required | Notes |
|---|---|---|---|
| Technology *(primary name)* | Single line of text (100) | Yes | Open vocabulary — "React", "Dataverse", "Power Apps code app". Don't over-govern this one; it grows organically per solution. |

### `nx_industry`

| Column | Type | Required | Notes |
|---|---|---|---|
| Industry *(primary name)* | Single line of text (100) | Yes | "Financial services", "Manufacturing", "Public sector", etc. Seed "Cross-industry" for industry-agnostic solutions |
| Sort Order | Whole Number | No | Controls chip and facet order |

> Modeled as a table rather than a multi-select Choice column. Multi-select Choice (`MultiSelectPicklist`) can't be filtered efficiently in Dataverse queries and can't carry sort order or future attributes — and industry is a primary CSM facet, so it needs both.

Industry tags are native N:N. At least one industry or "Cross-industry" is expected at review, not schema-required: Dataverse cannot make an N:N relationship required.

---

## Core table (user/team-owned)

### `nx_solution`

| Column | Type | Required | Notes |
|---|---|---|---|
| Solution Name *(primary name)* | Single line of text (100) | Yes | |
| One-line Summary | Single line of text (200) | Yes | |
| What It Does | Multiple lines of text (plain, 4000) | No | |
| Business Value | Multiple lines of text (plain, 4000) | No | |
| Use Case | Single line of text (200) | No | Freeform — the client-side framing of the problem the solution addresses ("reduce manual invoice handling", "forecast demand"). Was a governed `nx_usecase` reference table; folded into a text column to cut governance overhead |
| Specialization Area | Lookup → `nx_specializationarea` | Yes | |
| Capability | Lookup → `nx_capability` | Yes | Single-valued, same shape as Specialization Area |
| Status | Choice — **global**, single-select | Yes | See `nx_solutionstatus` below — describes the solution's own maturity |
| Publication Status | Choice — **global**, single-select | Yes | See `nx_publicationstatus` below — describes library visibility, independent of Status |
| Safety Acknowledged | Yes/No | Yes | Default false; required before entry and at submit, renewed on edit. Replaces sharing/sample-data classifications. |
| Client Safe Reviewed | Yes/No | Yes | Default false; Librarian-only write. Clear on material edits. Present eligibility requires this, acknowledgment and Published. |
| Client / Context | Single line of text (200) | No | Freeform for now; revisit as a lookup if you need to report by client later. **Internal-only** — never rendered in present mode |
| Client Context (Redacted) | Single line of text (200) | Conditional | Required at submit when Client / Context is populated; the only context used in present mode. No runtime scrubbing. |
| Thumbnail | Image column | No | Hero image for the card grid. Fall back to a per-specialization generated placeholder when empty |
| Date Added | Date Only | No | Business date, distinct from the automatic `createdon` audit timestamp |
| Library Notes | Multiple lines of text (plain, 2000) | No | **Enable field-level security** on this column — internal-only, should not be readable by the app's general audience even if they can see the rest of the row |
| Search Keywords | Single line of text (500) | No | Editorial boost terms not naturally present in the visible text |

**Choice: `nx_solutionstatus`** (global) — Idea / concept · Working prototype · Client demo · Live in production · Retired

**Choice: `nx_publicationstatus`** (global) — Draft · Pending review · Published · Retired

> **Field-level security required.** Only the Librarian role may write `Publication Status`; this is the gate that keeps unreviewed work off a client's screen, so it can't rest on UI affordance alone.

The former `nx_shareability` and `nx_sampledatalevel` choices are retired from new submissions. Do not infer client-safe review approval from legacy values or acknowledgment. Retain historical data until an approved real migration; no Dataverse migration is performed by this PoC.

The former solution-level `Built By` lookup and `Effort / Time to Deploy` choice are replaced by `nx_solutioncontributor` rows. Total hours are derived, not an editable field on `nx_solution`. Retire `nx_effortlevel` only after verified migration and confirming no remaining dependencies.

> Note on `nx_publicationstatus`: Dataverse's built-in `statecode`/`statuscode` (Active/Inactive + status reason) could technically carry this instead, but state-transition rules are more rigid than a plain choice column and buy you little for a young app with one team managing the workflow. A custom Choice column gives you the same filtering with far less ceremony — reach for native status/state later only if you need workflow automation keyed off record state.

---

## Child tables (user/team-owned, access aligned to parent Solution)

Required lookups do not automatically inherit Dataverse security. Configure and validate child ownership/sharing so unpublished parent information cannot leak.

### `nx_solutioncontributor`

| Column | Type | Required | Notes |
|---|---|---|---|
| Name *(primary name)* | Text (100) | Yes | Solution/person display label, truncated to 100; not an identity key |
| Solution | Lookup → `nx_solution` | Yes | Parent offering |
| Built By | Lookup → `cr6b0_consultant` | Yes | One credited person per row |
| Effort Mode | Choice: Direct / Calendar | Yes | Direct for ideas/prototypes; Calendar for demos/production; validate against parent maturity |
| Direct Hours | Decimal Number (2 decimal places, minimum 0) | Conditional | Required in Direct mode; finite, nonnegative, includes preparation/discovery; zero is valid |
| Start Date | Date Only | Conditional | Required in Calendar mode; inclusive first day |
| End Date | Date Only | Conditional | Required in Calendar mode; inclusive last day, not before Start Date |
| Allocation (%) | Decimal Number (2 decimal places, 0-100) | Conditional | Required in Calendar mode; zero permitted |

Alternate key: `(Solution, Built By)` prevents duplicate people. Require at least one complete contributor. Validate only the active mode: direct hours, or dates/allocation. Preserve inactive draft inputs on maturity changes, but never total them. Apply the same rules to production writes, not just the UI.

**Calculation:** count Monday-Friday dates in the inclusive range, excluding observed US federal holidays calculated in code for 2020-2035. No calendar tables, lookup, or selector are required. Reject invalid dates, reversed ranges, and dates outside coverage; use year-appropriate holiday rules and account for observed dates crossing year boundaries, as specified in the [contributor contract](SchemaV2.md#nx_solutioncontributor--builders-and-effort). Person hours = `round(business days * 8 * allocation / 100, 2)`; Solution hours = sum of those rounded person totals. Use date-only arithmetic unaffected by time zones or daylight-saving changes. Weekend-only or holiday-only periods yield zero. Example: September 7-18, 2026 at 50% covers nine business days after excluding Labor Day, giving `9 * 8 * 0.5 = 36 hours`.

In Direct mode, use validated Direct Hours without a calendar. Calendar hours represent capacity; direct hours represent reported effort. Neither is deployment duration or a timesheet. Full calculation and migration rules: [contributor contract](SchemaV2.md#nx_solutioncontributor--builders-and-effort).

The Person field searches names/emails, excludes already assigned people, and supports keyboard/pointer selection. Only a selected known person is stored; search text is not a person record. The current PoC searches mock people, not a live directory. See [contribution workflow](../workflows/contribution-and-review.md).

**Migration:** create a contributor row for each former builder, confirm dates/allocation explicitly. Never infer hours from the old Days/Weeks/Months category. App alignment must remove obsolete calendar IDs from mock records and restored drafts without changing their dates, allocations, direct hours, or existing 2026 totals. The app still uses its 2026 in-memory calendar; code-based 2020-2035 support is pending. No real Dataverse migration or deployment has been performed.

### `nx_demoasset`

| Column | Type | Required | Notes |
|---|---|---|---|
| Name *(primary name)* | Single line of text (100) | Yes | e.g. auto-set to "{Solution name} demo" |
| Solution | Lookup → `nx_solution` | Yes | 1:N — a solution can have more than one asset (e.g. a live URL plus a fallback video) |
| Asset Type | Choice — **global**, single-select | Yes | Self-contained HTML file · Hosted web app (URL) · Power Apps · Power BI · Desktop app or script · Video walkthrough only |
| File | File column | Conditional | Required for new HTML, video and one-pager/slides. Dataverse stores the payload; PoC fileData/htmlContent are in-memory stand-ins, not separate schema columns. |
| External URL | Single line of text, **URL format** (500) | No | Use when Asset Type is a hosted/embedded link |
| Embed Hint | Multiple lines of text (plain, 500) | No | The "sign-in may stall in this frame" style note shown in the viewer |
| Allows Embedding | Yes/No | No | Default Yes; set No for assets that refuse to render in an iframe (X-Frame-Options), so the app knows to go straight to pop-out |
| Sort Order | Whole Number | No | Which asset the viewer opens first when a solution has several |

> Asset Type gains **Client-ready one-pager / slide** alongside the original six, so downloadable collateral is modeled as just another asset rather than a separate column on `nx_solution`.

New submissions offer only HTML, video and one-pager/slides, plus gallery images. Other types remain for legacy catalogue reads and are deferred for new submissions. Storage remains Dataverse-only.

### `nx_solutionimage`

Detail images beyond the optional thumbnail. New submissions require one to six gallery rows; the thumbnail does not meet this minimum. Enforce the child count at submission/publication, not through the relationship alone. Legacy examples can predate this rule.

| Column | Type | Required | Notes |
|---|---|---|---|
| Name *(primary name)* | Single line of text (100) | Yes | e.g. auto-set to "{Solution name} — image {n}" |
| Solution | Lookup → `nx_solution` | Yes | 1:N — a solution can have any number of gallery images |
| Image | Image column | Yes | The screenshot payload; enable "can store full images" so the detail page isn't limited to the 144×144 thumbnail rendition |
| Caption | Single line of text (200) | No | Shown under the image in the gallery — "what is the CSM looking at?" |
| Sort Order | Whole Number | No | Gallery display order |

---

## Handoff table (user/team-owned)

### `nx_demorequest`

Supports the "request a live demo" flow — the escape hatch for solutions a CSM can't self-serve, and a useful signal of which solutions the business actually pulls on.

| Column | Type | Required | Notes |
|---|---|---|---|
| Name *(primary name)* | Single line of text (100) | Yes | Auto-composed as "{Solution name} — {Requester}" |
| Solution | Lookup → `nx_solution` | Yes | N:1 |
| Requested By | Lookup → `cr6b0_consultant` | Yes | The CSM raising the request |
| Client / Opportunity Context | Multiple lines of text (plain, 1000) | No | What they need to show, and to whom |
| Needed By | Date Only | No | |
| Request Status | Choice — **global**, single-select | Yes | See `nx_requeststatus` below |

**Choice: `nx_requeststatus`** (global) — New · Acknowledged · Scheduled · Delivered · Declined

## Project evidence

### `cr6b0_project`

Pre-existing Dataverse table with fixed columns and its own security model. Its existing Project Owner lookup points to `cr6b0_consultant`. Do not add columns or outgoing lookups to this table; connect Solutions through the native N:N relationship below. [Project contract](SchemaV2.md#cr6b0_project--the-evidence-already-exists-in-dataverse-fixed-columns).

### `Solution` ↔ `cr6b0_project` — linking Solutions to delivery evidence

No custom junction table. The link carries no attributes of its own (no dates, no notes), so it's modeled as a **native N:N** Dataverse relationship directly between `nx_solution` and `cr6b0_project`, allowing multiple Projects per Solution and multiple Solutions per Project.

No direct Project lookup is added to `nx_solution`, and no Solution lookup is added to `cr6b0_project`. Linking is deliberate intake triage, not automatic import of every legacy engagement. See [project linking and intake](SchemaV2.md#solution--cr6b0_project--linking-solutions-to-delivery-evidence).

---

## Relationships summary

| From | To | Type |
|---|---|---|
| `nx_solution` | `nx_specializationarea` | N:1 (lookup) |
| `nx_solution` | `nx_capability` | N:1 (lookup) |
| `nx_solutioncontributor` | `nx_solution` | N:1 (lookup) |
| `nx_solutioncontributor` | `cr6b0_consultant` | N:1 (Built By) |
| `nx_solution` | `nx_technology` | Native N:N |
| `nx_solution` | `nx_industry` | Native N:N |
| `nx_solution` | `cr6b0_project` | Native N:N |
| `nx_demoasset` | `nx_solution` | N:1 (lookup) |
| `nx_solutionimage` | `nx_solution` | N:1 (lookup) |
| `nx_demorequest` | `nx_solution` | N:1 (lookup) |
| `nx_demorequest` | `cr6b0_consultant` | N:1 (lookup) |
| `cr6b0_project` | `cr6b0_consultant` | N:1 (existing Project Owner) |

**11 tables in the model:** `nx_solution`, `nx_solutioncontributor`, `nx_demoasset`, `nx_solutionimage`, `nx_demorequest`, `nx_specializationarea`, `nx_capability`, `nx_technology`, `nx_industry`, `cr6b0_consultant`, and the pre-existing `cr6b0_project`. This is 9 new custom tables plus `cr6b0_consultant` plus one existing table. The native N:N intersect tables (`Technology`, `Industry`, and `Solution`↔`Project`) are platform-managed and excluded from this count.

## Security model

See the [end-to-end design doc](../design/end-to-end-design.md) for the full rationale. Summary:

| Role | `nx_solution` | `nx_demoasset` / `nx_solutionimage` | Reference tables | `nx_demorequest` |
|---|---|---|---|---|
| Contributor | Create; Read/Write **own**; Read published (org) | Same as parent | Read; Create on `nx_technology` only | Read own |
| CSM | Read **published** only | Read (published parents) | Read | Create; Read own |
| Librarian | Full (org) | Full | Full | Full |

Two things have to hold at the platform level, not just in the UI: unpublished rows are unreadable by the CSM role, and `Publication Status` plus `Library Notes` are locked down by field-level security profiles.

Contributors can create/read/write/delete `nx_solutioncontributor` rows only where they can manage the parent Solution; CSMs read rows for published parents; Librarians have full access. Builder credit alone grants no rights.

The `Solution`↔`Project` native N:N association privileges match [v2 security](SchemaV2.md#security-model): Contributors create/read/write own, CSMs read for detail context, Librarians full. The existing Project security model remains in force. Present mode omits client engagement names and per-person dates and allocation breakdowns; builder names and total effort remain. Bundled mock data is not protected by present mode. See the [security model](../architecture/security-model.md) for platform requirements.

## Open for a later pass

- Views and forms per specialization area
- Whether `nx_technology` needs any governance at all, or stays a free-for-all tag list
- Whether `Client / Context` becomes a lookup once there's a reason to report by client
- Who creates Solution/Project links during intake: the Librarian or the Solution owner
