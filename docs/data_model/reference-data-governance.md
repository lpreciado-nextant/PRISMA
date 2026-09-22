# Reference data governance

**Status:** Agreed governance; controlled inline technology creation in implementation · **Last updated:** 2026-09-22
**Source:** [End-to-end design §6.4](../design/end-to-end-design.md#64-reference-data-governance) · Column specs in the [schema spec (v2)](SchemaV2.md)

## Vocabularies

| Vocabulary | Table | Governance | Who adds values |
|---|---|---|---|
| Specialization areas | `nx_specializationarea` | **Governed** | Librarian only |
| Capabilities | `nx_capability` | **Governed** | Librarian only |
| Industries | `nx_industry` | **Governed** | Librarian only |
| Technologies | `nx_technology` | **Open** | Contributors, inline at submission; librarian periodically merges duplicates |

> Use case is not a vocabulary: it lives as a freeform single-line-of-text column on `nx_solution` ([schema spec (v2)](SchemaV2.md)).

The connected app creates technologies through `nx_TransitionSubmission` action `technology`, not direct client CRUD. Require an owned Draft and exact parent version; trim names, reject empty/control characters and names over 100 characters, and reuse an active case-insensitive match. New rows are caller-owned. The existing graph operation attaches the returned ID. Clear safety acknowledgment and clearance without changing review feedback. Failed or ambiguous writes require reopen. Case-insensitive lookup avoids ordinary duplicate entry; simultaneous creation on different drafts can still race and remains subject to librarian duplicate merges. No new privileges or Consultant/Project writes are required.

## Why governed vocabularies

- CSMs filter by these constantly — a fragmented vocabulary breaks faceting and live counts.
- Industry is modeled as a table (not a multi-select Choice) because multi-select picklists can't be filtered efficiently and can't carry sort order.
- Capability is a single-valued lookup rather than a tag, same shape as Specialization Area — one Capability per Solution, governed the same way.

## Why technologies stay open

The technology list grows organically per solution ("React", "Dataverse", "Power Apps code app"). Over-governing it would add submission friction (against the 10-minute budget) for little quality gain. Cost: periodic duplicate merges by the librarian ([runbook](../operations/librarian-runbook.md)).

## Seeding

Reference data is seeded in Phase 1, before any CSM sees the app ([roadmap](../delivery/roadmap.md)). Sort order columns control tab, chip, and facet ordering.

## Admin surface

`/admin/reference-data` (librarian only) — not yet in the PoC.

## Business days

There are no business-calendar or holiday reference tables and no Librarian-maintained calendar records. `Business Days` on `nx_solutioncontributor` counts Monday-Friday between Start Date and End Date, inclusive, excluding observed US federal holidays calculated in code for 2020-2035; working days are eight hours. Policy changes require a reviewed code change and regression checks, not reference-data editing. Existing 2026 effort totals must remain unchanged when the app adopts multi-year coverage. See [schema v2](SchemaV2.md#nx_solutioncontributor--builders-and-effort) for holiday rules and coverage validation, and [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md) for the decision history.
