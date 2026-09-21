# Security model

**Status:** Agreed safety-first contract, including contributor and project controls; platform enforcement pending · **Last updated:** 2026-09-21
**Source:** [End-to-end design §7.4](../design/end-to-end-design.md#74-security-model)

## Principles

- **Platform-enforced, not UI-enforced.** Unpublished records are invisible to CSMs at the Dataverse level, not merely filtered in the client.
- **The publication gate is the safety mechanism.** Only the Librarian role can write publication status — enforced by a field-level security profile.
- **Present mode filters server-side.** Require Published, Safety Acknowledged and Client Safe Reviewed at Dataverse; omit internal client/context, projects and notes from the presentation projection. The PoC mirrors this before search/render, not as a security boundary.

## Role privileges

| Role | `nx_solution` | `nx_demoasset` / `nx_solutionimage` | Reference tables | `nx_demorequest` |
|---|---|---|---|---|
| Contributor | Create; Read/Write **own**; Read published (org) | Same as parent | Read; Create on `nx_technology` only | Read own |
| CSM | Read **published** only | Read (published parents) | Read | Create; Read own |
| Librarian | Full (org) | Full | Full | Full |

`nx_solutioncontributor` follows parent Solution access: Contributors can create/read/write/delete rows only for Solutions they can manage; CSMs read rows for published parents; Librarians have full access. Enforce this through ownership/sharing and platform validation, not by assuming a lookup inherits security. Builder credit grants no additional rights. Full constraints: [schema v2](../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort).

## Ownership

- `nx_solution`, `nx_solutioncontributor`, `nx_demoasset`, `nx_solutionimage`, and `nx_demorequest` are **user/team-owned** (row-level security; contributor rows align with the Solution owner/team).
- Reference tables (`nx_specializationarea`, `nx_capability`, `nx_technology`, `nx_industry`) are **organization-owned**, and so is `cr6b0_consultant`.
- `cr6b0_project` retains its existing ownership/security model. Per [schema v2](../data_model/SchemaV2.md#security-model), the `Solution`↔`cr6b0_project` native N:N association is created/read/written by Contributors for Solutions they own, read by CSMs for detail context, and fully accessible to Librarians — there is no custom junction table, so this governs the relationship itself rather than a row on either side. Associating a Solution with a Project grants no access to the linked Project itself. Client engagement names are omitted in present mode.

## Field-level security

| Column | Rule |
|---|---|
| Publication status | Writable by Librarian only |
| Client Safe Reviewed | Writable by Librarian only; default false, cleared on material edits; acknowledgment cannot grant approval |
| `Library Notes` | Unreadable by the CSM role; never rendered in present mode |

## Authentication

Microsoft Entra ID SSO. Internal Nextant users only — clients never log in. In present mode the CSM is always the authenticated driver, screen-sharing their own session; no client ever holds a credential or a link.

## Content-safety controls

| Control | Where |
|---|---|
| Required upfront acknowledgment of authorized, anonymized content | Submission step 1; renewed on edit |
| Librarian review gate before publication | [Contribution workflow](../workflows/contribution-and-review.md) |
| Dedicated redacted client-context field (`Client Context (Redacted)`) — no runtime string-scrubbing | Schema + [present mode](../workflows/present-mode.md) |
| User-supplied HTML rendered in a sandboxed iframe, restrictive policy, no same-origin access to the host app | Asset viewer |
| Librarian review of uploaded HTML files | [Librarian runbook](../operations/librarian-runbook.md) |
| Per-person dates, allocation, and effort breakdown omitted in present mode; names and total effort may remain | Detail view; not a security boundary for bundled mock data |

Client identity is always internal, regardless of maturity. Anonymous context is authored separately and required when the internal client field is populated. This does not scrub names from descriptions or attachments; their confidentiality must be checked before approval.
