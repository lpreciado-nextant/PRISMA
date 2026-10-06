# Architecture decision records

**Status:** Living; ADR-0010 deployed and enabled for the pilot, ADR-0006 not yet implemented, ADR-0011 column created · **Last updated:** 2026-10-06

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
| [0007](adr-0007-contributor-effort.md) | Contributor-level maturity-based effort | Accepted; holiday policy in code, no calendar tables |
| [0008](adr-0008-controlled-submission-transitions.md) | Controlled submission transitions | Accepted; deployed, acceptance pending |
| [0009](adr-0009-mediated-media-and-publication-access.md) | Mediated media and publication access | Accepted; deployed, least-privilege verification pending |
| [0010](adr-0010-attachments-in-blob-through-plugins.md) | Uploaded attachments in Azure Blob through Dataverse plug-ins | Accepted for pilot; deployed and enabled 2026-09-29, non-admin acceptance pending |
| [0011](adr-0011-asset-purpose.md) | Asset purpose on demo assets | Accepted; column created 2026-10-06; plug-in awaiting deploy; app in code |

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
