# ADR-0009 - Mediated media and publication access

**Status:** Accepted; protocol and thumbnail/metadata extension deployed and privileged-owner verified; least-privilege verification pending
**Date:** 2026-09-22
**Last updated:** 2026-09-22

## Context

Dataverse reports no custom processing-step support for InitializeFileBlocksUpload, UploadBlock, CommitFileBlocksUpload or DeleteFile. Ordinary metadata guards cannot make direct file writes safe. Existing child relationships do not cascade sharing. Contributors must not mutate a file after submission or retain a reusable upload token.

## Decision

- Add private, organization-owned `nx_uploadsession` with typed caller/parent/target identifiers, file metadata, byte/block counters, expiry, completion and continuation-token fields. Never grant application roles access or return tokens to clients. It is not a draft/history table; bytes remain in native File/Image storage.
- Own gallery and attachment rows through an empty **PRISMA Media Custodian** owner team with only Basic media Read privileges. Never add members. Mutations use synchronous APIs and system service only after caller ownership, Draft state and exact version checks.
- Use sequential 512 KiB blocks, two-hour unfinished-session expiry, one unfinished upload per draft, and explicit removal. Every mutation advances the parent version and clears acknowledgment/clearance. Finalization checks size and shares the record read-only with its contributor owner. Finalized file bytes are immutable except mediated removal while Draft.
- Store one optional dedicated thumbnail as a team-owned `nx_solutionimage` with private session kind `thumbnail`, separate from the one-to-six gallery images. Use the existing image column, caption and sort-order fields; no additional table or column is required. Never trust the legacy parent image. Thumbnail removal/replacement uses the same version-checked media protocol.
- Allow owner-only Draft metadata edits through `nx_TransitionSubmission` action `media`; its `Comments` argument carries a validated JSON array of target ID, caption (up to 200 characters) and sort order (0-12), not review feedback. Only completed targets belonging to that draft may be edited. Advance the parent version, clear acknowledgment/clearance and preserve review fields transactionally. Reject direct metadata writes. Published projections return only completed protected media and saved metadata.
- Owner deletion uses the controlled transition in ADR-0008 to revoke publication access and remove finalized/unfinished media and private sessions with their parent; shared reference data is retained.
- File bytes are not transactional with Dataverse rows: ambiguous requests require reopen, inspection and removal/restart, not blind replay. Expiry rejects writes but does not reclaim storage; owners remove unfinished uploads. Automatic cleanup is future operational work.
- Publish by sharing Solution, contributor and completed media rows read-only with **PRISMA Published Readers**. Revoke those shares on withdrawal/retirement. Membership is manually administered; no users are assigned by deployment. Consultant/Project access remains a prerequisite and is never expanded by these shares.
- Require the explicit **PRISMA Librarian** role, directly or through team membership, for decisions. System Administrator alone does not qualify. Librarians have Global media Read but no direct media Write through the PRISMA role; they are trusted reviewers across the lifecycle.
- Do not use the legacy parent Solution image as trusted connected media. Contributors have Solution Write for controlled APIs; the unguardable file-operation surface on that column is not a publication input. The connected gallery/viewer uses only finalized team-owned media.

## Consequences

HTML and PNG upload/commit/download/removal and rejection checks passed live with the privileged owner. Browser media reload, full-size image download and sandbox isolation passed. WebP is converted to PNG because native image columns do not support WebP.

Privileged live checks also passed thumbnail upload, duplicate-thumbnail rejection, caption save, stale/direct metadata rejection and deletion of finalized/unfinished media with their parent. Browser checks verified thumbnail/card rendering, caption persistence and removal; detail and final-preview thumbnail slots compile. Client reorder controls are not implemented. Document SDK reads and download dispatch succeeded, but browser file delivery remains unverified.

The empty readers team has the PRISMA CSM role; members also need the intended field-security profile and app access. Both team records are environment-specific data, not portable solution components. Rerun scoped provisioning in another approved environment. Assignments and additive permissions require review. Successful librarian return/approval, CSM direct reads, cross-owner denials, sharing revocation and hosted acceptance remain release gates. The connected app is not published.