# Security model

**Status:** Agreed draft/review field protections and controlled transition contract; platform enforcement pending · **Last updated:** 2026-09-21
**Source:** [End-to-end design §7.4](../design/end-to-end-design.md#74-security-model)

## Principles

- **Platform-enforced, not UI-enforced.** Unpublished records are invisible to CSMs at the Dataverse level, not merely filtered in the client.
- **The publication gate is the safety mechanism.** Only an authorized librarian can request approval. Synchronous Dataverse transition handlers write protected state after validating caller, record version and prerequisites; contributors cannot directly write publication/review fields.
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
| Publication status | No direct contributor write; controlled save/submit/review operations validate the caller; only Librarian may request approval |
| Client Safe Reviewed | Protected write; defaults false; transition handler clears on edits/return; only authorized librarian approval sets true |
| Review Outcome | Owner/authorized editor and Librarian read, no CSM read; only review operation changes latest decision; contributor saves preserve stored value |
| Review Comments | Same permissions as Review Outcome; maximum 4000; nonblank on return; separate from Library Notes |
| `Library Notes` | Librarian-controlled editorial write; unreadable by CSM; never used as contributor-facing review feedback |

All review fields and Library Notes are omitted before CSM/presentation search or rendering, not merely hidden by CSS. Field permissions do not grant access to a row: owner/team/sharing rights still apply.

## Controlled transitions

[ADR-0008](decisions/adr-0008-controlled-submission-transitions.md) requires synchronous Dataverse Custom APIs backed by plug-ins for save draft, submit and review. These are future platform operations, not server routes in the code app. Each handler resolves the authenticated caller, checks parent and child rights, verifies the expected row version, validates the source state and applies the operation-specific [schema contract](../data_model/SchemaV2.md#draft-and-transition-contract). Never trust owner identifiers, review fields or approval flags sent by a contributor.

Use narrowly scoped service execution for protected-field updates only after caller checks. A contributor may request Draft/Pending review and cause review invalidation without receiving field permission to publish or approve. Librarian status alone is insufficient for bypassing completeness or stale-version checks. Protect direct Web API/import writes and contributor/image/asset mutations as well: material edits must withdraw a published/pending record and clear Client Safe Reviewed before changed content can be exposed. Reject unsupported bypass paths. Upload files while Draft, finish uploads, and then validate the complete persisted graph before review/publication.

State and related metadata transitions are transactional; file payload uploads are staged separately, not claimed to be atomic with a record transaction. Concurrent edits/reviews must fail visibly rather than approving an obsolete version. Power Automate sends notifications only after committed changes and never authorizes or validates a transition.

The PoC mirrors validation and preserves protected fields from its current stored record, but browser storage and the visible librarian preview are not production authorization or cross-tab concurrency enforcement. No Custom APIs, plug-ins or field-security profiles have been deployed.

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
