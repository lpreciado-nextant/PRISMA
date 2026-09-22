# ADR-0007 - Contributor-level maturity-based effort

**Status:** Accepted; US federal holiday exclusions enforced in code for 2020-2035 with no calendar tables. Implemented in the connected app
**Date:** 2026-09-18
**Last updated:** 2026-09-22

## Context

A Solution can have several builders, each with their own dates and allocation. The single builder lookup and deployment-time category cannot represent that effort. Calculated hours must exclude weekends and observed US federal holidays without depending on browser time zones, and without making holiday data something a Librarian has to maintain.

## Decision

Ideas and working prototypes use directly entered hours per person: finite, nonnegative, at most two decimal places. Client demos and production use the calendar calculation below. Effort Mode follows parent maturity; validate the active inputs, not both modes. Drafts preserve values when switching maturity but do not silently convert them. Direct hours include preparation and discovery; client-demo hours must not be presented as a production delivery estimate.

Use a user/team-owned `nx_solutioncontributor` child table with one row per Solution/person, enforced by the `(Solution, Built By)` alternate key. Store a `cr6b0_consultant` lookup, inclusive Date Only start/end dates and allocation percentage. Attribution does not change parent ownership or grant rights.

**The business-day policy lives in code, not in Dataverse.** There is no `nx_businesscalendar` table, no holiday table, no contributor calendar lookup and no calendar selector. Calendar-mode business days are inclusive Monday-Friday dates minus observed nationwide US federal holidays under the [OPM schedule](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/), computed for dates 2020-01-01 through 2035-12-31. Apply the rules appropriate to each year, including Juneteenth from 2021 onward and observed dates that cross year boundaries. State-specific, company and regional-only holidays are out of scope. Reject invalid dates, reversed ranges and dates outside supported coverage rather than falling back to a weekday-only count. This is a deliberate fixed Monday-Friday, eight-hour-day model, not an integration with personal Outlook calendars or Dataverse resource scheduling.

Calculate person hours as business days times eight times allocation divided by 100, rounded to two decimals; sum the person totals. Derive these values from contributor data rather than storing editable totals or assuming a Dataverse formula column can enumerate holidays. All production writers must enforce the same validation and access rules. Detailed columns and edge cases belong to [schema v2](../../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort).

## Consequences

- Multiple builders receive credit and independently calculated effort. The legacy effort category is retired; capacity-based hours are neither actual timesheets nor deployment lead time.
- Holiday coverage is a code concern. Changing the policy, or extending it beyond 2035, is a code change subject to review and regression tests — not an editable record a Librarian curates, and not something that can drift per environment.
- The calculation is reproducible because the policy is versioned with the source, but it is not independently auditable from Dataverse data alone: a stored contributor row does not record which holiday rules produced its hours.
- One constant allocation/date range per person is supported. Variable allocation periods, nonstandard workweeks and cross-solution capacity planning require a later design change.
- Child ownership/sharing and validation need platform enforcement on every production write, not only in the UI.
- Real migration requires confirmation of direct hours or dates/allocation; none can be recovered reliably from Days/Weeks/Months. The mock catalogue migrates idea/prototype totals into illustrative direct hours without changing those totals; this is not a production backfill rule.

## Implementation

`usBusinessCalendar(startYear, endYear)` in [`app/src/lib/effort.ts`](../../../app/src/lib/effort.ts) derives the observed-holiday set for a year range; `calculateEffort` applies it. The connected app calls `usBusinessCalendar(2020, 2035)` once in [`app/connected/src/draftGraph.ts`](../../../app/connected/src/draftGraph.ts) and computes every contributor total from it.

The `BusinessCalendar` type and the contributor `calendarId` field in `app/src/types.ts` are **code-level constructs — the shape this function returns and the key the mock uses to select it — not Dataverse columns**. The "mock data stays schema-shaped" invariant does not apply to them, and they must not be read as evidence of a calendar table. The look-and-feel PoC in `app/src/` still carries a single hardcoded 2026 holiday list for its illustrative totals; that is a PoC data detail, not a schema or policy question.

## Decision history

- **2026-09-18 — original:** the policy was a pair of organization-owned Dataverse reference tables (`nx_businesscalendar`, `nx_businesscalendarholiday`) maintained by Librarians, with an automatically assigned calendar lookup on the contributor row, and `Built By` pointing at the platform `systemuser` table.
- **2026-09-21 — first revision:** the calendar tables and the contributor lookup were dropped, and `Business Days` briefly became a plain Monday-Friday count with no holiday exclusion at all. `Built By` moved to `cr6b0_consultant`.
- **2026-09-21 — correction:** the user confirmed that removing the calendar tables must **not** remove holiday exclusions. Holidays returned, in code. That is the Decision above; the weekday-only rule never shipped.
