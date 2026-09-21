# Content health

**Status:** Draft, client-safe review controls aligned · **Last updated:** 2026-09-21
**Addresses risks:** R3 (demos break silently) and R5 (stale content presented as current) in the [risk register](../delivery/risks.md)

CSM trust, once eroded by a broken embed or a stale demo, is unrecoverable. Content health is proactive, not complaint-driven.

## Link health

- **What:** periodic check that every hosted-URL asset still loads, and that assets flagged `Allows Embedding` still embed.
- **How:** _TBD — candidate: scheduled Power Automate flow that pings asset URLs and posts failures to the librarian channel (notifications only, consistent with [ADR-0006](../architecture/decisions/adr-0006-power-automate-notifications-only.md))._
- **On failure:** librarian flips `Allows Embedding` off or retires the asset; the video walkthrough fallback keeps the solution presentable.

## Staleness review

- `Date Added` is surfaced on cards so age is visible to CSMs.
- Librarian-driven periodic review of oldest published records.
- **Annual re-confirmation:** each contributor is prompted yearly to confirm their published records are still current; unconfirmed records are candidates for retirement.

## Retirement triggers

| Trigger | Action |
|---|---|
| Superseded by a newer solution | Retire; link forward in library notes |
| Demo no longer runnable and no fallback exists | Retire until refreshed |
| Client sensitivity discovered post-publication | Retire immediately, clear Client Safe Reviewed, and require fresh review of all client-visible text/media |
| Contributor confirms stale / no response to re-confirmation | Retire |

## Cadences

| Check | Cadence |
|---|---|
| Link-health run | _TBD (suggest weekly)_ |
| Staleness review | _TBD (suggest quarterly)_ |
| Re-confirmation cycle | Annual |
