# Librarian runbook

**Status:** Draft — to be refined with the librarian team · **Last updated:** 2026-09-17
**Role definition:** [End-to-end design §2.3](../design/end-to-end-design.md#23-librarian-admin)

The librarian owns library quality: consistent, accurate, non-embarrassing entries; no stale content presented to clients. The librarian is **the only role that can publish** — this is the quality gate that makes sales use safe.

## Reviewing a submission

Queue at `/review`; new submissions arrive via Teams/Outlook notification.

**Checklist before approving:**

- [ ] Name, one-liner, and body text read well and would not embarrass anyone on a client screen
- [ ] At least one asset a CSM can show **without any setup** — if the primary asset can't be embedded, a video walkthrough exists
- [ ] Uploaded HTML files reviewed for active content (sandboxing is defence in depth, not a substitute)
- [ ] Hosted URLs load; `Allows Embedding` flag matches reality
- [ ] Shareability and sample-data flags are credible for the content
- [ ] If shareability is *Yes, with names removed*: `Client Context (Redacted)` is filled with a generic descriptor and no client name leaks anywhere in body text
- [ ] Tags are sensible; no duplicate technologies introduced
- [ ] Thumbnail present or the generated poster is acceptable

**Outcomes:** approve (→ *Published*) or request changes (→ *Draft*, with a note to the contributor).

**Re-reviews:** a contributor edit to a published record returns it to *Pending review* with a diff of what changed. Trivial edits (typo in library notes) don't re-enter the queue; an auto-approve path for minor edits mitigates bottleneck risk (R4).

**SLA:** _TBD — set with the librarian team (see risk R4: more than one librarian, SLA on review)._

## Retiring a record

Retire when stale, superseded, or client-sensitive. Retired records leave search/browse but keep their history; a refreshed record can be re-approved back to *Published*.

## Reference data upkeep

- Add governed values (capabilities, industries, specialization areas) as the practice evolves — contributors cannot.
- Periodically merge duplicate technologies ([governance](../data_model/reference-data-governance.md)).
- Maintain sort orders that drive tab/chip/facet ordering.

## Recurring duties

| Cadence | Duty |
|---|---|
| Per submission | Review checklist above |
| Periodic | Link-health and staleness review ([content health](content-health.md)) |
| Periodic | Technology duplicate merge |
| Annual | Re-confirmation prompt cycle to contributors |
| Before Phase 3 | Deliberate review of shareability flags on **every** published record |
