# Security model

**Status:** Controlled lifecycle and approved code-app CSP configuration verified; effective non-admin acceptance pending · **Last updated:** 2026-09-22
**Source:** [End-to-end design §7.4](../design/end-to-end-design.md#74-security-model)

## Principles

- **Platform-enforced, not UI-enforced.** Unpublished records are invisible to CSMs at the Dataverse level, not merely filtered in the client.
- **The publication gate is the safety mechanism.** Only an authorized librarian can request approval. Synchronous Dataverse transition handlers write protected state after validating caller, record version and prerequisites; contributors cannot directly write publication/review fields.
- **Present mode filters server-side.** Require Published, Safety Acknowledged and Client Safe Reviewed at Dataverse; omit internal client/context, projects and notes from the presentation projection. The PoC mirrors this before search/render, not as a security boundary.

## Role privileges

See [code-app hosting policy](#code-app-hosting-policy) for browser execution restrictions, which do not grant Dataverse permissions.

| Role | `nx_solution` | `nx_demoasset` / `nx_solutionimage` | Reference tables | `nx_demorequest` |
|---|---|---|---|---|
| Contributor | Create; Read/Write **own**; Read published (org) | Same as parent | Read; Create on `nx_technology` only | Read own |
| CSM | Read **published** only | Read (published parents) | Read | Create; Read own |
| Librarian | Full (org) | Full | Full | Full |

`nx_solutioncontributor` follows parent Solution access: Contributors can create/read/write/delete rows only for Solutions they can manage; CSMs read rows for published parents; Librarians have full access. Enforce this through ownership/sharing and platform validation, not by assuming a lookup inherits security. Builder credit grants no additional rights. Full constraints: [schema v2](../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort).

## Ownership

**Deployed ownership:** all 11 exported tables are UserOwned, including reference tables and Consultant. [Q8](../delivery/decision-log.md) retains these existing tables for the approved core-draft scope, with organization-level reference Read; do not recreate them. Solution child links use NoCascade for assign/share/unshare and RemoveLink for delete, so the parent-access contract requires explicit enforcement. Roles cannot grant 'published only' access as a row predicate: publication/unpublication must grant/revoke appropriate row and child access without exposing drafts through another API.

- `nx_solution`, `nx_solutioncontributor`, `nx_demoasset`, `nx_solutionimage`, and `nx_demorequest` are **user/team-owned** (row-level security; contributor rows align with the Solution owner/team).
- Reference tables (`nx_specializationarea`, `nx_capability`, `nx_technology`, `nx_industry`) and `cr6b0_consultant` retain their live **user/team-owned** model; organization ownership was an earlier design assumption, not a migration instruction.
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

[ADR-0008](decisions/adr-0008-controlled-submission-transitions.md) requires synchronous Dataverse Custom APIs for saves and transitions. Draft, graph, mediated media and transition handlers are deployed in Dataverse, not SPA server routes. Handlers resolve authenticated identity, access, state, exact version and the [schema contract](../data_model/SchemaV2.md#draft-and-transition-contract). Never trust contributor-supplied owner or approval fields.

Use narrowly scoped service execution for protected-field updates only after caller checks. A contributor may request Draft/Pending review and cause review invalidation without receiving field permission to publish or approve. Librarian status alone is insufficient for bypassing completeness or stale-version checks. Protect direct Web API/import writes and contributor/image/asset mutations as well: material edits must withdraw a published/pending record and clear Client Safe Reviewed before changed content can be exposed. Reject unsupported bypass paths. Upload files while Draft, finish uploads, and then validate the complete persisted graph before review/publication.

State and related metadata transitions are transactional; file payload uploads are staged separately, not claimed to be atomic with a record transaction. Concurrent edits/reviews must fail visibly rather than approving an obsolete version. Power Automate sends notifications only after committed changes and never authorizes or validates a transition.

The PoC mirrors validation and preserves protected fields from its stored record, but browser storage and the librarian preview are not production authorization or cross-tab concurrency enforcement. Initial PAC inspection found no Custom API, plug-in or role components in `PRISMA_Dev`; the approved deployment below changes that inventory. Effective environment permissions remain unverified.

## Deployed core draft scope

`nx_SaveCoreDraft` requires Solution Create privilege; updates additionally use caller rights, ownership, Draft-state checks and optimistic concurrency. `nx_GetMyCoreDrafts` requires Solution Read and filters active caller-owned Drafts. Neither API accepts a caller/owner override. Only setting Draft and clearing Client Safe Reviewed uses elevated service execution after caller validation, inside the save transaction. Review decisions and Library Notes are not writable through this API.

Solution guards reject direct Create/Update outside controlled APIs and reject Delete/Assign/SetState, including ordinary administrator/import calls. Contributor, media/session metadata and scoped N:N guards are deployed. Owner-only, exact-version deletion in any publication state is mediated by `nx_TransitionSubmission`; it revokes publication shares and removes children/media/sessions without deleting shared references. Native file messages cannot be intercepted: contributors get only read access to team-owned media, with tokens in private sessions ([ADR-0009](decisions/adr-0009-mediated-media-and-publication-access.md)). Additive environment privileges still require verification.

The same transition API accepts Draft-only `media` caption/order and `technology` creation/reuse actions after ownership and exact-version checks. Both advance the parent version and clear acknowledgment/clearance without changing review feedback. Technology creation is caller-owned; existing matches must be caller-readable. Case-insensitive lookup does not guarantee uniqueness across simultaneous requests on different drafts; librarian duplicate governance remains required.

Contributor has Basic Solution Read/Create/Write/Append/AppendTo, Basic contributor Read/Create/Write/Delete/Append and Basic media Read. CSM has Basic Solution/contributor/media Read. Librarian has Global equivalents for Solution/contributor and Global media Read. All have Global governed-reference Read; non-CSMs also have reference AppendTo. No Consultant/Project privileges or direct media Write privileges were added. The Media Custodian team retains its narrow media-Read role and must remain empty; Published Readers has the CSM role and the approved membership below.

Approval shares Solution/contributor/finalized media rows read-only with **PRISMA Published Readers**; withdrawal/retirement revoke those shares. The contributor owner retains finalized-media read access; librarians have trusted Global read. Memberships and field-profile assignments remain manual. **PRISMA Media Custodian must remain empty.** `nx_uploadsession` is organization-owned with no application-role privileges. Administrators remain trusted platform administrators capable of bypass features, not least-privilege test identities.

The review handler requires the explicit **PRISMA Librarian** role directly or through a team, plus caller row access. Administrator status alone was verified insufficient for approval. Approval requires independent client-safe confirmation, complete graph/files and an exact parent version. Feedback survives contributor edits; material graph/media changes clear acknowledgment and clearance. Pending/Published edits require owner withdrawal first.

Pilot inspection confirms `jcastelblanco@nextant.com`, `mcubillos@nextant.com` and `lpreciado@nextant.com` retain System Administrator. Michael's account now exists and had PRISMA Contributor before the approved additions. Administrator accounts can exercise functional workflows but cannot prove draft confidentiality or share revocation. Use non-admin effective role/profile sets before publication. Test cross-owner writes, CSM draft/child/file reads, direct file mutation, reviewer authorization, and withdrawal/retirement revocation.

Review Outcome/Comments are now field-secured. New profiles PRISMA Contributor, PRISMA CSM and PRISMA Core Draft Librarian permit read of publication status/clearance, and non-CSM profiles permit review-field read; they grant no protected-field create/update. The existing **PRISMA Librarian** profile and its memberships were preserved, including its existing editorial/protected-field permissions. Rights are additive: audit all existing roles/profiles and test non-admin identities before rollout. Current live checks used a privileged caller only.

## Approved pilot assignments

The user explicitly approved these additive assignments on 2026-09-22 in Nextant Pulse. Eight missing associations were applied in one `ExecuteTransactionRequest`; Michael's existing Contributor role was preserved. Post-write reads verified the required assignments and all preexisting associations in the checked relationships. A repeat preview reported zero missing additions.

| Account | Pilot function | Role | Field-security profile | Team addition |
|---|---|---|---|---|
| `jcastelblanco@nextant.com` | Contributor A | PRISMA Contributor | PRISMA Contributor | None |
| `mparry@nextant.com` | Contributor B | PRISMA Contributor (preexisting) | PRISMA Contributor | None |
| `lpreciado@nextant.com` | Librarian | PRISMA Librarian | PRISMA Core Draft Librarian | None |
| `mcubillos@nextant.com` | CSM/reader | PRISMA CSM | PRISMA CSM | PRISMA Published Readers |

No roles/profiles were removed or redefined; legacy PRISMA Librarian profile memberships and System Administrator privileges remain. Media Custodian membership, Consultant/Project security, schema and code-app deployment were not changed. Luis's assigned Librarian role now authorizes review. A subsequent [disposable lifecycle test](../workflows/contribution-and-review.md#verified-lifecycle) passed return/resubmit/approval and withdrawal, with all five Published Readers parent/child share masks changing from Read to zero. This is positive functional and explicit-share verification, not effective non-admin access or separate-reviewer acceptance. All three original drafts remain. Other users must sign in through their own authorized sessions; credentials must never be supplied in chat.

## Code-app hosting policy

On 2026-09-22 the user explicitly approved four additive CSP sources for **all code apps in Nextant Pulse** (`ce09ad9b-57d1-e5df-9400-8ce973c86213`), including the separate PoC. This does not affect Nextant Pulse Prod. The change used the supported Power Platform admin center: **Manage > Environments > Nextant Pulse > Settings > Product > Privacy + Security > App (code)**. [Microsoft's documentation](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/content-security-policy) confirms the environment-wide scope and default-source merging.

Before the change, enforcement was On, reporting Off, and every directive used defaults. Only these custom sources were added:

| Directive | Added source | Purpose |
|---|---|---|
| `media-src` | `blob:` | Local/protected video and MediaSource playback, caption tracks |
| `worker-src` | `'self'` | Packaged same-origin compression worker |
| `connect-src` | `'self'` | Packaged WASM asset retrieval |
| `script-src` | `'wasm-unsafe-eval'` | WASM encoder and resumable-upload hashing |

Enforcement remains On and reporting remains Off. All other directives retain defaults; no external domains, wildcards, Blob workers or general JavaScript `'unsafe-eval'` were added. Same-origin fetch/worker and WASM execution are additional browser capabilities for every code app in this environment, not app-specific exceptions. They do not change native authorization, mediated file access, HTML sandboxing or publication checks.

The admin UI persisted the sources after reload. PRISMA's response header independently confirmed `media-src 'self' data: blob:`, `worker-src 'self'`, `connect-src 'self'` and `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`; all other observed directives were unchanged. Azure CLI's management request had failed with `InsufficientDelegatedPermissions` before the successful admin UI change; no extra delegated permissions were granted.

Rollback, with approval: in that same code-app tab, turn **Use default** back On for these four directives only, preserve enforcement/reporting and other settings, save, then reload PRISMA and verify the response header. This restores the prior restrictions and blocks current video/worker paths again. No app republish was needed for either policy application or verification. Hosted checks and their limits are recorded in [published host compatibility](../workflows/demo-assets.md#published-host-compatibility).

## Authentication

Microsoft Entra ID SSO. Internal Nextant users only — clients never log in. In present mode the CSM is always the authenticated driver, screen-sharing their own session; no client ever holds a credential or a link.

User-approved tab recovery stores bounded unsaved text and selections in identity/draft-scoped `sessionStorage`, without credentials or media bytes. It is not offline persistence or a save acknowledgment. Exact-version restoration resets safety confirmation; uncertain writes remain locked until reopen. Save/submit, discard, present entry and detected authentication/identity loss clear recovery. External host sign-out is not observable until authentication failure or reload. See [ADR-0008](decisions/adr-0008-controlled-submission-transitions.md).

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
