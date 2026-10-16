# Librarian runbook

**Status:** Connected review, publication sharing and retirement deployed through plug-ins (privileged accounts verified; non-admin acceptance pending); no notifications yet; review panel reorganized into overview, publication checklist and decision 2026-10-14; librarian content editing deployed 2026-10-15 (ADR-0013; hosted check pending); effort is a solution estimate and complexity (ADR-0014, deployed 2026-10-15) · **Last updated:** 2026-10-15
**Role definition:** [End-to-end design §2.3](../design/end-to-end-design.md#23-librarian-admin)

The librarian owns library quality: consistent, accurate, non-embarrassing entries; no stale content presented to clients. The librarian is **the only role that can publish** — this is the quality gate that makes sales use safe.

## Reviewing a submission

### Connected PRISMA

The review queue is at `#/review`, shown in the masthead only to accounts with the **PRISMA Librarian** role (direct or through a team). System Administrator alone is not enough; the plug-ins check the role on every call. Tabs show Pending review, Changes requested and Published with their counts. Search by name, summary, capability or owner; filter by specialization area, then capability (its options narrow to the chosen area); sort newest or oldest first. Each row's left edge takes the state colour (blue Pending review, amber Changes requested, green Published) and shows the area and capability chips, name, summary, owner and image/attachment counts, with a small submitted date in its top corner. The date is the record's Date Added (creation date when unset), so a resubmitted record keeps its original date. Open a record (`#/review/:id`) to inspect its detail, screenshots, contributor effort and attachments; HTML stays sandboxed and videos use the protected player.

There are **no notifications yet** ([ADR-0006](../architecture/decisions/adr-0006-power-automate-notifications-only.md) is accepted but not built). Check the queue on an agreed cadence until review alerts exist.

The review panel above the submission preview shows the status, then three sections. **Solution overview**: capability, its **Capability owner** (`nx_capability.nx_capabilityowner`; "Not assigned" when empty, hidden if it cannot be read), specialization areas, submitted by, and the client (internal name and how clients see it) only when the record names one; the previous feedback appears here when a returned record comes back. **Publication checklist** (pending review only): any **Missing content**, five items you confirm (no confidential data or PII in media; client details anonymized unless authorized; accurate, professional, non-confidential descriptions; demos and documents fit the audience; correct classification), and any **Possible duplicate technologies**. **Review decision**: **Approve** needs the required content and all five items confirmed, which together are the client-safety clearance sent with the approval; **Request changes** needs a comment of at least 15 characters saying what to correct. A returned record (Changes requested tab) shows "Changes requested" as its status and **Waiting for corrections** with your feedback instead of a checklist and decision; it returns to Pending review when the contributor resubmits.

- **Ready to publish → Approve & publish** requires the independent client-safety confirmation. An optional note to the contributor replaces the latest feedback; a blank note clears it. The server rechecks completeness, active capability/areas/contributors and every stored file (size, and version for Blob files), then publishes and grants the **PRISMA Published Readers** team read access to the solution, its contributors and finalized media.
- **Request changes → Send back for changes** requires comments to the contributor (up to 4000 characters). The record goes back to Draft with outcome Changes requested; the contributor's safety acknowledgment is cleared.
- A published record opens with one compact green row: **Published · Available in the Solution Library.**, any approval note, and on the right **Edit solution** as the primary (filled) button. Since 2026-10-15 the two actions that take it out of the library sit behind a **•••** menu as **Send back to owner…** and **Retire from library…**, because librarians who meant to edit kept choosing Request changes. Without librarian editing (the PoC), the row shows two small buttons as before. Nothing else shows until you pick one; its form opens below the row with a required text the owner will read, **Cancel**, and its action button, then the usual confirmation:
  - **Request changes** sends it back like a return: it leaves the library, becomes Changes requested with your comments, and returns to the queue on resubmission. Use it when something must be fixed.
  - **Retire** is for a solution that is obsolete or replaced: it explains that the solution leaves the Solution Library for good while the record is kept, then asks for the required reason; **Retire from library** removes it from the catalogue and revokes reader access. Unlike Request changes, it is not tracked as waiting for corrections.
  Both are live since 2026-10-02.
- A retired record keeps its history and its reason is visible to the owner in My submissions. The owner can later withdraw it to Draft, refresh it and resubmit.
- Every action carries the record's row version. If someone else changed it first, the action is rejected; reopen the record and review the latest version.

Since 2026-10-15 ([ADR-0013](../architecture/decisions/adr-0013-librarian-content-editing.md)), you can fix a contributor's content yourself instead of returning it. **Edit solution** in the review panel opens the solution at `#/review/:id/edit`. You can edit everything except the contributor list, and the record keeps its status. It is not offered on solutions you submitted yourself: withdraw those from My submissions and edit them as their owner. Any real change must be explained to the owner: what you changed and why.
- On a Pending record, the approval note becomes required.
- On a Published record, the solution leaves present mode at the first change. It stays in the library. **Confirm changes** repeats the publication checklist, takes your explanation and brings it back to present mode. Do not leave an edit unconfirmed. Owners can withdraw Pending, Published or Retired records to Draft at any time, which also revokes reader access.

### Mock PoC

The PoC queue at `#/review` simulates the same flow in this browser only. Decisions and media survive reload but are not shared with other browsers or written to Dataverse; access is simulated, not a role check. Use non-sensitive test records only.

### Review fields

Review Comments allow up to 4000 characters and are separate from editorial Library Notes. Review Outcome records the latest decision, not current clearance. A returned record is Draft + Changes requested; resubmission retains feedback but belongs in Pending review. An edited formerly approved record may retain outcome Approved while not published or cleared. Approval replaces the latest comments; blank approval comments clear the earlier feedback. No full review history is captured.

**Checklist before approving:**

- [ ] Name, one-liner, and body text read well and would not embarrass anyone on a client screen
- [ ] What the solution does and Business value are both filled in (required to submit since 2026-10-08) and say plainly what it does and why it matters; the one-liner is at most 200 characters
- [ ] New submission contains one to six detail images; images alone are sufficient; thumbnail alone is not
- [ ] Uploaded HTML files reviewed for active content (sandboxing is defence in depth, not a substitute)
- [ ] Legacy hosted URLs load; new submissions use images, HTML, video or one-pagers/slides only
- [ ] Safety acknowledgment is present; independently verify authorized, anonymized descriptions and media
- [ ] Client identity stays internal; anonymous context is supplied when a client is named; no identifying details leak through body text or attachments
- [ ] Exactly one capability is selected; tags are sensible; no duplicate technologies introduced. The connected review panel shows **Possible duplicate technologies** only when a new technology resembles an existing one; if it repeats it, request changes and name the existing one. It does not block approval
- [ ] Thumbnail present or the generated poster is acceptable
- [ ] At least one unique person credited. Effort is the solution's **complexity** (Easy, Medium or Hard; required) and an optional **estimated minimum hours** (whole hours). Check that both are credible for what the solution shows ([ADR-0014](../architecture/decisions/adr-0014-solution-effort-estimate-and-complexity.md)). Since ADR-0013 you can correct them yourself, and you explain the change to the owner.
- [ ] Solutions saved before 2026-10-15 have no complexity yet. The owner, or you through Edit solution, must set it before the next submit or approval. Old per-person hours are no longer shown.
- [ ] Project links, if present, meet [intake criteria](../data_model/SchemaV2.md#intake-triage-not-every-legacy-record-gets-linked-to-a-solution); client engagement names and per-person effort details do not appear in present mode

**Outcomes:** approve client-safe content (Published, Client Safe Reviewed true, Review Outcome Approved), or request changes (Draft, Review Outcome Changes requested, required Review Comments and both safety booleans false). Approval revalidates submission completeness. Acknowledgment and historical outcome alone never grant clearance. The connected app enforces this through [controlled transitions](../architecture/security-model.md#controlled-transitions); the PoC only simulates the role.

**Re-reviews:** a published record must be withdrawn to Draft before its owner can edit it; withdrawal removes it from the catalogue and clears client-safe approval, and resubmission returns it to *Pending review*. Under ADR-0013 a librarian can instead correct a published record in place without unpublishing it, then confirm the changes. A diff and audit history remain follow-up work.

**SLA:** _TBD — set with the librarian team (see risk R4: more than one librarian, SLA on review)._

## Retiring a record

Retire when stale, superseded, or client-sensitive. Retired records leave search/browse and lose reader access but keep their history; the owner can withdraw a retired record to Draft, refresh it and resubmit it for approval.

## Reference data upkeep

- Add governed values (capabilities, industries, specialization areas) as the practice evolves — contributors cannot.
- Periodically merge duplicate technologies ([governance](../data_model/reference-data-governance.md)). Find them with `Prisma.Deploy technology-duplicates` (read-only): it lists look-alike pairs (same name ignoring case and punctuation, known alias, same words in another order, likely typo, one name inside the other) with how many solutions use each. Merging is not automated yet: `DraftGraphGuard` blocks direct tag writes for every account, so it needs a librarian-only merge operation in the plug-ins.
- Maintain sort orders that drive tab/chip/facet ordering.

## Recurring duties

| Cadence | Duty |
|---|---|
| Per submission | Review checklist above |
| Periodic | Link-health and staleness review ([content health](content-health.md)) |
| Periodic | Technology duplicate merge |
| Annual | Re-confirmation prompt cycle to contributors |
| Before Phase 3 | Deliberate client-safe review of **every** published record |
