# Nextant Solution Library — example row per table (SchemaV2)

**Status:** Illustrative companion, aligned with the two-field story model, authored draft names, draft/review fields, the 2026-09-23 changes (Specialization Area N:N, Client Role), direct minimum hours at every maturity and the CSM derived from Consultant Level instead of the contributor Role (retired and deleted 2026-10-08) · **Last updated:** 2026-10-08
**Companion to:** [SchemaV2.md](SchemaV2.md)

One illustrative row per table in the v2 model, all pointing at the same story so the relationships stay traceable: **S1 — Invoice Reconciliation Assistant**, the same example used in SchemaV2's diagrams. GUIDs below are placeholders (`{table}-001` style), not real Dataverse ids. Sample data only — no real client information.

---

## Reference tables

### `nx_specializationarea`

| nx_specializationareaid | Specialization Area | Description | Sort Order |
|---|---|---|---|
| sa-001 | AI & Automation | Agents, copilots, and workflow automation built on top of an LLM. | 1 |
| sa-002 | Intelligent Business Operations | Process and operations improvement across finance, supply chain and service. | 3 |

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

| cr6b0_consultantid | Name | Consultant Level *(illustrative)* |
|---|---|---|
| con-001 | Juliana Castelblanco | Senior Consultant |
| con-002 | Luis Preciado | Consultant |
| con-003 | Carlos Mejía | Customer Success Manager II |

`cr6b0_consultantlevel` is free text owned by the directory. A level naming customer success (con-003) marks that person as the solution's CSM when they are a contributor; PRISMA never writes it.

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
| Capability | cap-001 — AI & agents |
| Client / Context | Acería del Norte — AP team, 2026 pilot |
| Client Context (Redacted) | A regional manufacturing company |
| Client Role | Chief Financial Officer (CFO) — 125060009 |
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

Tags on this row: `Specialization Area` = AI & Automation, Intelligent Business Operations · `Industry` = Manufacturing · `Technology` = LangChain, Power Automate. These are native N:N relationships, not columns (see [SchemaV2.md](SchemaV2.md#nx_solution)). `Capability` is the only single-valued lookup column on the row above.

For a new incomplete draft, require an authored name such as `Solution Name = Invoice Matcher`, null summary/capability, Publication Status Draft, Review Outcome None, null Review Comments and both safety booleans false. Blank names and the legacy label `Untitled solution` cannot be saved. Contributors and images may be absent. On return, use Draft + Changes requested with actionable comments and both safety booleans false. On resubmission, retain that latest outcome/comments while setting Pending review; outcome alone is not publication clearance. See the [transition contract](SchemaV2.md#draft-and-transition-contract).

---

## Tables related to Solution

### `nx_solutioncontributor`

Every maturity, including this Client demo, uses **Effort Mode = Direct** and **Direct Hours** = the minimum hours each person needed to work on the solution. The retired Start Date and End Date columns are left empty on new rows and are not shown; Allocation (%) and Role were deleted from Dataverse on 2026-10-08. Both people are builders: neither level names customer success.

| nx_solutioncontributorid | Name | Solution | Built By | Effort Mode | Direct Hours |
|---|---|---|---|---|---|
| sc-001 | Invoice Reconciliation Assistant — Juliana Castelblanco | sol-001 | con-001 — Juliana Castelblanco | Direct | 36 |
| sc-002 | Invoice Reconciliation Assistant — Luis Preciado | sol-001 | con-002 — Luis Preciado | Direct | 72 |

Derived (not stored): `Total Effort Hours` for sol-001 = 36 + 72 = **108**.

### `nx_demoasset`

| nx_demoassetid | Name | Solution | Asset Type | File | External URL | Embed Hint | Allows Embedding | Sort Order |
|---|---|---|---|---|---|---|---|---|
| da-001 | Invoice Reconciliation — walkthrough | sol-001 | Self-contained HTML | invoice-recon-demo.html | — | Sign-in may stall in this frame; open in a new tab if blank. | Yes | 1 |

### `nx_solutionimage`

| nx_solutionimageid | Name | Solution | Image | Caption | Sort Order |
|---|---|---|---|---|---|
| si-001 | Invoice Reconciliation Assistant — image 1 | sol-001 | invoice-recon-screenshot-1.png | Exception queue with flagged mismatches | 1 |

### `nx_solutionfavorite`

| nx_solutionfavoriteid | Name | Solution | User | Saved on (`createdon`) |
|---|---|---|---|---|
| fav-001 | Invoice Reconciliation Assistant — Carlos Mejía | sol-001 | con-003 — Carlos Mejía | 2026-09-20 |

The row is visible only to its owner, Carlos's signed-in account. `User` points at `cr6b0_consultant`, not `systemuser`.

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
