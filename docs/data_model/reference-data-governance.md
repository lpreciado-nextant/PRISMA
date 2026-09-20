# Reference data governance

**Status:** Draft for review, including US-only business calendar · **Last updated:** 2026-09-18
**Source:** [End-to-end design §6.4](../design/end-to-end-design.md#64-reference-data-governance) · Column specs in the [schema spec (v2)](SchemaV2.md)

## Vocabularies

| Vocabulary | Table | Governance | Who adds values |
|---|---|---|---|
| Specialization areas | `nx_specializationarea` | **Governed** | Librarian only |
| Capabilities | `nx_capability` | **Governed** | Librarian only |
| Industries | `nx_industry` | **Governed** | Librarian only |
| Technologies | `nx_technology` | **Open** | Contributors, inline at submission; librarian periodically merges duplicates |
| Business calendars | `nx_businesscalendar` | **Governed** | Librarian only; versioned coverage and holiday policy |
| Calendar holidays | `nx_businesscalendarholiday` | **Governed** | Librarian only; one date per calendar, within coverage |

> Use case is not a vocabulary: it lives as a freeform single-line-of-text column on `nx_solution` ([schema spec (v2)](SchemaV2.md)).

Contributor create privilege exists on `nx_technology` only ([security model](../architecture/security-model.md)).

## Why governed vocabularies

- CSMs filter by these constantly — a fragmented vocabulary breaks faceting and live counts.
- Industry is modeled as a table (not a multi-select Choice) because multi-select picklists can't be filtered efficiently and can't carry sort order.

## Why technologies stay open

The technology list grows organically per solution ("React", "Dataverse", "Power Apps code app"). Over-governing it would add submission friction (against the 10-minute budget) for little quality gain. Cost: periodic duplicate merges by the librarian ([runbook](../operations/librarian-runbook.md)).

## Seeding

Reference data is seeded in Phase 1, before any CSM sees the app ([roadmap](../delivery/roadmap.md)). Sort order columns control tab, chip, and facet ordering.

## Admin surface

`/admin/reference-data` (librarian only) — not yet in the PoC.

## Calendar stewardship

All contributors automatically use the US business calendar, using the [OPM observed federal holiday schedule](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/#url=2026); the PoC covers 2026. No calendar selector or alternative policy is offered. State-specific and company holidays are not included. Every calendar version must cover its full stated date range, including observed holidays; weekdays are Monday-Friday and working days are eight hours. Do not silently fall back to weekdays when dates exceed coverage.

Once referenced, calendar coverage and holiday rows are frozen. Publish a new calendar record for extensions/corrections; reassignment of existing contributions is an explicit reviewed action because it changes their calculated effort. The approved US-only PoC change removes both demo calendars and reassigns all mock records and restored session drafts to the US calendar. See [schema v2](SchemaV2.md#nx_businesscalendar--business-day-calendar-version) and [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md).
