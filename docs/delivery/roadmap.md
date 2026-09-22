# Roadmap

**Status:** Living; retirement/concurrency and small-catalogue performance tested; real URL, delivery/playback, cross-account and hosted gates pending · **Last updated:** 2026-09-22
**Source:** [End-to-end design §9](../design/end-to-end-design.md#9-delivery-phases)

Phases 2 and 3 justify the project to a CSM; phase 4 keeps it alive. Neither can be dropped.

| Phase | Scope | Proves | Status |
|---|---|---|---|
| **1 — Foundation** | Dataverse schema incl. §6 deltas, security roles, reference data seeded, librarian-only bulk entry of the initial known solutions | G2 is achievable before any CSM sees the app | Tables exist; reference data partially seeded; schema/security gaps open |
| **2 — Discovery** | Card grid, search, facets, connected detail/gallery/viewer | G1 | Twelve-record benchmark improved to 1.52s data load/1.94s UI; larger-scale and non-admin acceptance pending |
| **3 — Present mode** | Server-restricted eligible catalogue and projection | G3 safety | Published present-mode redaction passed; non-admin permissions and hosted acceptance pending |
| **4 — Contribution** | Draft graph, media, submission and review | G2 at scale | Privileged lifecycle, retirement/restoration, two-tab conflicts and upload recovery passed; real-URL truncation and cross-account/non-admin acceptance unresolved; notifications absent |
| **5 — Handoff** | Demo requests, contributor dashboards, one-pager downloads | G3/G4 | Not started |

## Current state

- **Power Platform solution:** PAC verified `PRISMA_Dev` in **Nextant Pulse**, with controlled APIs, synchronous guards and user-approved pilot role/profile/readers assignments. The disposable published lifecycle fixture was withdrawn and deleted; three original drafts remain and the published catalogue is empty again. See the [inventory and deployed scope](../architecture/technical-architecture.md#deployed-core-draft-backend) and [lifecycle evidence](../workflows/contribution-and-review.md#verified-lifecycle).
- **Look-and-feel PoC** implemented in [`app/`](../../app/README.md) — the visual and interaction reference for phases 2–4. Mock in-memory data shaped like the Dataverse schema.
- **Connected app:** separate PRISMA target; preserve the live PoC as UI testing. Full read/write and backend authorization must work before publishing the new app. Execute the [integration plan](../architecture/technical-architecture.md#connected-app-integration-plan); resolve [platform decisions](decision-log.md) before changing shared security/schema.
- Design doc and schema spec drafted for review.

## Milestone log

| Date | Milestone |
|---|---|
| 2026-09-16 | End-to-end design draft; PoC demonstrating hero flow, submission form, present mode |
| 2026-09-17 | Documentation structure established |
| 2026-09-21 | PAC inventory completed; separate mock/connected app strategy and full read/write first-release gate agreed |
| 2026-09-21 | Separate local connected catalogue UI and SDK adapter added; both builds, lint and 22 tests pass; authenticated Local Play verification pending |
| 2026-09-22 | Core APIs/guards deployed; Local Play create/update/reload/reopen and stale-save recovery verified. Both builds, lint and 40 tests pass; non-admin verification and complete workflow remain release blockers. No app published. |
| 2026-09-22 | Graph/media/review/published-detail APIs deployed; private upload table and empty custodian/readers teams approved. Owner graph/media/submit/withdraw verified; 64 tests. User deferred non-admin tests and will make assignments. Connected publication remains blocked. |
