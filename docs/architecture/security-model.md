# Security model

**Status:** Dev capability-owner SA scope and role migration deployed 2026-10-26; five dev owners provisioned and Luis assigned the global override. Production group contributor/reader access and named global librarians configured; classification-reference Append privileges corrected in dev and production after Juliana's save failure. Four licensing exceptions and effective non-admin acceptance remain open · **Last updated:** 2026-10-26
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
| Librarian | Basic own/published access; scoped review/edit via plug-ins | Basic Read; scoped mediated reads/writes | Global Read/AppendTo; administration separately provisioned | Separately provisioned |

`nx_solutioncontributor` follows parent Solution access: Contributors can create/read/write/delete rows only for Solutions they can manage; CSMs read rows for published parents; librarians read scoped contributor data through the APIs but cannot change contributor credit through the librarian editor. Enforce this through ownership/sharing and platform validation, not by assuming a lookup inherits security. Builder credit grants no additional rights. Full constraints: [schema v2](../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort).

## Capability-owner librarian access

**Deployed 2026-10-26.** This section supersedes global librarian workflow access in the historical deployment sections below. [ADR-0013](decisions/adr-0013-librarian-content-editing.md#capability-owner-scope-2026-10-26) owns the decision.

The server resolves `systemuser.internalemailaddress` to exactly one active `cr6b0_consultant.cr6b0_email`. For a direct/team **PRISMA Librarian**, active `nx_capability` rows whose `nx_capabilityowner` matches that Consultant grant their active `nx_specializationarea`. They may manage solutions with any active **main** capability in those SAs. Secondary capabilities never expand authority. Missing mappings grant no scope; ambiguous/missing Consultant identity raises an explicit error. Owning capabilities in several SAs grants all those SAs. An explicitly assigned **PRISMA Global Librarian** marker role overrides scope; the regular role and System Administrator alone do not. Self-approval within scope is allowed, with normal safety/completeness/version checks.

`LibrarianAccess` applies this policy to review pagination, submission detail, transitions, core/graph/media changes, suggestions and range downloads. Core reclassification must be authorized on both sides; a global librarian handles transfers outside the caller's SAs. Ordinary owner Draft edits and published browsing remain unchanged. Scoped operations use server rights only after checks; direct writes remain guarded. Image downloads use the existing range API with `Mode=image`; its parent/asset relationship, active state, publication/owner/scope and pinned version are checked before returning bytes. It cannot read an attachment by using image mode. No storage tokens or URLs are exposed.

### Coordinated rollout and provisioning

The user approved plug-in/app deployment and separately approved the live role migration on 2026-10-26. Steps 1-3 were completed; user/team/profile assignments were explicitly excluded. Future deployment/live permission changes still require approval.

1. Fast-forward to `origin/main` and deploy the tested, signed plug-in through the normal managed-identity process. Existing role holders who lack capability ownership will lose workflow access unless explicitly assigned the global override.
2. Publish the compatible connected app. It reads `solutionId` on media snapshots and mediates images and contextual attachment downloads. The PoC is unchanged. Verify PNG/JPEG images and both Dataverse/Blob attachments before lowering privileges.
3. Preview from the repository root: `dotnet backend\Prisma.Deploy\bin\Debug\net10.0\Prisma.Deploy.dll librarian-access`. The command inspects all normal librarian role copies and historical completed upload shares. With separately approved `--execute`, it atomically removes/replaces the Solution/contributor/media privileges at **Basic** depth, removes unsupported operations, replaces historical non-owner uploader shares with owner read access, and creates an **unassigned** global marker role in `PRISMA_Dev`. It preserves unrelated role privileges, publication-reader shares and existing assignments. Re-running reconciles the same desired privileges. The normal `apply` provisioning path also grants only Basic depth on these tables; it is not a replacement for the migration because additive grants alone do not downgrade old privileges.
4. Provision each Capability Owner's normal **PRISMA Librarian** role, **PRISMA Core Draft Librarian** profile and normal app/reference access. Maintain the Consultant email, active capability owner and SA lookups; no new table is needed. Assign **PRISMA Global Librarian** only to approved global curators, alongside a normal app role/profile. The migration does not assign users, teams or profiles.
5. Audit **effective additive access**: other roles (especially System Administrator), team ownership/membership, field profiles and ad-hoc row shares can independently grant reads. The migration does not remove unrelated grants or turn the application into an administrator security boundary. Review any extra shares on unpublished solutions and their children before declaring the restriction effective.
6. Test with least-privilege accounts in two SAs: own/different capability in the same SA; a secondary-only SA match; multi-SA ownership; own-submission approval; out-of-scope guessed IDs and classification transfer; global override; role/owner revocation; all review tabs and paging; image/attachment reads, upload/resume/remove and caption edits; owner/CSM published browsing, withdrawal and present-mode checks. Verify direct Dataverse reads of another SA's unpublished solutions and media are denied, including media uploaded by a former librarian.

**Deployment evidence (2026-10-26, completed by 15:29 UTC):** deployed from `main`, synchronized with `origin/main` at `aa2e4e1`, plus this task's changes. The Release assembly was signed with the existing pilot certificate and the deployment utility verified its signer against the installed managed-identity-bound assembly. Installed SHA-256: `82C07E54281D19CC886855ABA69B6E41DFFEE67828E34F26059C1E274F775507`. The managed identity and global graph guards remain bound/active. The connected PRISMA app (`cffbecd7-c927-474e-b6ed-6c7957ec74cb`) was pushed to `PRISMA_Dev` with explicit solution ID; bundle `index-CKDnd4jf.js`, returned `sourcetime=1793028368558`.

The approved `librarian-access --execute` migrated the existing normal librarian role and verified Basic-depth Solution/contributor/media privileges. It revoked two historical non-owner uploader shares (one image, one attachment), granted their solution owners Read, and created the unassigned **PRISMA Global Librarian** marker role. A subsequent preview proposed no remaining media-share corrections. No user/team/profile assignments or solution-content changes were made.

Read-only verification checked the exact deployed assembly, four catalogue solutions in both internal and present modes, two owned submission modification timestamps, submission detail classification, and 1,024-byte protected image and attachment reads with matching parent/type/size. `verify-librarian-access` provides a repeatable read-only check. The deploying account returned `librarian=false`, consistent with no mapped scope/global assignment; this is not a substitute for provisioning the real owners.

The deployment's initial hosted browser verification stopped at the Microsoft sign-in redirect. The separately approved provisioning and subsequent signed-in check are recorded below. The effective additive-permission audit and least-privilege cross-account acceptance remain open.

### Approved librarian provisioning (2026-10-26)

The user explicitly approved five capability-owner recipients and Luis David Preciado as the only new global recipient. `Prisma.Deploy librarian-provision` applied **15 additive associations in one transaction**, verified all required effective memberships, and verified preservation of preexisting direct roles, field profiles and teams. A subsequent read-only preview proposed **zero additions**.

| Recipient | Email | Workflow scope | Verified effective access |
|---|---|---|---|
| Andres Perez | `aperez@nextant.com` | AI & Automation | PRISMA Librarian; PRISMA Core Draft Librarian profile; Published Readers |
| Mauricio Cubillos | `mcubillos@nextant.com` | AI & Automation | Same; existing reader membership preserved |
| Patricia Méndez | `pmendez@nextant.com` | AI & Automation | Same; existing librarian role preserved |
| Jorge Isaias Ardila | `j.ardila@nextant.com` | Data Solutions | PRISMA Librarian; PRISMA Core Draft Librarian profile; Published Readers |
| Valentina Velosa | `vvelosa@nextant.com` | Intelligent Business Operations | PRISMA Librarian; PRISMA Core Draft Librarian profile; Published Readers |
| Luis David Preciado | `lpreciado@nextant.com` | **Global override** | Existing librarian role/profile preserved; PRISMA Global Librarian and Published Readers added |

No roles/profile definitions, capability ownership, schema, solution content, app sharing or licences were changed. Existing unrelated privileges, including administrator privileges, were not removed.

**Blocked owners:** the following active Consultant emails have no matching Dataverse user by stored email or sign-in name in this environment: Shashank Saxena (`ssaxena@nextant.com`), Jessica Wilson (`jwilson@nextant.com`), Catalina Vasquez (`cvasquez@nextant.com`), Mary Thomason (`mthomason@nextant.com`), Antonio Alvarez (`aalvarez@nextant.com`), Lucia Bustillo (`lbustillo@nextant.com`), Gerson Salinas (`gsalinas@nextant.com`) and Juan Pablo Sarmiento (`jsarmiento@nextant.com`). No assignment was attempted for them. An environment administrator must confirm their Entra identity, licence and environment/security-group eligibility, add or enable the correct user in **Nextant Pulse**, and ensure its email uniquely matches the active Consultant. Do not create duplicate Consultants, guess a similarly named user or grant the global override to work around a mapping issue.

**Repeatable commands** (repository root; the existing organization guard remains in force):

```powershell
dotnet backend\Prisma.Deploy\bin\Debug\net10.0\Prisma.Deploy.dll librarian-provision
dotnet backend\Prisma.Deploy\bin\Debug\net10.0\Prisma.Deploy.dll librarian-provision --owner user@nextant.com
dotnet backend\Prisma.Deploy\bin\Debug\net10.0\Prisma.Deploy.dll librarian-provision --global curator@nextant.com
```

The first command is inventory only. Named-recipient commands preview missing role/profile/Published Readers associations; repeat `--owner`/`--global` for several users. Append `--execute` only after approval of those exact recipients and changes. `--owner` requires a unique enabled human user mapped to a unique active Consultant owning an active capability in an active SA. Existing effective team-inherited roles/profiles are recognized. The command does not automatically remove access from former owners: the plug-in immediately stops their scoped workflow access when ownership no longer matches, while role/profile cleanup and global-role removal remain separate approved operations.

**Verification:** Luis's API response changed from `librarian=false` to `true`; his global review queue returned seven records. In the shared signed-in hosted app, refreshing and opening Review queue displayed **0 Pending review, 3 Changes requested, 4 Published**. Protected image/attachment reads also passed. Attempts to validate other users by SDK impersonation failed the effective-identity check before scoped API tests; no per-owner behavioral acceptance is claimed. Each owner must still sign in, confirm app sharing/licensing and exercise positive in-SA and negative out-of-SA paths. Onboarding the eight unmatched owners and the additive-privilege/write acceptance gates remain open.

## Ownership

**Deployed ownership:** all 11 exported tables are UserOwned, including reference tables and Consultant. [Q8](../delivery/decision-log.md) retains these existing tables for the approved core-draft scope, with organization-level reference Read; do not recreate them. Solution child links use NoCascade for assign/share/unshare and RemoveLink for delete, so the parent-access contract requires explicit enforcement. Roles cannot grant 'published only' access as a row predicate: publication/unpublication must grant/revoke appropriate row and child access without exposing drafts through another API.

- `nx_solution`, `nx_solutioncontributor`, `nx_demoasset`, `nx_solutionimage`, and `nx_demorequest` are **user/team-owned** (row-level security; contributor rows align with the Solution owner/team).
- Reference tables (`nx_specializationarea`, `nx_capability`, `nx_technology`, `nx_industry`, and `nx_clientrole` since 2026-10-21) and `cr6b0_consultant` retain their live **user/team-owned** model; organization ownership was an earlier design assumption, not a migration instruction.
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

**Full-access additions (2026-10-14).** At the user's request, `ssanchez@nextant.com`, `avega@nextant.com` and `esamudio@nextant.com` now hold Basic User plus the PRISMA Contributor, PRISMA CSM and PRISMA Librarian roles; the PRISMA Contributor, PRISMA CSM, PRISMA Core Draft Librarian and legacy PRISMA Librarian field profiles; and PRISMA Published Readers membership. Andrés and Ernesto were added to the environment with `pac admin assign-user`. Profiles and team membership were added additively through the Dataverse Web API. A post-write read verified every assignment. All three already had CanView on the connected code app. Sebastián then got "Catalogue unavailable": `nx_GetCatalogueGraph` with `Present=false` needs the caller's read on `cr6b0_consultant` (contributor names and levels), and the PRISMA roles deliberately grant no Consultant/Project privileges. All three were given the existing **Basic Nextant User Role**, the org baseline with Global Consultant/Project read. After that, an impersonated replay of the startup reads and APIs (solutions, capabilities, catalogue graph in both modes, favorites, published detail) succeeded for each account. Non-admin users need that baseline role, or another existing role with Consultant read, in addition to the PRISMA roles. Sebastián's preexisting direct **PRISMA Media Custodian** role was not changed, and nobody was added to the Media Custodian team. None of these accounts is a System Administrator, so Andrés and Ernesto are candidate non-admin identities for the pending least-privilege acceptance.
## Production access (2026-10-26)

The user explicitly selected **only Luis David Preciado** (`lpreciado@nextant.com`) for initial production access, including contributor, reader and global-librarian capabilities. In Nextant Pulse Prod, 12 additive operations were applied in one transaction and read back:

- Created owner team **PRISMA Media Custodian**, ID `e4aee220-0557-4c04-950c-fb5b97f01bb0`, in the root business unit and assigned only its existing PRISMA Media Custodian role. Membership remains **zero**.
- Created owner team **PRISMA Published Readers**, ID `93a0ac77-67e3-4e54-823c-7245545e6f78`, and assigned the existing PRISMA CSM role.
- Added PRISMA Contributor, PRISMA CSM, PRISMA Librarian and PRISMA Global Librarian roles to Luis (`systemuserid=54f1df0e-a557-f011-877a-6045bdd9a71f`), plus PRISMA Contributor, PRISMA CSM and PRISMA Core Draft Librarian field-security profiles and Published Readers membership.

Existing direct roles, field profiles and teams were preserved and verified, including Luis's preexisting System Administrator role. No other user, app sharing, licence, role definition, field-profile definition or Consultant/Project privilege was changed. Seeding capability-owner lookups did not onboard those owners. Review-queue access and the disposable workflow passed, but **these are same-account administrator checks, not least-privilege or cross-account acceptance**. The [production runbook](technical-architecture.md#production-deployment-preflight) owns the media and cleanup evidence. Onboard other users only after an approved recipient/role list and baseline Consultant/Project read access review.

### Additional production recipients (2026-10-26)

The user explicitly requested contributor access for `jcastelblanco@nextant.com` and access for all capability owners. The current active production capabilities resolved to 13 distinct owners, each with one active Consultant and one enabled human Dataverse user. Juliana also resolved uniquely. All 14 already held Basic User and Basic Nextant User Role directly or through teams; no baseline roles or licences were added.

Applied **42 additive Dataverse associations in one transaction**, then read back every required role, profile and Published Readers membership and verified preservation of prior direct memberships. Juliana received PRISMA Contributor and its field-security profile. Each owner received PRISMA Librarian and PRISMA Core Draft Librarian profile, with workflow scope derived from their active capability areas, not the Global Librarian override.

| Recipient | Production PRISMA role / workflow scope |
|---|---|
| `jcastelblanco@nextant.com` | Contributor |
| `aalvarez@nextant.com` | Librarian / Data Solutions |
| `aperez@nextant.com` | Librarian / AI & Automation |
| `cvasquez@nextant.com` | Librarian / Intelligent Business Operations |
| `gsalinas@nextant.com` | Librarian / Data Solutions |
| `j.ardila@nextant.com` | Librarian / Data Solutions |
| `jsarmiento@nextant.com` | Librarian / Data Solutions |
| `jwilson@nextant.com` | Librarian / Intelligent Business Operations |
| `lbustillo@nextant.com` | Librarian / Data Solutions |
| `mcubillos@nextant.com` | Librarian / AI & Automation |
| `mthomason@nextant.com` | Librarian / Intelligent Business Operations |
| `pmendez@nextant.com` | Librarian / AI & Automation |
| `ssaxena@nextant.com` | Librarian / AI & Automation |
| `vvelosa@nextant.com` | Librarian / Intelligent Business Operations |

Shared production app `57f5ef47-d997-4323-a8b8-0c4bf6a9a529` with those exact Entra object IDs as **CanView**, using the `modifyPermissions` contract from Microsoft's administration module. All 14 app grants were read back; Luis's existing Owner permission was preserved. No CanEdit/co-owner, tenant-wide or group share was added. Notification emails were suppressed.

Final readback: Published Readers has 15 members including Luis; Media Custodian remains empty; Luis remains the only directly assigned PRISMA Global Librarian. No capability ownership, role/profile definitions, Consultant/Project permissions, app content, storage settings or unrelated memberships were changed. Gerson and Jorge already held System Administrator/Read-All Tables access, which was preserved; they are not least-privilege test identities. Per-user sign-in, licensing/consent, scoped workflow behavior and cross-account denial tests remain unverified by this assignment pass.

### Production contributor group (2026-10-26)

At the user's explicit request, assigned **PRISMA Contributor** to production team **Nextant Consulting - ALL** (`0e8457ff-6558-f011-bec1-7c1e521680bd`), verified as the Microsoft 365 group team for Entra group `071e9199-9e2a-48ca-80db-27efb9ed71bb`. Readback confirmed the added role and preservation of the team's existing **Basic User** and **Basic Nextant User Role** assignments. This grants the role through team membership, not just to the 14 individually onboarded recipients above.

This was a **team security-role change only**. No app/group sharing, field-security profile association, Published Readers membership, team membership, licence, role definition or unrelated permission was changed. The earlier 14 individual app shares remain unchanged; this role assignment alone is not evidence that every group member can launch or complete a submission. Group-wide app access and contributor field-security coverage still require verification and any missing grants require approval.

### Group-backed published access (2026-10-26)

The user subsequently approved the remaining group contributor setup **except Power Apps app sharing**. Added the PRISMA Contributor field-security profile (`15ee916e-1ab6-f111-aaac-6045bd049fba`) to the existing Nextant Consulting - ALL team, preserving its roles and other associations. The imported Contributor role already has `isinherited=1` (Direct User Basic access and Team privileges), so member-owned draft operations do not require a change to the managed role definition.

The existing group team uses membership type **Members and guests**. To keep the publication audience internal without renaming or replacing that broadly used team, created a separate Microsoft 365 group team for **Members only**, backed by the same Entra group `071e9199-9e2a-48ca-80db-27efb9ed71bb`. The existing reader team was preserved and renamed in the same transaction:

| Team | ID | Current purpose |
|---|---|---|
| PRISMA Published Readers | `74dd1768-3a75-4348-aced-20e9eb752f6d` | New Members-only group team; PRISMA CSM role and PRISMA CSM field-security profile; active publication target |
| PRISMA Published Readers - Initial Pilot | `93a0ac77-67e3-4e54-823c-7245545e6f78` | Retained original owner team with all 15 manual memberships and its existing role; no longer selected for new publication shares |

Before the switch, all 15 prior readers were verified as enabled internal members of the directory group, and production contained zero solutions. No existing publication shares required migration. The plug-in's exact-name lookup resolves uniquely to the new group team. Future production provisioning must resolve and validate this active group-backed target rather than reuse the old team ID or require `teamtype=0`. Do not manually synchronize or nest teams; group membership is evaluated through Entra at sign-in and existing sessions may need renewal. The [ADR-0009 amendment](decisions/adr-0009-mediated-media-and-publication-access.md#production-group-backed-readers-2026-10-26) owns the design choice.

Verification used disposable solution `9db0d4cd-71d1-f111-a05b-3833c5ec7e2d` and the real controlled APIs. For its solution, contributor and image, the new reader team's effective access was `None` while Draft, exactly `ReadAccess` after approval, and `None` after withdrawal. Explicit shares targeted only the new reader team, not the initial-pilot team. The fixture and all child/session rows were deleted; Media Custodian stayed empty. This tests the publication principal, **not a non-admin user's signed-in inherited access**.

Power Apps permissions were read only: the pre/post fingerprint remained `79FF8F694B199614AF374305F6FE0569C2B884C85AF9263FD7ACD7545FC23787`, with 15 existing individual permissions and **no share to the group**. No `modifyPermissions` call, Entra membership edit, account enablement, role-definition update or licence assignment occurred.

Directory/licensing preflight found 149 internal group users, 147 enabled. All 15 prior readers were covered. Production's environment security group is already the same Entra group. Of the enabled members, 143 had `POWERAPPS_PER_USER` with the relevant Power Apps and Dataverse plans enabled. These four need production-entitlement review; other entitlement routes such as per-app passes were not certified:

| User | Assigned SKU evidence |
|---|---|
| `jpnavas@nextant.com` | SPB only |
| `asnaider@nextant.com` | SPB, POWERAPPS_VIRAL trial, POWER_BI_STANDARD |
| `shoing@nextant.com` | SPB, FLOW_FREE |
| `psatest@nextant.com` | FLOW_FREE only |

Two directory accounts (`nfonseca@nextant.com`, `sgarcia@nextant.com`) were disabled and left disabled. No billing-policy link was returned by the environment metadata check. Resolve licensing explicitly; do not purchase, allocate licences or re-enable accounts based on this inventory alone. Group app sharing was excluded from this initial configuration pass and separately approved afterward as recorded below. Actual non-admin login/create/upload/denial tests still require a recipient session.

### Approved production group app share (2026-10-26)

The user explicitly lifted the earlier no-sharing restriction and approved **CanView** for **Nextant Consulting - ALL**. Verified directory group `071e9199-9e2a-48ca-80db-27efb9ed71bb` and production app `57f5ef47-d997-4323-a8b8-0c4bf6a9a529` in environment `bce2c94a-b2b3-e487-b368-b8d7c931f90b`, then added the single group permission through the previously verified Power Apps `modifyPermissions` contract. Readback confirmed the Group principal and CanView role, with all 15 preexisting individual permissions unchanged: **16 total permissions**. No CanEdit/co-owner or tenant-wide share was added, and notification emails were suppressed.

This completes group-level app sharing alongside the existing contributor role/profile and group-backed published-reader access. It does not allocate licences, enable disabled accounts or edit Consultant/employee records. The four entitlement exceptions above remain. A separate readiness audit found no active Consultant email match for `jpnavas`, `kmiyazaki`, `internalbi`, `psatest` and `svc-fabric-dataops` at `nextant.com`; `ssangal@nextant.com` had an active Consultant row with Employee Status false. Those records need review for credited-person picker eligibility, not an assumption that app sign-in is blocked. All 147 enabled group members had enabled Dataverse accounts at that audit. Group recipients still need their own sign-in/consent and least-privilege workflow validation.

### Additional production global librarians (2026-10-26)

The user explicitly approved **PRISMA Global Librarian** access for `ssanchez@nextant.com`, `avega@nextant.com` and `nsilva@nextant.com` in Nextant Pulse Prod. Each resolved to a unique enabled human Dataverse account. Applied nine missing memberships in one transaction: PRISMA Librarian, PRISMA Global Librarian and PRISMA Core Draft Librarian field-security profile for each recipient. Readback verified all required memberships and preservation of every preexisting direct role, profile and team membership.

The final direct Global Librarian membership list is `lpreciado@nextant.com`, `ssanchez@nextant.com`, `avega@nextant.com` and `nsilva@nextant.com`. These recipients may perform authorized librarian workflows across all specialization areas, rather than only areas derived from capability ownership. No System Administrator role, app/co-owner share, licence, Consultant ownership or role/profile definition was added or changed. Natalia's preexisting administrator privileges were preserved. Existing group-based app and reader access remains unchanged. The recipients should renew their sessions; actual signed-in global workflows were not exercised under their identities by this provisioning pass.

### Classification association privilege correction (2026-10-26)

Juliana reported an unconfirmed save at **Classify & tag**, preventing progression to Media. Read-only inspection found a saved contributor but no main capability on her draft; production plug-in tracing was Off, so the original exception was not captured. The core capability save also synchronizes the Solution-to-specialization-area N:N relationship. The role provisioner granted Read and Append To on references but omitted **Append**, which [Dataverse requires on both tables in an N:N association](https://learn.microsoft.com/en-us/power-platform/admin/security-roles-privileges). Direct plus team-role inspection confirmed Juliana lacked Append on all five PRISMA reference tables, while her existing baseline supplied Consultant/Project access.

The user explicitly approved the fix in **dev and production**. Added only organization-depth Append for `nx_specializationarea`, `nx_capability`, `nx_technology`, `nx_industry` and `nx_clientrole` to **PRISMA Contributor** and **PRISMA Librarian**. Each role went from 32 to 37 privileges in each environment; every preexisting privilege/depth was preserved and the PRISMA CSM role was unchanged. No Create/Write/Delete or administrator grants were added, and no app/plug-in publication occurred. The owning provisioning rule in [Prisma.Deploy](../../backend/Prisma.Deploy/Program.cs) was corrected locally and builds successfully; do not run its broader `apply` command against production. Source role definitions now contain the correction, so regenerate the managed release before a future import rather than reuse a pre-fix ZIP.

Post-change readback confirmed Juliana's effective Global Append and actual `ReadAccess, AppendAccess, AppendToAccess` on records in all five reference tables. Her saved draft's row version was unchanged by the repair. This verifies the required permissions, **not her actual browser retry**. Before selecting **Reopen saved draft**, she must copy/note unsaved text and selections: reopening clears the retained edits and reloads persisted data. Reapply the selections and retry; renew sign-in only if a stale permission session persists. A successful non-admin classification save and progression to Media remain to be confirmed by Juliana.

### Contributor re-selection failure (2026-10-26)

After the reference Append correction, Juliana advanced past classification but hit another unconfirmed save at Solution context. The user approved temporary **exception-only** production plug-in tracing. Tracing was enabled from the original Off setting at `20:16:35Z`, captured `nx_SaveDraftGraph` failures at `20:18:46Z` and `20:19:51Z`, and was restored to Off with readback. The actual error was **Solution Contributor Key violated: a record with the same BuiltBy and Solution already exists**. This was not another missing permission.

The contributor editor permits removing and reselecting a saved person, sending that selection without its previous row ID. The old graph save created this row before deleting the omitted original, violating the solution/person unique key. The local backend correction resolves an ID-less selection against existing contributor rows for the same parent and person, reuses the original ID and retains it. Explicit IDs from another draft are still rejected. It does not delete or directly repair Juliana's credit row.

The new regression reproduced the captured duplicate-key error before the fix, then passed. All 20 classification tests and all 147 Release backend tests pass, including ordinary create/update, omitted-person deletion and cross-draft ID rejection. The user approved committing/pushing the fixes, a signed dev plug-in update and a fresh managed production release. Deployment/readback and Juliana's browser retry remain pending at this checkpoint; the generic uncertain-save lock is not bypassed.

## Code-app hosting policy

On 2026-09-22 the user explicitly approved four additive CSP sources for **all code apps in Nextant Pulse** (`ce09ad9b-57d1-e5df-9400-8ce973c86213`), including the separate PoC. That dev change did not affect Nextant Pulse Prod; production was separately approved on 2026-10-26 as recorded below. The change used the supported Power Platform admin center: **Manage > Environments > Nextant Pulse > Settings > Product > Privacy + Security > App (code)**. [Microsoft's documentation](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/content-security-policy) confirms the environment-wide scope and default-source merging.

Before the change, enforcement was On, reporting Off, and every directive used defaults. Only these custom sources were added:

| Directive | Added source | Purpose |
|---|---|---|
| `media-src` | `blob:` | Local/protected video and MediaSource playback, caption tracks |
| `worker-src` | `'self'` | Packaged same-origin compression worker |
| `connect-src` | `'self'` | Packaged WASM asset retrieval |
| `script-src` | `'wasm-unsafe-eval'` | WASM encoder and resumable-upload hashing |

Enforcement remains On and reporting remains Off. All other directives retain defaults; no external domains, wildcards, Blob workers or general JavaScript `'unsafe-eval'` were added. Same-origin fetch/worker and WASM execution are additional browser capabilities for every code app in this environment, not app-specific exceptions. They do not change native authorization, mediated file access, HTML sandboxing or publication checks.

The admin UI persisted the sources after reload. PRISMA's response header independently confirmed `media-src 'self' data: blob:`, `worker-src 'self'`, `connect-src 'self'` and `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`; all other observed directives were unchanged. Azure CLI's management request had failed with `InsufficientDelegatedPermissions` before the successful admin UI change; no extra delegated permissions were granted.

**Production approval (2026-10-26):** the user separately approved the same four additions for **all code apps in Nextant Pulse Prod** (`bce2c94a-b2b3-e487-b368-b8d7c931f90b`). Applied through its App (code) settings and verified after an admin-page reload. Enforcement stayed On, reporting Off, and the other eleven directives stayed on defaults. The hosted production response header independently confirmed precisely the four changes above. The user had already enabled Code apps in this environment; launch succeeded after the setting propagated. No extra delegated permissions or direct browser Blob-storage access were granted. Production HTML sandbox isolation and full-file video playback passed as described in the production runbook; browser compression, broader codecs and non-admin acceptance were not retested here.

Rollback, with approval: in the affected environment's code-app tab, turn **Use default** back On for these four directives only, preserve enforcement/reporting and other settings, save, then reload PRISMA and verify the response header. This restores the prior restrictions and blocks current video/worker paths again. No app republish was needed for either policy application or verification. Hosted checks and their limits are recorded in [published host compatibility](../workflows/demo-assets.md#published-host-compatibility).

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
| Per-person hours, effort breakdown, builder names and levels, the CSM and effort (complexity and hour estimate) omitted in present mode | Cards and detail view; not a security boundary for bundled mock data. Connected: since 2026-09-28, `nx_GetPublishedDetail` with `Present` returns no contributor credits and a zero effort total; the per-credit `level` added 2026-10-08 (deployed 2026-10-08) is omitted in present mode like email |

Client identity is always internal, regardless of maturity. Anonymous context is authored separately and required when the internal client field is populated. This does not scrub names from descriptions or attachments; their confidentiality must be checked before approval.
