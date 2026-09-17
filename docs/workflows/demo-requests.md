# Demo requests — the live-demo handoff

**Status:** Draft for review · **Last updated:** 2026-09-17
**Source:** [End-to-end design §3.3](../design/end-to-end-design.md#33-demo-assets) and [§6.3](../design/end-to-end-design.md#63-new-table-nx_demorequest)

The escape hatch for solutions that can't be self-served (desktop apps, scripts, anything needing setup), and a signal of which solutions matter to the business (G3).

## Flow

1. CSM picks a solution and raises a request with context: client, opportunity, needed-by date, what they need to show.
2. The builder is notified (Power Automate → Teams/Outlook — notifications only, [ADR-0006](../architecture/decisions/adr-0006-power-automate-notifications-only.md)).
3. The request moves through its status lifecycle.

## Data

Backed by `nx_demorequest` (user/team-owned): solution, requester, client/opportunity context, needed-by date, status.

**Status:** New · Acknowledged · Scheduled · Delivered · Declined

## Privileges

| Role | `nx_demorequest` |
|---|---|
| Contributor | Read own |
| CSM | Create; Read own |
| Librarian | Full |

## Open question

Should the handoff route to the builder directly, or to their practice lead? — tracked in the [decision log](../delivery/decision-log.md).
