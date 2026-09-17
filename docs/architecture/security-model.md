# Security model

**Status:** Draft for review · **Last updated:** 2026-09-17
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

## Ownership

- `nx_solution` and `nx_demorequest` are **user/team-owned** (row-level security by submitter).
- Reference tables (`nx_specializationarea`, `nx_capability`, `nx_technology`, `nx_industry`) are **organization-owned**.

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
