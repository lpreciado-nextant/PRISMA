# Roadmap

**Status:** Living, revised submission scope agreed · **Last updated:** 2026-09-21
**Source:** [End-to-end design §9](../design/end-to-end-design.md#9-delivery-phases)

Phases 2 and 3 justify the project to a CSM; phase 4 keeps it alive. Neither can be dropped.

| Phase | Scope | Proves | Status |
|---|---|---|---|
| **1 — Foundation** | Dataverse schema incl. §6 deltas, security roles, reference data seeded, librarian-only bulk entry of the initial known solutions | G2 is achievable before any CSM sees the app | Not started |
| **2 — Discovery** | Card grid, specialization tabs, search, facets, solution detail, asset viewer — the CSM read path end to end, ported from the PoC's visual language | G1 | Not started |
| **3 — Present mode** | Client-safe restriction and anonymous context. **Gated by independent Client Safe Reviewed approval on every presented record** | G3 safety | Mock mirror implemented; platform enforcement pending |
| **4 — Contribution** | Guided submission form, draft saving, review queue, notifications — opens the library to the whole firm | G2 at scale | Not started |
| **5 — Handoff** | Demo requests, contributor dashboards, one-pager downloads | G3/G4 | Not started |

## Current state

- **Look-and-feel PoC** implemented in [`app/`](../../app/README.md) — the visual and interaction reference for phases 2–4. Mock in-memory data shaped like the Dataverse schema.
- Design doc and schema spec drafted for review.

## Milestone log

| Date | Milestone |
|---|---|
| 2026-09-16 | End-to-end design draft; PoC demonstrating hero flow, submission form, present mode |
| 2026-09-17 | Documentation structure established |
