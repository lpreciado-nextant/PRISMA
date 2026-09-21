# Present mode

**Status:** Agreed safety-first contract; PoC mirror implemented · **Last updated:** 2026-09-21
**Source:** [End-to-end design §3.4](../design/end-to-end-design.md#34-present-mode)
**Principle:** never embarrass a CSM in front of a client. Present mode **restricts** rather than merely hides.

One switch in the masthead, available from any page, flipped before the CSM shares their screen. It is a mode over every route, not a separate route — that is what keeps its state persistent ([ADR-0003](../architecture/decisions/adr-0003-hash-routing.md)).

## What it does

| Behaviour | Detail |
|---|---|
| Suppresses internal-only content | Library notes, publication status, review history, per-person dates, allocation, calendar and effort breakdown; builder names and aggregate effort hours may remain |
| Restricts the catalogue | Only Published records with Safety Acknowledged and Client Safe Reviewed. Pending or uncleared records are filtered before search/render |
| Always excludes client identity | Internal client/context and project fields are removed from the catalogue projection. Only the separately authored anonymous context is used; no runtime scrubbing of text or media |
| Changes the visual treatment | Larger type, minimal chrome, no filter rail by default, full-bleed demo viewer |

## Enforcement

Client-side filtering alone is not sufficient. Enforce publication, acknowledgment and librarian-controlled review **at the Dataverse level**, with an internal-field-free projection. Submission and My submissions routes redirect to the library in present mode. See [ADR-0005](../architecture/decisions/adr-0005-present-mode-server-side-enforcement.md) and the [security model](../architecture/security-model.md).

## Mode state

- Obvious and persistent: a clear banner, dismissible without leaving the mode — the masthead toggle stays lit.
- A CSM is never unsure which mode they're in.
- **Exiting requires a deliberate action.**

## Trust model

The CSM is always the authenticated driver, screen-sharing their session. No client ever holds a credential or a link — this is how "no client access" and a client-facing present mode are compatible.

## Rollout gate

Phase 3 ships **only after** deliberate client-safe review of every published record. Never infer clearance from legacy classifications or a contributor checkbox. The mock KAIRO and Field Ops records remain excluded.

## PoC mapping

Mode wiring in [`app/src/App.tsx`](../../app/src/App.tsx); banner in [`app/src/components/PresentBanner.tsx`](../../app/src/components/PresentBanner.tsx). The PoC filters the source list before render — the client-side mirror of the server-side filter.
