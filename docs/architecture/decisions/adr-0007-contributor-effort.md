# ADR-0007 - Contributor-level maturity-based effort

**Status:** Accepted, amended for direct hours on ideas/prototypes and for US-only calendar policy (business-calendar mechanism later removed — see Update below)
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

## Update — 2026-09-21

The business-calendar mechanism this ADR describes above (`nx_businesscalendar`, `nx_businesscalendarholiday`, the automatically assigned US calendar, and holiday exclusion from the effort calculation) has been **removed from the model**. This section documents the change without rewriting the decision history above.

- `nx_solutioncontributor` no longer carries a `Business Calendar` lookup; the assigned-US-calendar and OPM-holiday-schedule mechanism described in Context/Decision/Consequences above no longer exists.
- `Business Days` is now a plain Monday-Friday count between Start Date and End Date, inclusive — no holiday exclusion of any kind. The formula (`Business Days * 8 * Allocation / 100`, rounded to two decimals per contributor, then summed) is unchanged; only the `Business Days` input changed.
- The `Built By` lookup now points to the custom `cr6b0_consultant` table rather than the platform `systemuser` table (see [SchemaV2.md](../../data_model/SchemaV2.md)).
- The Consequences bullets above about "Calendar versions make calculations reproducible," Librarian review of holiday coverage, and reassignment to the US calendar no longer apply — there is no calendar to review or reassign.

See [schema v2](../../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort) for the current, authoritative derivation.
