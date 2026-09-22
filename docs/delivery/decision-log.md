# Decision log — open questions

**Status:** Living; pilot assignments and privileged functional lifecycle verified; cross-account, least-privilege and remaining acceptance open · **Last updated:** 2026-09-22
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
| Q8 | Retain live UserOwned reference tables with organization-level read privileges, or migrate to the design's organization-owned model? | Platform owner | Resolved for core-draft scope | User approved retaining existing tables and scoped PRISMA privileges; all ownership types and Consultant/Project schema/data/security preserved. |
| Q9 | Who provisions roles, profiles and least-privilege identities? | Platform owner + Librarian owner | Approved pilot additions applied; least-privilege tests open | User approved the exact additive account mapping; eight role/profile/team additions were applied transactionally and verified. Michael exists and retains his preexisting Contributor role. Juliana/Luis/Mauricio retain System Administrator; these cannot establish least-privilege acceptance. See [assignment inventory](../architecture/security-model.md#approved-pilot-assignments). |
| Q10 | Approve metadata and controlled graph/media/review changes? | Platform owner | Approved and deployed; functional lifecycle verified | Submit/return/revise/resubmit/approve/withdraw and explicit share grant/revocation passed with a privileged owner/Librarian. User approved the linked-asset submit/approval fix. Cross-account and effective non-admin access/denial tests remain. |
| Q11 | What is the production deletion policy and cleanup behavior for published/owned solutions? | Product + Platform owner | Open | PoC permits owner deletion in any state; live child links use RemoveLink on delete and NoCascade on share/assign. Do not inherit the local simulation as production policy. |
| Q12 | Private upload sessions and non-member media owner team? | Platform owner | Approved and deployed | One organization-owned protocol table and empty Media Custodian owner team; server-held tokens and read-only contributor media. ADR-0009. |
| Q13 | Publication audience? | Platform owner | Approved pilot membership applied | PRISMA Published Readers has the CSM read role; Mauricio was added with explicit user approval. Approval grants row shares and withdrawal/retirement revokes them, but his retained System Administrator access prevents a least-privilege revocation test. Media Custodian remains empty. |

## Resolved

2026-09-22: user approved the proposed additive assignments for Juliana (Contributor A), Michael (Contributor B), Luis (Librarian), and Mauricio (CSM/Published Readers). Applied and verified without removing existing privileges, changing role/profile definitions or publishing either app. Subsequent user-approved testing verified the positive review lifecycle and explicit parent/child reader-share revocation; [evidence and limitations](../workflows/contribution-and-review.md#verified-lifecycle). Effective non-admin and separate-identity acceptance remain open.

2026-09-21: preserve the existing live **PRISMA PoC** app as the mock UI test environment. Create a separate backend-connected **PRISMA** app in Nextant Pulse. Full read/write, media and authorized review must pass verification before publication; no read-only first release. See the [integration plan](../architecture/technical-architecture.md#connected-app-integration-plan).

2026-09-22: approved scoped backend components and core-field draft persistence first, with labelled non-sensitive test records. No app publication, no assignment of other users, no replacement of existing tables or PoC. Save/reopen is verified; the first-release gate is unchanged.

2026-09-22: user expanded work to complete graph, media and controlled review/publication; approved scoped backend deployments and eventual separate-app publication **only after release checks pass**. Permission tests were explicitly deferred; publication remains blocked. Existing Consultant/Project security and the PoC remain unchanged. Notifications, optional media metadata and other [documented parity gaps](../design/end-to-end-design.md#31-contribution--publication) are not silently claimed complete.
