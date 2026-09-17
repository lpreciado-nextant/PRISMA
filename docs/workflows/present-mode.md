# Present mode

**Status:** Draft for review · **Last updated:** 2026-09-17
**Source:** [End-to-end design §3.4](../design/end-to-end-design.md#34-present-mode)
**Principle:** never embarrass a CSM in front of a client. Present mode **restricts** rather than merely hides.

One switch in the masthead, available from any page, flipped before the CSM shares their screen. It is a mode over every route, not a separate route — that is what keeps its state persistent ([ADR-0003](../architecture/decisions/adr-0003-hash-routing.md)).

## What it does

| Behaviour | Detail |
|---|---|
| Suppresses internal-only content | Library notes, publication status, review history, builder-facing metadata |
| Restricts the catalogue | Only solutions flagged *Shareable with clients*. Internal-only solutions disappear from search and browse entirely — there is no way to accidentally surface one |
| Applies client-safe redaction | Where flagged *Yes, with names removed*, the dedicated `Client Context (Redacted)` field replaces client names ("a national logistics provider"). Never runtime string-scrubbing — it is not trustworthy |
| Changes the visual treatment | Larger type, minimal chrome, no filter rail by default, full-bleed demo viewer |

## Enforcement

Client-side filtering alone is not sufficient. The present-mode query filters on shareability **at the Dataverse level**, so a client-visible list can never contain an internal-only record even transiently. See [ADR-0005](../architecture/decisions/adr-0005-present-mode-server-side-enforcement.md) and the [security model](../architecture/security-model.md).

## Mode state

- Obvious and persistent: a clear banner, dismissible without leaving the mode — the masthead toggle stays lit.
- A CSM is never unsure which mode they're in.
- **Exiting requires a deliberate action.**

## Trust model

The CSM is always the authenticated driver, screen-sharing their session. No client ever holds a credential or a link — this is how "no client access" and a client-facing present mode are compatible.

## Rollout gate

Phase 3 ships **only after** a deliberate review of the shareability flags on every published record ([roadmap](../delivery/roadmap.md)).

## PoC mapping

Mode wiring in [`app/src/App.tsx`](../../app/src/App.tsx); banner in [`app/src/components/PresentBanner.tsx`](../../app/src/components/PresentBanner.tsx). The PoC filters the source list before render — the client-side mirror of the server-side filter.
