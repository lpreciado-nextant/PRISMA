# Architecture decision records

**Status:** Living; ADR-0010 deployed and enabled for the pilot, ADR-0006 not yet implemented, ADR-0011 deployed, ADR-0007 revision deployed 2026-10-08, ADR-0012 live, ADR-0013 proposed (merged, plug-in not deployed), ADR-0014 accepted (on a branch) · **Last updated:** 2026-10-15

Decisions with lasting consequences are recorded here as short ADRs. Open questions live in the [decision log](../../delivery/decision-log.md) until they resolve into an ADR or a doc change.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](adr-0001-dataverse-single-source-of-truth.md) | Dataverse as the single source of truth | Accepted |
| [0002](adr-0002-client-side-search.md) | Client-side search over an in-memory catalogue | Accepted |
| [0003](adr-0003-hash-routing.md) | Hash routing | Accepted; amended 2026-09-30 for `?route=` player deep links |
| [0004](adr-0004-assets-in-dataverse.md) | Assets in Dataverse File/Image columns | Accepted; superseded for new uploaded attachments by 0010 |
| [0005](adr-0005-present-mode-server-side-enforcement.md) | Present mode enforced server-side | Accepted |
| [0006](adr-0006-power-automate-notifications-only.md) | Power Automate for notifications only | Accepted; not yet implemented (no flows exist) |
| [0007](adr-0007-contributor-effort.md) | Contributor-level effort in minimum hours required | Effort superseded by 0014 (2026-10-15); CSM-from-level decision stands. Accepted; revised 2026-10-08 to direct hours at every maturity and a CSM derived from the consultant level; deployed 2026-10-08 |
| [0008](adr-0008-controlled-submission-transitions.md) | Controlled submission transitions | Accepted; deployed, acceptance pending |
| [0009](adr-0009-mediated-media-and-publication-access.md) | Mediated media and publication access | Accepted; deployed, least-privilege verification pending |
| [0010](adr-0010-attachments-in-blob-through-plugins.md) | Uploaded attachments in Azure Blob through Dataverse plug-ins | Accepted for pilot; deployed and enabled 2026-09-29, non-admin acceptance pending |
| [0011](adr-0011-asset-purpose.md) | Asset purpose on demo assets | Accepted; deployed and published 2026-10-06 |
| [0012](adr-0012-private-solution-suggestions.md) | Private suggestions on published solutions | Accepted; live 2026-10-13 |
| [0013](adr-0013-librarian-content-editing.md) | Librarian content editing | Proposed 2026-10-15; implemented on a branch, not deployed |
| [0014](adr-0014-solution-effort-estimate-and-complexity.md) | Solution effort as an estimate and a complexity | Accepted 2026-10-15; columns created, code on a branch, not deployed |

## Template

```markdown
# ADR-NNNN — Title

**Status:** Proposed | Accepted | Superseded by ADR-XXXX
**Date:** YYYY-MM-DD

## Context
What forces are at play; what problem is being decided.

## Decision
What was decided, stated plainly.

## Consequences
What becomes easier, what becomes harder, and any documented ceilings or revisit triggers.
```
