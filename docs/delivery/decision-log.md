# Decision log — open questions

**Status:** Living; PAC-verified connected-app security and schema decisions pending · **Last updated:** 2026-09-21
**Source:** [End-to-end design §11](../design/end-to-end-design.md#11-open-questions)

Open questions live here until they resolve. Resolutions with lasting technical consequences become an [ADR](../architecture/decisions/README.md); the rest are recorded inline and reflected in the relevant doc.

| # | Question | Owner | Status | Resolution |
|---|---|---|---|---|
| Q1 | Who owns the Librarian role, and how many people hold it? | _TBD_ | Open | — |
| Q2 | How many CSMs are in the target audience, and what's the pilot group? | _TBD_ | Open | — |
| Q3 | Is there a target launch date or a pursuit deadline driving timing? | _TBD_ | Open | — |
| Q4 | Where does the initial set of 40 solutions come from — is there an existing inventory to import from the intake workbook? | _TBD_ | Open | — |
| Q5 | What are the licensing implications of the code app for the full internal audience? (Power Apps Premium licence required for end users) | _TBD_ | Open | — |
| Q6 | Should the demo-request handoff route to the builder directly, or to their practice lead? | _TBD_ | Open | — |
| Q7 | Is there an existing Nextant one-pager template that the downloadable asset should conform to? | _TBD_ | Open | — |
| Q8 | Retain live UserOwned reference tables with organization-level read privileges, or migrate to the design's organization-owned model? | Platform owner | Open | Recommended: retain existing tables and configure explicit privileges; never recreate Consultant/Project. All 11 exported tables are UserOwned. |
| Q9 | Who approves and provisions contributor/CSM/librarian roles, field profiles and least-privilege test identities? | Platform owner + Librarian owner | Open | The solution contains a PRISMA Librarian field profile, but no table roles; Review Outcome/Comments are not field-secured. Existing effective environment privileges remain to be checked. |
| Q10 | Approve metadata alignment for incomplete drafts and the server-side transition/child/file guards? | Platform owner | Open | Capability is ApplicationRequired; live text lengths exceed some product limits. ADR-0008 handlers are not present in the inspected solution. |
| Q11 | What is the production deletion policy and cleanup behavior for published/owned solutions? | Product + Platform owner | Open | PoC permits owner deletion in any state; live child links use RemoveLink on delete and NoCascade on share/assign. Do not inherit the local simulation as production policy. |

## Resolved

2026-09-21: preserve the existing live **PRISMA PoC** app as the mock UI test environment. Create a separate backend-connected **PRISMA** app in Nextant Pulse. Full read/write, media and authorized review must pass verification before publication; no read-only first release. See the [integration plan](../architecture/technical-architecture.md#connected-app-integration-plan).
