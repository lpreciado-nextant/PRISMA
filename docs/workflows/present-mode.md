# Present mode

**Status:** Agreed safety-first contract; PoC mirror implemented; solution side column split into client-facing and internal cards 2026-10-14; Refine filters behind a Filters button and Selected for you 2026-10-23; connected switch limited to library pages 2026-10-27 · **Last updated:** 2026-10-27
**Source:** [End-to-end design §3.4](../design/end-to-end-design.md#34-present-mode)
**Principle:** never embarrass a CSM in front of a client. Present mode **restricts** rather than merely hides.

One switch in the masthead, flipped before the CSM shares their screen. Since 2026-10-27 the connected app offers it only on the library, Saved solutions and a solution's pages (not while submitting, in My submissions, the Review queue or Help); once on, it stays visible everywhere so it can always be turned off. It is a mode over every route, not a separate route — that is what keeps its state persistent ([ADR-0003](../architecture/decisions/adr-0003-hash-routing.md)).

## What it does

| Behaviour | Detail |
|---|---|
| Suppresses internal-only content | Library notes, publication status, review history, per-person hours and effort breakdown, builder names and levels, the CSM, total effort hours (Minimum hours invested), the Capability owner, added date, associated projects and Suggest an improvement: the solution page drops its whole internal card rather than leaving empty headings |
| Restricts the catalogue | Only Published records with Safety Acknowledged and Client Safe Reviewed. Pending or uncleared records are filtered before search/render |
| Offers the CSM's prepared selection | Since 2026-10-23: a **Show my saved solutions** switch under the area filter (only when some saved solution is client-safe; off when present mode starts, remembered while it stays on) shows only the viewer's saved solutions that are in the client-safe catalogue; search and filters work within them. It only narrows the already restricted catalogue and never shows or counts saved solutions that are not cleared. Saved solutions (normal mode) has no present button: one line points to the switch and says how many are cleared, and the others are marked "Not cleared for clients: hidden in present mode". The connected app loads the viewer's favorite IDs in present mode for this; hearts, the Saved solutions link and its count stay hidden. The Refine button reads "Filter by capability, technology & more" in present mode |
| Always excludes client identity | Internal client/context and project fields are removed from the catalogue projection. Only the separately authored anonymous context is used; no runtime scrubbing of text or media |
| Changes the visual treatment | Larger type, minimal chrome, the Refine rail closed by default behind a **Filters** button (same facets as the library, counted over the client-safe catalogue only; since 2026-10-23), full-bleed demo viewer. Sort, the Added window and the grid/list toggle stay out |

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
