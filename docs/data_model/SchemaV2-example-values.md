# Nextant Solution Library — example row per table (SchemaV2)

**Status:** Illustrative companion, aligned with the two-field story model, authored draft names, draft/review fields and code-based US holiday policy · **Last updated:** 2026-09-22
**Companion to:** [SchemaV2.md](SchemaV2.md)

One illustrative row per table in the v2 model, all pointing at the same story so the relationships stay traceable: **S1 — Invoice Reconciliation Assistant**, the same example used in SchemaV2's diagrams. GUIDs below are placeholders (`{table}-001` style), not real Dataverse ids. Sample data only — no real client information.

---

## Reference tables

### `nx_specializationarea`

| nx_specializationareaid | Specialization Area | Description | Sort Order |
|---|---|---|---|
| sa-001 | AI & Automation | Agents, copilots, and workflow automation built on top of an LLM. | 1 |

### `nx_capability`

| nx_capabilityid | Capability | Sort Order |
|---|---|---|
| cap-001 | AI & agents | 1 |
| cap-002 | Process automation | 2 |

### `nx_industry`

| nx_industryid | Industry | Sort Order |
|---|---|---|
| ind-001 | Manufacturing | 3 |

### `nx_technology`

| nx_technologyid | Technology |
|---|---|
| tech-001 | LangChain |
| tech-002 | Power Automate |

### `cr6b0_consultant`

| cr6b0_consultantid | Name |
|---|---|
| con-001 | Juliana Castelblanco |
| con-002 | Luis Preciado |
| con-003 | Carlos Mejía |

---

## Main table

### `nx_solution`

| Column | Value |
|---|---|
| nx_solutionid | sol-001 |
| Solution Name *(primary name)* | Invoice Reconciliation Assistant |
| One-line Summary | Matches vendor invoices to POs and flags mismatches automatically. |
| What It Does | Ingests incoming invoices, extracts line items, and reconciles them against open purchase orders, routing exceptions to an approver queue. |
| Business Value | Cuts manual reconciliation time and reduces duplicate/incorrect payments. |
| Specialization Area | sa-001 — AI & Automation |
| Capability | cap-001 — AI & agents |
| Client / Context | Acería del Norte — AP team, 2026 pilot |
| Client Context (Redacted) | A regional manufacturing company |
| Status | Client demo |
| Publication Status | Published |
| Review Outcome | Approved |
| Review Comments | Client-visible descriptions and media reviewed; cleared for publication. |
| Safety Acknowledged | Yes |
| Client Safe Reviewed | Yes, after librarian verification of anonymized text and media |
| Thumbnail | invoice-reconciliation-thumb.png |
| Date Added | 2026-06-02 |
| Library Notes | Internal catalogue curation note; separate from contributor review feedback. |
| Search Keywords | AP automation, invoice matching, PO reconciliation |

Tags on this row: `Industry` = Manufacturing · `Technology` = LangChain, Power Automate (native N:N, not columns — see [SchemaV2.md](SchemaV2.md#nx_solution)). `Specialization Area` and `Capability` are both single-valued lookup columns on the row above, not tags.

For a new incomplete draft, require an authored name such as `Solution Name = Invoice Matcher`, null summary/capability, Publication Status Draft, Review Outcome None, null Review Comments and both safety booleans false. Blank names and the legacy label `Untitled solution` cannot be saved. Contributors and images may be absent. On return, use Draft + Changes requested with actionable comments and both safety booleans false. On resubmission, retain that latest outcome/comments while setting Pending review; outcome alone is not publication clearance. See the [transition contract](SchemaV2.md#draft-and-transition-contract).

---

## Tables related to Solution

### `nx_solutioncontributor`

Both rows use **Effort Mode = Calendar** and **Direct Hours = not applicable**, because the parent is a Client demo. Ideas and working prototypes instead require Direct Hours and do not require the Start Date/End Date/Allocation inputs below.

| nx_solutioncontributorid | Name | Solution | Built By | Effort Mode | Direct Hours | Start Date | End Date | Allocation (%) |
|---|---|---|---|---|---|---|---|---|
| sc-001 | Invoice Reconciliation Assistant — Juliana Castelblanco | sol-001 | con-001 — Juliana Castelblanco | Calendar | — | 2026-09-07 | 2026-09-18 | 50 |
| sc-002 | Invoice Reconciliation Assistant — Luis Preciado | sol-001 | con-002 — Luis Preciado | Calendar | — | 2026-09-08 | 2026-09-18 | 100 |

Derived (not stored): sc-001 → 9 business days × 8h × 50% = **36 effort hours**, excluding Labor Day on 2026-09-07; sc-002 → 9 business days × 8h × 100% = **72 effort hours**, since its range starts after Labor Day; `Total Effort Hours` for sol-001 = **108**. Observed US federal holidays are calculated in code under the agreed 2020-2035 policy, with no calendar table or contributor calendar lookup.

### `nx_demoasset`

| nx_demoassetid | Name | Solution | Asset Type | File | External URL | Embed Hint | Allows Embedding | Sort Order |
|---|---|---|---|---|---|---|---|---|
| da-001 | Invoice Reconciliation — walkthrough | sol-001 | Self-contained HTML | invoice-recon-demo.html | — | Sign-in may stall in this frame; open in a new tab if blank. | Yes | 1 |

### `nx_solutionimage`

| nx_solutionimageid | Name | Solution | Image | Caption | Sort Order |
|---|---|---|---|---|---|
| si-001 | Invoice Reconciliation Assistant — image 1 | sol-001 | invoice-recon-screenshot-1.png | Exception queue with flagged mismatches | 1 |

### `nx_demorequest`

| nx_demorequestid | Name | Solution | Requested By | Client / Opportunity Context | Needed By | Request Status |
|---|---|---|---|---|---|---|
| dr-001 | Invoice Reconciliation Assistant — Carlos Mejía | sol-001 | con-003 — Carlos Mejía | Prospect evaluating AP automation for Q4 renewal. | 2026-09-25 | Scheduled |

### `cr6b0_project` (pre-existing, fixed columns)

| cr6b0_projectid | Project Name | Project Owner |
|---|---|---|
| proj-001 | Acería del Norte | con-001 — Juliana Castelblanco |

### `Solution` ↔ `cr6b0_project` (native N:N, no junction table)

sol-001 (Invoice Reconciliation Assistant) links to proj-001 (Acería del Norte) through the native N:N relationship — a platform-managed intersect row, not a table modeled here.
