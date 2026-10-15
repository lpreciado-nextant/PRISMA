# ADR-0013 — Librarian content editing

**Status:** Proposed; agreed with the user 2026-10-15, not implemented
**Date:** 2026-10-15

## Context

The end-to-end design says the librarian "edits any record" ([§2.3](../../design/end-to-end-design.md#23-librarian-admin)), but the connected app does not allow it. Every content save goes through `DraftPolicy.AssertEditable`, which requires the caller to own the record and the record to be in Draft. As a result, a librarian who finds a typo, a client name in a title or a misfiled capability has to return the whole submission, or take a published solution out of the library, for something they could fix in a minute. Every save also forces the record back to Draft and clears Client Safe Reviewed. That is right for a contributor's edits, but it would unpublish a record each time a librarian made a small correction.

Contributors still need to know when someone changed their solution, and why. The schema keeps only the latest review outcome and comments ([ADR-0008](adr-0008-controlled-submission-transitions.md)), and there is no edit history or diff.

## Decision

**Who and when.** A caller holding the **PRISMA Librarian** role (direct or through a team, checked server-side as for review) may edit another person's solution while it is **Pending review** or **Published**. Draft records are the owner's work in progress and stay owner-only. Retired records are not editable; the owner withdraws and resubmits them as today.

**What.** The librarian edits the same content the owner can: core text, capability, maturity, client role, specialization areas, industries, technologies, projects and media (images, links and Blob attachments), plus the redacted client context. Contributors and their hours are not editable by the librarian: contributor saves keep every existing contributor row unchanged. The effort model is being revised separately.

**Status after saving.**
- *Pending review:* the record stays Pending review. The librarian then approves or returns it as usual.
- *Published:* the record stays Published and in the catalogue (in-place edit). The librarian is the client-safety gate, so the save requires the same independent client-safe confirmation as approval and re-runs approval's completeness, active-reference and stored-media checks. If any check fails, nothing is saved. Client Safe Reviewed stays true. Reader shares are kept, newly finalized media is shared with PRISMA Published Readers, and removed media loses its share. Review Outcome is unchanged.
- In both states the owner's safety acknowledgment is kept. A librarian save never sets Draft and never clears Client Safe Reviewed. This is the one exception to the rule that material edits clear clearance ([ADR-0005](adr-0005-present-mode-server-side-enforcement.md)), because the person editing is the person who grants clearance.

**Required explanation.** If a librarian save actually changed something, the librarian must say what changed and why, in words the owner will read. The server compares the incoming values with the stored ones, so a save with no changes requires nothing.
- *Pending review:* the change is recorded as unreported. **Approve** then rejects blank comments while the flag is set (today approval comments are optional). **Return** already requires comments. Either decision clears the flag.
- *Published:* there is no later decision, so the edit save itself requires the explanation. It replaces Review Comments, consistent with the latest-only model.
- The comment box is labelled to ask what changed and why. The rule is enforced in the plug-in, not only in the UI.

**Traceability.** Add three protected columns to `nx_solution`. The names are proposed and are final when the columns are created:
- *Librarian edited by*: lookup to the calling `systemuser`, captured before any elevated write.
- *Librarian edited on*: date and time.
- *Librarian edit unreported*: yes/no.

These columns are set only by librarian saves that changed something. The owner sees "Edited by the librarian · date" next to the status in My submissions and on the submission page, with the librarian's comment. The librarian's name is stored but shown only to librarians, pending [Q17](../../delivery/decision-log.md). None of these columns reach CSM, published or present-mode projections, or the presentation download. There is no field-level diff and no edit history.

**Concurrency.** Librarian saves carry the exact row version, like every other write. If the owner withdraws or deletes the record while a librarian is editing, the librarian's save is rejected and the record must be reopened. There is a single record, so there is nothing to merge.

**Implementation shape.**
- `AssertEditable` returns an edit mode: owner in Draft, or librarian in Pending review or Published.
- The existing save, graph, media and media-transfer APIs branch on that mode, so the connected client reuses the same wrappers and `SubmissionForm`, without the contributor section.
- A librarian graph save never writes contributor rows.
- `SolutionWriteGuard` and `IsSaveContext` keep blocking direct writes.
- The editor opens at `#/review/:id/edit`, from the review panel and from the published submission page. It is hidden in present mode.
- The mock PoC is unchanged.

## Consequences

Librarians fix small problems without bouncing a submission or unpublishing a solution, and the owner is always told what changed and why.

- **Schema:** three new `nx_solution` columns, which need separate approval.
- **Plug-ins:** the edit-mode branch across the core, graph and media APIs, the unreported-edit rule on approve, and share handling for media changed on a Published record. All of these need policy tests.
- **Connected app:** a librarian editor route and an owner-facing edit label.

The owner's acknowledgment can now cover content the owner did not write. This is accepted, because the librarian's clearance is the publication gate. Only the latest comment survives: a later approval, return or edit replaces the explanation, and a diff or history still needs the separate audit design noted in [SchemaV2](../../data_model/SchemaV2.md#draft-and-transition-contract). Revisit if Capability Owners are allowed to edit ([change log](../../delivery/change-log.md)), if contributor or hours editing is needed, or if owners need notifications ([ADR-0006](adr-0006-power-automate-notifications-only.md)).
