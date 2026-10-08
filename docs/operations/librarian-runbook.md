# Librarian runbook

**Status:** Connected review, publication sharing and retirement deployed through plug-ins (privileged accounts verified; non-admin acceptance pending); no notifications yet; review panel reorganized into status, context and decision 2026-10-02 · **Last updated:** 2026-10-08
**Role definition:** [End-to-end design §2.3](../design/end-to-end-design.md#23-librarian-admin)

The librarian owns library quality: consistent, accurate, non-embarrassing entries; no stale content presented to clients. The librarian is **the only role that can publish** — this is the quality gate that makes sales use safe.

## Reviewing a submission

### Connected PRISMA

The review queue is at `#/review`, shown in the masthead only to accounts with the **PRISMA Librarian** role (direct or through a team). System Administrator alone is not enough; the plug-ins check the role on every call. Tabs show Pending review, Changes requested and Published with their counts. Search by name, summary, capability or owner; filter by specialization area, then capability (its options narrow to the chosen area); sort newest or oldest first. Each row's left edge takes the state colour (blue Pending review, amber Changes requested, green Published) and shows the area and capability chips, name, summary, owner and image/attachment counts, with a small submitted date in its top corner. The date is the record's Date Added (creation date when unset), so a resubmitted record keeps its original date. Open a record (`#/review/:id`) to inspect its detail, screenshots, contributor effort and attachments; HTML stays sandboxed and videos use the protected player.

There are **no notifications yet** ([ADR-0006](../architecture/decisions/adr-0006-power-automate-notifications-only.md) is accepted but not built). Check the queue on an agreed cadence until review alerts exist.

The review panel above the submission preview shows the status and owner, then a **Review checklist**: classification (specialization areas, capability, maturity status), client safety (the internal client beside the client-facing wording), **Review points** (the publication requirements to verify, as a plain list; a point the record fails is flagged Missing), and the previous feedback when a returned record comes back. Then **Review decision**. A returned record (Changes requested tab) shows "Changes requested" as its status and, below the checklist, **Waiting for corrections** with your feedback instead of a decision; it returns to Pending review when the contributor resubmits. Choose **Ready to publish** or **Request changes** first; only that decision's controls appear, and a disabled final button says what is missing.

- **Ready to publish → Approve & publish** requires the independent client-safety confirmation. An optional note to the contributor replaces the latest feedback; a blank note clears it. The server rechecks completeness, active capability/areas/contributors and every stored file (size, and version for Blob files), then publishes and grants the **PRISMA Published Readers** team read access to the solution, its contributors and finalized media.
- **Request changes → Send back for changes** requires comments to the contributor (up to 4000 characters). The record goes back to Draft with outcome Changes requested; the contributor's safety acknowledgment is cleared.
- A published record opens with a green **Published** block (with any approval note). Under **Need to change it?** choose one, write the text the owner will read (required), then confirm:
  - **Request changes** sends it back like a return: it leaves the library, becomes Changes requested with your comments, and returns to the queue on resubmission. Use it when something must be fixed.
  - **Retire from library** removes it from the catalogue and revokes reader access, with a required reason. Use it when it is obsolete or replaced.
  Both are live since 2026-10-02.
- A retired record keeps its history and its reason is visible to the owner in My submissions. The owner can later withdraw it to Draft, refresh it and resubmit.
- Every action carries the record's row version. If someone else changed it first, the action is rejected; reopen the record and review the latest version.

Librarians cannot edit a contributor's content in the app; return it with comments instead. Owners can withdraw Pending, Published or Retired records to Draft at any time, which also revokes reader access.

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
- [ ] Exactly one capability is selected; tags are sensible; no duplicate technologies introduced. The connected review panel lists **New technologies** (no other published solution uses them) with the existing ones they resemble; if one repeats an existing technology, request changes and name the existing one
- [ ] Thumbnail present or the generated poster is acceptable
- [ ] At least one unique person, each with credible minimum hours required (every maturity): finite, nonnegative, at most two decimals. Check the [schema contract](../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort)
- [ ] Client demo or production solutions saved before 2026-10-08 may show "Incomplete" effort: their contributors have dates from the retired model but no hours (existing rows are test data). Ask the owner to enter minimum hours rather than deriving them from the old dates
- [ ] Project links, if present, meet [intake criteria](../data_model/SchemaV2.md#intake-triage-not-every-legacy-record-gets-linked-to-a-solution); client engagement names and per-person effort details do not appear in present mode

**Outcomes:** approve client-safe content (Published, Client Safe Reviewed true, Review Outcome Approved), or request changes (Draft, Review Outcome Changes requested, required Review Comments and both safety booleans false). Approval revalidates submission completeness. Acknowledgment and historical outcome alone never grant clearance. The connected app enforces this through [controlled transitions](../architecture/security-model.md#controlled-transitions); the PoC only simulates the role.

**Re-reviews:** a published record must be withdrawn to Draft before its owner can edit it; withdrawal removes it from the catalogue and clears client-safe approval, and resubmission returns it to *Pending review*. A diff and audit history remain follow-up work.

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
