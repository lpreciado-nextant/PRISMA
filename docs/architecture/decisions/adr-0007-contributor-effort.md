# ADR-0007 - Contributor-level effort in minimum hours required

**Status:** Accepted; revised 2026-10-08 to directly entered minimum hours at every maturity (calendar/allocation model retired) and to derive the CSM from the consultant directory level (`nx_role` retired). Implemented in code; plug-ins and connected app not yet deployed
**Date:** 2026-09-18
**Last updated:** 2026-10-08

## Context

A Solution can have several builders, each contributing different effort. The single builder lookup and deployment-time category cannot represent that. What a CSM needs is how much work the solution took, per person, not a capacity schedule: dates and allocation added inputs without adding meaning, and the business-day calculation they drove had to carry a holiday policy in code.

## Decision

Every maturity (Idea / concept, Working prototype, Client demo, Live in production) takes directly entered hours per person. Those hours are **the minimum hours that person needed to work on the solution**, including preparation and discovery (UI label "Minimum hours required"). Hours are finite, nonnegative, at most 1,000,000,000 and at most two decimal places. Every contributor needs hours to submit or approve; drafts may be incomplete, and empty is not zero. Total effort is the sum of person hours. It is neither a timesheet nor a delivery estimate, and client-demo hours must not be presented as a production estimate.

Use a user/team-owned `nx_solutioncontributor` child table with one row per Solution/person, enforced by the `(Solution, Built By)` alternate key. Store a `cr6b0_consultant` lookup and the person's hours in `nx_directhours`. Attribution does not change parent ownership or grant rights.

There are no dates, allocation, business days, holiday policy or calendar tables. All production writers must enforce the same validation and access rules. Detailed columns belong to [schema v2](../../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort).

### CSM from the consultant level

Nothing role-related is entered per contributor. The person's role and level already live in the consultant directory, `cr6b0_consultant.cr6b0_consultantlevel` (free text, e.g. "Senior Consultant", "Customer Success Manager II"), so the contributor choice `nx_solutioncontributor.nx_role` (CSM · Consultant) is retired as redundant. The form shows the selected person's level read-only ("Not recorded in the consultant directory" when empty). A contributor whose level names customer success (`isCustomerSuccessLevel` in [`consultantLevel.ts`](../../../app/src/lib/consultantLevel.ts): case-insensitive, with or without the space, tolerating the one-s misspelling) is the solution's CSM: listed as CSM in the detail view, passed as the CSM to the PowerPoint download, and left out of builder names on PoC cards. Everyone else is a builder, shown as "name · level". A CSM is an ordinary contributor row with hours. PRISMA never writes the directory level, so a wrong level is fixed in the directory, not in PRISMA.

## Consequences

- Multiple builders receive credit and independent hours. The legacy effort category is retired.
- Effort is self-reported and not derivable from other data; review checks it for credibility, not arithmetic.
- `nx_startdate`, `nx_enddate` and `nx_allocationpercent` remain in Dataverse but are no longer read or written; `nx_effortmode` is written as Direct for every save. Deleting the retired columns is a separate, separately approved schema change.
- Client demo and production rows saved under the calendar model have dates and allocation but no hours. They show "Incomplete" effort until someone enters minimum hours. They were not backfilled automatically: calendar hours were estimated capacity, a different meaning from minimum hours required.
- Child ownership/sharing and validation need platform enforcement on every production write, not only in the UI.
- Real migration from the legacy category requires confirmed hours; they cannot be recovered from Days/Weeks/Months.
- CSM identification depends on directory data quality: a CSM whose level does not name customer success is shown as a builder. The user confirmed on 2026-10-08 that directory levels for CSMs do name customer success. Existing `nx_role` values are ignored.
- `nx_role` is deleted from Dataverse by the user only after the new plug-ins are deployed; the deployed plug-in still selects it.

## Implementation

[`app/src/lib/effort.ts`](../../../app/src/lib/effort.ts) exports only `contributorHours(hours)` (validation) and `MAX_CONTRIBUTOR_HOURS`, shared by the PoC and the connected app. The plug-in `ContributorPolicy` enforces the same bounds; `ContributorInput` carries only id, person and hours. `DraftGraph.Parse` still accepts and ignores `startDate`, `endDate`, `allocation` and `roleValue` from older clients, and graph JSON no longer returns `roleValue`. The connected app reads `cr6b0_consultantlevel` with the consultant directory (draft picker references, submission detail names); `nx_GetPublishedDetail` (`PublishedApi`) returns each credit's `level`, omitted in present mode like email (present mode returns no credits). The catalogue card graph (`CatalogueApi`) is unchanged: connected cards list every contributor name. The mock `BUILDERS`/`CSMS` carry illustrative levels on `builtBy`. Graph and published hours are `nx_directhours` as stored; the published detail returns a null total when any contributor has no hours instead of failing.

The mock catalogue gives every contributor `directHours` equal to its former calculated total, so sample totals are unchanged (the BSO Quota sample still totals 218 hours).

Deployment order, when approved: plug-ins first, then the connected app, and only then may the user delete `nx_role`. An older plug-in still demands dates and allocation for Client demo and production submissions, and selects `nx_role` in its column sets: deleting the column first would break draft graph reads, submission review and published detail.

## Decision history

- **2026-09-18 — original:** ideas and prototypes took direct hours; client demos and production derived hours from per-person dates and allocation over a business calendar held in organization-owned Dataverse tables (`nx_businesscalendar`, `nx_businesscalendarholiday`) maintained by Librarians, with an automatically assigned calendar lookup on the contributor row, and `Built By` pointing at the platform `systemuser` table.
- **2026-09-21 — first revision:** the calendar tables and the contributor lookup were dropped, and `Business Days` briefly became a plain Monday-Friday count with no holiday exclusion. `Built By` moved to `cr6b0_consultant`.
- **2026-09-21 — correction:** holiday exclusions returned, in code: inclusive Monday-Friday dates minus observed US federal holidays (OPM schedule, 2020-2035), times eight times allocation / 100, rounded to two decimals; Effort Mode Direct for ideas/prototypes and Calendar for demos/production.
- **2026-10-08 — direct hours at every maturity:** the calendar/allocation model was retired ([PR-029](../../delivery/change-log.md)). Allocation was unnecessary, and hours now mean the minimum time each person needed, which a capacity calculation does not express. The holiday policy, `usBusinessCalendar`, `calculateEffort`, effort modes and the contributor date/allocation fields were removed from the app and plug-ins. That is the Decision above.
- **2026-10-08 — CSM from the consultant level:** `nx_solutioncontributor.nx_role` (added 2026-09-23 in place of a `nx_leadcsm` lookup, deployed 2026-09-28) was retired as redundant with `cr6b0_consultantlevel`. The role picker, `roleValue`, `CONTRIBUTOR_ROLES` and the `ContributorRole` type were removed; the open CSM-row questions (effort, cardinality, minimum) lapse because a CSM is an ordinary contributor. See [CSM from the consultant level](#csm-from-the-consultant-level).
