# ADR-0007 - Contributor-level calendar-based effort

**Status:** Accepted, amended for US-only calendar policy
**Date:** 2026-09-18
**Last updated:** 2026-09-18

## Context

A Solution can have several builders, each with their own dates and allocation. The single builder lookup and deployment-time category cannot represent that effort. Calculated hours must exclude weekends and calendar holidays without depending on browser time zones.

## Decision

Use a user/team-owned `nx_solutioncontributor` child table with one row per Solution/person, enforced by an alternate key. Store a `systemuser` lookup, inclusive Date Only start/end dates, allocation percentage and an automatically assigned US business-calendar lookup. No calendar selector or alternative policy is offered. Attribution does not change parent ownership or grant rights.

Use organization-owned `nx_businesscalendar` and `nx_businesscalendarholiday` reference tables, maintained by Librarians. Each calendar covers an explicit period and is immutable once used; publish a new record for corrections/extensions. This is a deliberate fixed Monday-Friday, eight-hour-day model, not an integration with personal Outlook calendars or Dataverse resource scheduling.

Calculate person hours as business days times eight times allocation divided by 100, rounded to two decimals; sum the person totals. Derive these values in the app from contributor/calendar data rather than storing editable totals or assuming a Dataverse formula column can enumerate holidays. All production writers must enforce the same validation and access rules. Detailed columns and edge cases belong to [schema v2](../../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort).

## Consequences

- Multiple builders receive credit and independently calculated effort. The legacy effort category is retired; capacity-based hours are neither actual timesheets nor deployment lead time.
- Calendar versions make calculations reproducible. Librarians must review complete holiday coverage; unknown or out-of-coverage calendars block calculation.
- One constant allocation/date range per person is supported. Variable allocation periods, nonstandard workweeks and cross-solution capacity planning require a later design change.
- Child ownership/sharing and validation need platform enforcement before real Dataverse integration. The PoC remains mock-only; effort inputs are illustrative, while its sole calendar uses the OPM 2026 observed federal holidays. Legacy demo calendars are removed and mock records/restored drafts are reassigned to the US calendar, recalculating their totals.
- Real migration requires confirmation of dates, allocation and calendar; none can be recovered reliably from Days/Weeks/Months.