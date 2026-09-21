# ADR-0008 - Controlled submission transitions

**Status:** Accepted, amended to require authored draft names; production implementation pending
**Date:** 2026-09-21
**Last updated:** 2026-09-21

## Context

Contributors must save incomplete drafts, submit and revise their work, while only librarians may approve publication. Granting contributors write access to Publication Status or Client Safe Reviewed would bypass that gate; librarian-only field writes without an authorized transition service would prevent legitimate submit/invalidation operations. Review feedback also needs its own contributor-readable fields, independent of internal editorial notes.

## Decision

- Keep drafts and submitted records in the existing Solution/child tables. Use optional column metadata for submission-only fields and synchronous conditional validation at submit/publication. Require an authored, nonblank solution name of at most 100 characters on every draft save, rejecting the legacy reserved label, and supply valid required defaults. Persist only selected-person contributor rows; null represents missing effort inputs.
- Add Review Outcome (None / Changes requested / Approved) and Review Comments (4000 characters) to Solution. They hold the latest librarian decision, survive contributor edits and resubmission, and never imply current publication eligibility. No review-history table is added.
- Implement future production save-draft, submit and review commands as Dataverse Custom APIs backed by synchronous plug-ins. Validate caller access, source state, expected row version and the complete persisted record/children before committing transitions. No SPA server routes are introduced.
- Keep publication, clearance and review fields protected from direct contributor writes. Scoped handler execution can clear approval or request pending state on behalf of an authorized contributor, but only an authorized librarian can request approval. Preserve server-stored review fields on contributor edits rather than trusting supplied values.
- Apply equivalent guards to direct record/import and child/media mutations; reject bypass writes. Stage file uploads in Draft and validate completed assets before publication. State/metadata changes are transactional; file upload bytes are not part of that transaction. Reject stale edits and approvals through optimistic concurrency.
- Notifications remain post-commit and non-authoritative under [ADR-0006](adr-0006-power-automate-notifications-only.md). Row permissions and field-security profiles remain required alongside transition validation.

## Consequences

Incomplete drafts do not force fake effort or summary values. Contributors can submit without being able to publish. Latest feedback is readable on authorized contributor records and absent from CSM/presentation projections. Schema changes add two columns, not a new table; full review history, reviewer identity and timestamps remain separate future work.

Production implementation must register and test the APIs, plug-ins, field profiles, child-write guards, file lifecycle and concurrency behavior. The browser-local PoC only demonstrates the flow; its email owner keys and review controls are not platform security. The authoritative field and transition matrix lives in [SchemaV2](../../data_model/SchemaV2.md#draft-and-transition-contract); authorization details live in the [security model](../security-model.md).