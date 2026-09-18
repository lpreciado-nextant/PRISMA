# Security model

**Status:** Draft for review, including contributor, calendar and project controls · **Last updated:** 2026-09-18
**Source:** [End-to-end design §7.4](../design/end-to-end-design.md#74-security-model)

## Principles

- **Platform-enforced, not UI-enforced.** Unpublished records are invisible to CSMs at the Dataverse level, not merely filtered in the client.
- **The publication gate is the safety mechanism.** Only the Librarian role can write publication status — enforced by a field-level security profile.
- **Present mode filters server-side.** The query issued in present mode filters on shareability at Dataverse, so a client-visible list can never contain an internal-only record even transiently.

## Role privileges

| Role | `nx_solution` | `nx_demoasset` / `nx_solutionimage` | Reference tables | `nx_demorequest` |
|---|---|---|---|---|
| Contributor | Create; Read/Write **own**; Read published (org) | Same as parent | Read; Create on `nx_technology` only | Read own |
| CSM | Read **published** only | Read (published parents) | Read | Create; Read own |
| Librarian | Full (org) | Full | Full | Full |

`nx_solutioncontributor` follows parent Solution access: Contributors can create/read/write/delete rows only for Solutions they can manage; CSMs read rows for published parents; Librarians have full access. Enforce this through ownership/sharing and platform validation, not by assuming a lookup inherits security. Builder credit grants no additional rights. Business calendars and holiday rows are organization-owned, readable by all internal roles and writable only by Librarians; referenced calendar versions are immutable. Full constraints: [schema v2](../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort).

## Ownership

- `nx_solution`, `nx_solutioncontributor`, `nx_demoasset`, `nx_solutionimage`, `nx_demorequest` and `nx_solutionproject` are **user/team-owned** (row-level security; contributor rows align with the Solution owner/team).
- Reference tables (`nx_specializationarea`, `nx_capability`, `nx_technology`, `nx_industry`, `nx_businesscalendar`, `nx_businesscalendarholiday`) are **organization-owned**.
- `nx_project` retains its existing ownership/security model. Per [schema v2](../data_model/SchemaV2.md#security-model), Contributors create/read/write their own `nx_solutionproject` rows, CSMs read links for detail context, and Librarians have full access. A junction lookup grants no access to the linked Project itself. Client engagement names are omitted in present mode.

## Field-level security

| Column | Rule |
|---|---|
| Publication status | Writable by Librarian only |
| `Library Notes` | Unreadable by the CSM role; never rendered in present mode |

## Authentication

Microsoft Entra ID SSO. Internal Nextant users only — clients never log in. In present mode the CSM is always the authenticated driver, screen-sharing their own session; no client ever holds a credential or a link.

## Content-safety controls

| Control | Where |
|---|---|
| Mandatory shareability + sample-data questions | Submission step 6 |
| Librarian review gate before publication | [Contribution workflow](../workflows/contribution-and-review.md) |
| Dedicated redacted client-context field (`Client Context (Redacted)`) — no runtime string-scrubbing | Schema + [present mode](../workflows/present-mode.md) |
| User-supplied HTML rendered in a sandboxed iframe, restrictive policy, no same-origin access to the host app | Asset viewer |
| Librarian review of uploaded HTML files | [Librarian runbook](../operations/librarian-runbook.md) |
| Per-person dates, allocation, calendar and effort breakdown omitted in present mode; names and total effort may remain | Detail view; not a security boundary for bundled mock data |
