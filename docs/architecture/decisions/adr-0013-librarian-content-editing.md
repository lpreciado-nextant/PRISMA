# ADR-0013 — Librarian content editing

**Status:** Accepted; agreed with the user 2026-10-15. Deployed 2026-10-15: signed plug-in by Luis (20:00 UTC), then the connected app from `c877ca3` (about 22:05 UTC). Redeployed with ADR-0014 from `5ad96bb` (plug-in 22:35:57 UTC, then the app), which also stops offering Edit on the librarian's own solutions. The editing flow was checked in the hosted app on Mauricio's "Budget Management Solution". Non-admin acceptance is pending. The three columns were created on 2026-10-15 and their metadata and column security verified.
**Date:** 2026-10-15
**Last updated:** 2026-10-27
**Read-across amendment status:** Approved by the user 2026-10-27, explicitly including Published, Changes requested and private suggestions instead of the Pending-only recommendation. Juliana's implementation is on main; the signed dev rollout and acceptance evidence are recorded in the [technical architecture](../technical-architecture.md). Actual non-admin cross-area acceptance remains pending. See [Read across areas](#read-across-areas-approved-2026-10-27).
**Scope amendment status:** Accepted and deployed 2026-10-26: signed plug-in, compatible connected app and separately approved Basic-depth role migration. A later approved provisioning assigned five capability owners and Luis as global librarian; eight owner onboarding blockers and hosted least-privilege acceptance remain pending. [Assignment evidence](../security-model.md#approved-librarian-provisioning-2026-10-26).

## Context

The end-to-end design says the librarian "edits any record" ([§2.3](../../design/end-to-end-design.md#23-librarian-admin)), but the connected app does not allow it. Every content save goes through `DraftPolicy.AssertEditable`, which requires the caller to own the record and the record to be in Draft. As a result, a librarian who finds a typo, a client name in a title or a misfiled capability has to return the whole submission, or take a published solution out of the library, for something they could fix in a minute. Every save also forces the record back to Draft and clears Client Safe Reviewed. That is right for a contributor's edits, but it would unpublish a record each time a librarian made a small correction.

Contributors still need to know when someone changed their solution, and why. The schema keeps only the latest review outcome and comments ([ADR-0008](adr-0008-controlled-submission-transitions.md)), and there is no edit history or diff.

## Decision

**Who and when.** An authorized librarian within the [capability-owner scope](#capability-owner-scope-2026-10-26) may edit another person's solution while it is **Pending review** or **Published**. Draft records are the owner's work in progress and stay owner-only. Retired records are not editable; the owner withdraws and resubmits them as today. A librarian who owns a record edits it as its owner: withdraw first.

**What.** The librarian edits the same content the owner can: core text, capability, maturity, client role, specialization areas, industries, technologies, projects and media (images, links and Blob attachments), plus the redacted client context. Contributors and their hours are not editable by the librarian: a librarian graph save writes no contributor rows. Since [ADR-0014](adr-0014-solution-effort-estimate-and-complexity.md) (2026-10-15), effort is the solution's complexity and hour estimate, so the librarian edits it like any other solution field.

**Status while editing.**
- The record keeps its publication status. A librarian save never sets Draft and never changes the owner's safety acknowledgment.
- *Pending review:* nothing else changes. The librarian then approves or returns it as usual.
- *Published:* the record stays Published and in the internal catalogue, with its reader shares. The first real change sets Client Safe Reviewed to false, so the record leaves present mode. It stays out of present mode until the librarian confirms the edit.
  - Clearance cannot be checked on every save. A media edit takes several calls, and the steps in between can be invalid, such as removing the only image before adding its replacement.
  - The rule that material edits clear clearance ([ADR-0005](adr-0005-present-mode-server-side-enforcement.md)) still holds. The librarian who made the edit is the one who restores clearance, without unpublishing the record.

**Required explanation.** If a librarian save actually changed something, the librarian must say what changed and why, in words the owner will read.
- The server compares the incoming values with the stored ones: core fields, links, media captions, order and purpose, and added or removed media. A save with no changes requires nothing. Opening the editor or creating a technology is not a change.
- A real change sets the record's *unreported edit* flag.
- *Pending review:* while the flag is set, **Approve** rejects blank comments; approval comments are otherwise still optional. **Return** already requires comments. Either decision clears the flag.
- *Published:* the new `nx_TransitionSubmission` action `confirm-edit` (shown as **Confirm changes**) ends the edit. It requires:
  - the flag to be set;
  - the publication checklist, as the independent client-safe confirmation;
  - a nonblank explanation of at most 4000 characters.

  It re-runs approval's completeness, active-reference and stored-media checks. If any check fails, nothing changes. Otherwise it restores Client Safe Reviewed, replaces Review Comments with the explanation (Review Outcome is unchanged), clears the flag and re-grants PRISMA Published Readers access to the record, its contributors and every finished media item, including new ones. Media removed during the edit is deleted with its share.
- Any other transition (withdraw, request changes, retire, delete) also clears the flag, because its own required comment or the owner's action supersedes the edit.
- The rule is enforced in the plug-in, not only in the UI.

**Traceability.** Three columns on `nx_solution`, created 2026-10-15:
- `nx_librarianeditedby`: lookup to `cr6b0_consultant`, because PRISMA names people by consultant rather than by `systemuser`.
  - The plug-in resolves the librarian from their sign-in email to exactly one active consultant, with the same rule as favorites.
  - When no consultant matches, the edit is still recorded, but without a name.
  - Column security lets only the PRISMA Librarian and PRISMA Core Draft Librarian profiles read it.
- `nx_librarianeditedon`: date and time.
- `nx_librarianeditpending`: yes/no, the unreported-edit flag.

These columns are written only through the PRISMA APIs, by librarian saves that changed something and by the transitions that clear the flag.
- The owner sees "Edited by the librarian · date" on the submission page and an "Edited by librarian" label on the My submissions card. The librarian's explanation is the review comment shown there.
- The librarian's name is returned only to librarians, pending [Q17](../../delivery/decision-log.md).
- None of these columns reach CSM, published or present-mode projections, or the presentation download.
- There is no field-level diff and no edit history.

**Concurrency.** Librarian saves carry the exact row version, like every other write. If the owner withdraws or deletes the record while a librarian is editing, the librarian's save is rejected and the record must be reopened. There is a single record, so there is nothing to merge.

**Implementation.**
- **Edit mode:** `DraftPolicy.Editable` returns the edit mode, either owner in Draft or authorized librarian in Pending review or Published. The APIs resolve solution-specific access through `LibrarianAccess`; `AssertEditable` keeps the owner-only behaviour.
- **Save APIs:** `nx_SaveCoreDraft`, `nx_SaveDraftGraph`/`nx_GetDraftGraph`, the media APIs and `nx_BeginResumableUpload` branch on that mode. No new Custom API or parameter is added: `confirm-edit` reuses the existing `Action`, `Comments` and `Cleared` parameters.
- **Writes:** after the scope amendment, librarian content writes run through the server service only after solution-specific authorization; ordinary owner writes retain caller rights. Reference selections still require caller read access. The edit trail is written after the checks. A librarian may remove finished media uploaded by someone else, but unfinished uploads still belong to whoever started them. `SolutionWriteGuard` and the media and graph guards keep blocking direct writes.
- **Connected app:** the librarian editor opens at `#/review/:id/edit` from **Edit solution** in the review panel. It reuses the guided form without the safety step, the acknowledgment or the contributor editor, and returns to the review on save. The review panel requires the explanation on approval after an edit, and shows **Confirm changes** for a published record. It is hidden in present mode.
- **Mock PoC:** unchanged.

## Capability-owner scope (2026-10-26)

- **Authority:** direct or team membership in `PRISMA Librarian`, plus a unique active Consultant matching the authenticated user's email. Active capabilities with `nx_capabilityowner` pointing to that Consultant grant their active `nx_specializationarea`. Missing or ambiguous identity fails explicitly; missing ownership/area grants no scoped access.
- **Boundary:** any active main capability in one of those SAs is in scope, even if a different Consultant owns that capability. Only the solution's main `nx_capability` determines authority; secondary capabilities and the solution's area tags do not. Owning capabilities in several SAs grants the union.
- **Override:** direct or team membership in the separately designated `PRISMA Global Librarian` role grants global workflow scope, including unclassified solutions. It is an unassigned marker role at creation, not organization-wide table access; normal app roles/profiles are still needed.
- **Self-approval:** explicitly allowed within scope. This does not permit librarian editing of one's own Pending/Published record or skip any publication prerequisite.
- **Every surface:** enforce management scope on decisions, core/graph/media edits and resumable uploads/checkpoints. The read-across amendment below supersedes the area restriction on queue, detail, finalized media and private-suggestion reads. Filter active queue states before pagination. The detail response's `librarian` and `librarianEdit` describe management of that solution, not its read visibility.
- **Reclassification:** check both the current and proposed main capability before a librarian core save. Scoped librarians cannot clear classification or transfer the solution to an SA they do not manage; use a global librarian. Ordinary owner Draft classification remains unchanged.
- **Revocation:** resolve ownership and roles on each API call, with no cross-request authorization cache. Media range reads recheck scope before returning bytes. Previously downloaded content cannot be recalled.
- **Direct access:** downgrade the normal librarian role's Solution/contributor/media privileges to Basic and mediate scoped access in plug-ins. New media shares go to the solution owner, not a non-owner librarian uploader. The migration revokes historical non-owner uploader shares. Published-reader access remains unchanged.

No schema or Custom API registration is added. `nx_ReadVideoRange` also supports `Mode=image` for images/thumbnails; media snapshots include `solutionId`. Older app/backend compatibility is transitional, not an alternative to completing the rollout. Deployment order, manual provisioning, additive-permission audit and non-admin acceptance are owned by the [security model](../security-model.md#capability-owner-librarian-access).

## Read across areas (approved 2026-10-27)

- **Decision:** any valid librarian may **read** every active record in the review queue, in every area: Pending review, Published, and Drafts returned with Changes requested, with their internal content, finalized media, review feedback and private suggestions. **Deciding and editing stay with the capability-owner scope above**: approve, return, retire, confirm-edit, librarian core/graph/media edits, uploads and technology decisions still require `CanManage`. Global librarians are unchanged.
- **Why:** librarians want the context of other areas (what is being submitted, the feedback given, possible duplicates) without the power to decide outside their area. Juliana confirmed there is nothing confidential between areas.
- **Out of scope:** Drafts never submitted, or not returned, stay owner-only. Nobody gains edit rights. No role, profile, schema or Custom API changes.
- **Implementation:** `LibrarianAccess.CanView` (queue records, any area) beside `CanManage`. `nx_GetSubmissions` stops filtering the queue by area and marks each row `manage`. `nx_GetSubmission` reads through `ReadForReview`, which returns `viewer` (read-only) outside the area, while `nx_TransitionSubmission` keeps `ReadSolution`. `nx_ReadVideoRange` (submission and image modes) and `nx_GetSolutionSuggestions` use `CanView`. The editor surfaces (`nx_GetDraftGraph`, `nx_GetDraftMedia`, uploads and checkpoints) keep the area check.
- **Connected app:** the area librarian's switch gains **All areas**. Other areas' records show **View only** with a **View** button, the Area filter returns there, and the submission page shows the content with a view-only note instead of the checklist and decision. The masthead's pending count and the amber "your turn" count only records the librarian may decide on. With an older plug-in (no `manage`), the app behaves as before.
- **Revocation and unfinished work:** the cross-area grant requires active state and a queue status on each call; range reads repeat authorization before returning bytes. Leaving the queue, becoming inactive or losing valid librarian access ends the additional grant. Returned Drafts deliberately remain readable while corrections are in progress. Unfinished upload metadata is omitted from view-only detail and unfinished bytes remain unavailable. Existing independent rights and already downloaded data are not recalled.
- **Rollout:** deploy the signed plug-in and immediately publish the compatible app, as requested. Older clients do not understand `manage`/`viewer` and cannot open new view-only review details; existing sessions must refresh. The server continues rejecting out-of-area mutations throughout. No schema, role or API registration migration is needed. Verify non-admin identities in two areas, permitted reads across all three tabs, denied writes/editor/checkpoint access, and revocation; privileged-account checks and local fixtures are not recipient acceptance.

## Consequences

Librarians fix small problems without bouncing a submission or unpublishing a solution, and the owner is always told what changed and why.

- **Deployment order:** the three columns exist, created first because the plug-ins read them on every submission read and transition. Next comes the signed plug-in, then the connected app.
- **Permissions to verify:** a non-admin librarian must be able to update core fields of another person's record. Check field-security profiles on client context and the redacted field, and N:N append rights. The pilot's privileged accounts cannot prove this.
- **Present mode:** a published record being edited is out of present mode until confirmed. An abandoned edit leaves it out until a librarian confirms or requests changes, and the review panel says so.

The owner's acknowledgment can now cover content the owner did not write. This is accepted, because the librarian's clearance is the publication gate. Only the latest comment survives: a later approval, return or edit replaces the explanation, and a diff or history still needs the separate audit design noted in [SchemaV2](../../data_model/SchemaV2.md#draft-and-transition-contract). Revisit if Capability Owners are allowed to edit ([change log](../../delivery/change-log.md)), if contributor or hours editing is needed, or if owners need notifications ([ADR-0006](adr-0006-power-automate-notifications-only.md)).
