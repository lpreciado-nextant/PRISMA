# Librarian runbook

**Status:** Planned review workflow, aligned with safety-first submission; UI deferred · **Last updated:** 2026-09-21
**Role definition:** [End-to-end design §2.3](../design/end-to-end-design.md#23-librarian-admin)

The librarian owns library quality: consistent, accurate, non-embarrassing entries; no stale content presented to clients. The librarian is **the only role that can publish** — this is the quality gate that makes sales use safe.

## Reviewing a submission

Planned queue at `/review`, with Teams/Outlook notifications in production. Neither exists in the current PoC; contributor submissions remain local and pending.

**Checklist before approving:**

- [ ] Name, one-liner, and body text read well and would not embarrass anyone on a client screen
- [ ] New submission contains one to six detail images; images alone are sufficient; thumbnail alone is not
- [ ] Uploaded HTML files reviewed for active content (sandboxing is defence in depth, not a substitute)
- [ ] Legacy hosted URLs load; new submissions use images, HTML, video or one-pagers/slides only
- [ ] Safety acknowledgment is present; independently verify authorized, anonymized descriptions and media
- [ ] Client identity stays internal; anonymous context is supplied when a client is named; no identifying details leak through body text or attachments
- [ ] Tags are sensible; no duplicate technologies introduced
- [ ] Thumbnail present or the generated poster is acceptable
- [ ] At least one unique person with credible direct hours for ideas/prototypes or dates/allocation for demos/production
- [ ] Calendar-mode contributions have covered US dates and valid 0-100% allocation; direct hours are finite and nonnegative, at most two decimals. Check the [schema contract](../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort)
- [ ] Project links, if present, meet [intake criteria](../data_model/SchemaV2.md#intake-triage-not-every-legacy-record-gets-linked-to-a-solution); client engagement names and per-person effort details do not appear in present mode

**Outcomes:** approve client-safe content (set Client Safe Reviewed and Published), or request changes (Draft with a note). Acknowledgment never grants clearance. Material edits clear Client Safe Reviewed and require fresh acknowledgment.

**Re-reviews:** a contributor edit to a published record returns it to *Pending review* with a diff of what changed. Trivial edits (typo in library notes) don't re-enter the queue; an auto-approve path for minor edits mitigates bottleneck risk (R4).

**SLA:** _TBD — set with the librarian team (see risk R4: more than one librarian, SLA on review)._

## Retiring a record

Retire when stale, superseded, or client-sensitive. Retired records leave search/browse but keep their history; a refreshed record can be re-approved back to *Published*.

## Reference data upkeep

- Add governed values (capabilities, industries, specialization areas) as the practice evolves — contributors cannot.
- Periodically merge duplicate technologies ([governance](../data_model/reference-data-governance.md)).
- Maintain sort orders that drive tab/chip/facet ordering.
- Review US federal holiday coverage and publish a new calendar version before the current period expires; the PoC currently covers only 2026. Do not edit referenced calendar versions or silently recalculate production history ([calendar stewardship](../data_model/reference-data-governance.md#calendar-stewardship)).

## Recurring duties

| Cadence | Duty |
|---|---|
| Per submission | Review checklist above |
| Periodic | Link-health and staleness review ([content health](content-health.md)) |
| Periodic | Technology duplicate merge |
| Annual | Re-confirmation prompt cycle to contributors |
| Before Phase 3 | Deliberate client-safe review of **every** published record |
