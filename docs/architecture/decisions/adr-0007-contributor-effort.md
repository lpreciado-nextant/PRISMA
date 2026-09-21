# ADR-0007 - Contributor-level maturity-based effort

**Status:** Accepted, amended to retain US federal holiday exclusions in code for 2020-2035 without calendar tables; implementation pending (see final override below)
**Date:** 2026-09-18
**Last updated:** 2026-09-21

## Context

A Solution can have several builders, each with their own dates and allocation. The single builder lookup and deployment-time category cannot represent that effort. Calculated hours must exclude weekends and calendar holidays without depending on browser time zones.

## Decision

Ideas and working prototypes use directly entered hours per person: finite, nonnegative, at most two decimal places. Client demos and production retain the calendar calculation below. Effort Mode follows parent maturity; validate the active inputs, not both modes. Drafts preserve values when switching maturity but do not silently convert them. Direct hours include preparation and discovery; client-demo hours must not be presented as a production delivery estimate.

Use a user/team-owned `nx_solutioncontributor` child table with one row per Solution/person, enforced by an alternate key. Store a `systemuser` lookup, inclusive Date Only start/end dates, allocation percentage and an automatically assigned US business-calendar lookup. No calendar selector or alternative policy is offered. Attribution does not change parent ownership or grant rights.

Use organization-owned `nx_businesscalendar` and `nx_businesscalendarholiday` reference tables, maintained by Librarians. Each calendar covers an explicit period and is immutable once used; publish a new record for corrections/extensions. This is a deliberate fixed Monday-Friday, eight-hour-day model, not an integration with personal Outlook calendars or Dataverse resource scheduling.

Calculate person hours as business days times eight times allocation divided by 100, rounded to two decimals; sum the person totals. Derive these values in the app from contributor/calendar data rather than storing editable totals or assuming a Dataverse formula column can enumerate holidays. All production writers must enforce the same validation and access rules. Detailed columns and edge cases belong to [schema v2](../../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort).

## Consequences

- Multiple builders receive credit and independently calculated effort. The legacy effort category is retired; capacity-based hours are neither actual timesheets nor deployment lead time.
- Calendar versions make calculations reproducible. Librarians must review complete holiday coverage; unknown or out-of-coverage calendars block calculation.
- One constant allocation/date range per person is supported. Variable allocation periods, nonstandard workweeks and cross-solution capacity planning require a later design change.
- Child ownership/sharing and validation need platform enforcement before real Dataverse integration. The PoC remains mock-only; effort inputs are illustrative, while its sole calendar uses the OPM 2026 observed federal holidays. Legacy demo calendars are removed and mock records/restored drafts are reassigned to the US calendar, recalculating their totals.
- Real migration requires confirmation of direct hours or dates/allocation; none can be recovered reliably from Days/Weeks/Months. The mock catalogue migrates idea/prototype totals into illustrative direct hours without changing those totals; this is not a production backfill rule.

## Superseded Update — 2026-09-21

The merged documentation proposed removing the business-calendar mechanism described above (`nx_businesscalendar`, `nx_businesscalendarholiday`, the automatically assigned US calendar, and holiday exclusion from the effort calculation). This section preserves that decision history; the final override below supersedes its weekday-only policy.

- `nx_solutioncontributor` no longer carries a `Business Calendar` lookup; the assigned-US-calendar and OPM-holiday-schedule mechanism described in Context/Decision/Consequences above no longer exists.
- `Business Days` is now a plain Monday-Friday count between Start Date and End Date, inclusive — no holiday exclusion of any kind. The formula (`Business Days * 8 * Allocation / 100`, rounded to two decimals per contributor, then summed) is unchanged; only the `Business Days` input changed.
- The `Built By` lookup now points to the custom `cr6b0_consultant` table rather than the platform `systemuser` table (see [SchemaV2.md](../../data_model/SchemaV2.md)).
- The Consequences bullets above about "Calendar versions make calculations reproducible," Librarian review of holiday coverage, and reassignment to the US calendar no longer apply — there is no calendar to review or reassign.

## Final Override — 2026-09-21

The user confirmed that removing Dataverse calendar tables must **not** remove US holiday exclusions. This is the current decision:

- Retain observed nationwide US federal holidays, enforced in code for dates 2020-01-01 through 2035-12-31. Apply rules appropriate to each year, including Juneteenth from 2021 and observed dates that cross year boundaries. State-specific, company, and regional-only holidays remain out of scope.
- Keep `nx_businesscalendar`, `nx_businesscalendarholiday`, and the contributor calendar lookup out of the model. There is no calendar selector or Librarian-managed calendar data.
- Calendar-mode business days are inclusive Monday-Friday dates minus observed holidays. Reject invalid dates, reversed ranges, and dates outside supported coverage. Preserve date-only arithmetic, eight-hour days, per-person rounding, and the sum of rounded totals. Direct-hour behavior is unchanged.
- Remove obsolete calendar IDs from mock contributors and restored drafts during app alignment, preserving dates, allocations, direct hours, and existing 2026 totals. Code policy changes require review and regression checks rather than editable calendar records.
- Keep the merged consultant and project decisions. This override affects only the calendar policy, not identities, capability cardinality, or project relationships.
- The current mock app still uses its 2026 in-memory calendar. Multi-year code-based support is agreed but not implemented by this documentation change. Live Dataverse integration and deployment remain out of scope.

See [schema v2](../../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort) for the current, authoritative derivation.
