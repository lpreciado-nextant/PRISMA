# Change log by meeting

**Status:** Living · **Last updated:** 2026-10-06

One entry per meeting or working session, newest first. Each entry lists the feedback raised and the changes proposed, and tracks each change until it is live. Keep it short: link to the authoritative doc ([SchemaV2](../data_model/SchemaV2.md), an ADR, the [decision log](decision-log.md)) instead of repeating detail.

Each session has one **Changes** table and one **Progress** percentage computed from it — see "Status values and progress weight" below. There is no separate table for "Proposed" vs. "built": a change stays in the same row and its Status (and the session's %) moves up as it ships.

**Entries** (newest first — jump to a meeting)
| Date | Session | Progress |
|---|---|---|
| [2026-10-01 (Natalia, Andrés)](#2026-10-01--feedback-session-with-natalia-and-andrés-governance-capabilities-and-review) | Governance, capability owners, approval, quality, adoption, required fields, review look and feel | 13% — 2 Live / 16 |
| [2026-10-01](#2026-10-01--working-session-top-3-save-counts-and-card-sizing) | Top 3 save counts and card sizing | 100% — 7 Live / 7 |
| [2026-09-30 (Sebastian)](#2026-09-30--feedback-session-with-sebastian-library-discovery-tag-accessibility-and-solution-detail-clarity) | Library discovery, content freshness, tag accessibility, solution-detail clarity, presentation download, demo filter, allocation, project N:N | 57% — 8 Live, 1 In code / 15 |
| [2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication) | External links, demo viewing experience, effort communication | 7% — 1 Live / 14 |
| [2026-09-28 / 29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux) | Integration, favorites ranking and library UX | 100% — 6 Live / 6 |
| [2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites) | Data model update: Specialization Area, roles, client role, favorites | 83% — 5 Live, 1 Proposed / 6 (1 Dropped excluded) |

**Open decisions still pending** (pulled from the entries below, so you don't have to read each one to check)
- Top 3 shelf vs. new-content visibility (PR-018); manual contrast sign-off (PR-020); One-Liner standardization, still a generic field (PR-023); presentation download format and contents (PR-027); effort calculation without Allocation (PR-029) ([2026-09-30 (Sebastian)](#2026-09-30--feedback-session-with-sebastian-library-discovery-tag-accessibility-and-solution-detail-clarity))
- Approver: PRISMA Librarian, Capability Owner, or both; who may see the approver's name; whether Capability Owners may edit metadata ([2026-10-01 (Natalia, Andrés)](#2026-10-01--feedback-session-with-natalia-and-andrés-governance-capabilities-and-review))
- Schema for lessons learned, tools used and AI usage; one vs. several capabilities per solution; analytics vs. v1 scope ([2026-10-01 (Natalia, Andrés)](#2026-10-01--feedback-session-with-natalia-and-andrés-governance-capabilities-and-review))
- Demo viewing: full-screen is now in code as the primary pattern (Pop out stays for hosted URLs); confirm, and whether a modal is still wanted ([2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication))
- Effort: duration bands vs. Small/Medium/Large vs. both, and whether it replaces ADR-0007's hours model ([2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication))
- Time-tracking integration and workstream/project mapping — not scoped, future release only ([2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication))
- Favorites ranking: whether to also count views/demo requests, and visibility in present mode ([2026-09-28/29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux))
- Specialization areas: max per solution, whether a "primary" area is needed ([2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites))
- `nx_clientrole`: meaning, required at submit?, shown in present mode? ([2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites))
- CSM rows (`nx_role`): effort, cardinality, contributor-minimum counting ([2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites))

When a decision above gets resolved, delete its bullet here and update the matching "Open decisions" bullet in that entry (or move it into the [decision log](decision-log.md) if it needs its own record).

**Status values and progress weight**

| Status | Meaning | Weight |
|---|---|---|
| Proposed | Discussed, not yet built | 0% |
| Done in Dataverse | Table, column or relationship exists in `PRISMA_Dev` (Nextant Pulse) | 25% |
| In code | Implemented on a branch, not yet deployed or published | 50% |
| 🟢 Live | Deployed/published and working in the app | 100% |
| Dropped | Decided against, or replaced by another change | excluded from the total |

**How a session's Progress % is computed:** average the weight of every row in that session's Changes table, dropping `Dropped` rows out of both the sum and the row count (a discarded change neither helps nor hurts progress). Example: 10 changes, 2 Live and 8 Proposed → (2×100 + 8×0) / 10 = 20%. When a row mixes `In code` and `Live` sub-steps, use the most advanced state that is actually deployed. Recompute and update both the entry's **Progress** line and its row in the "Entries" table above whenever a Status changes.

**Template for a new entry**

```markdown
## YYYY-MM-DD — <meeting or session name>

**Attendees:** …
**Progress:** 0% — 0 Live / N (recompute as rows change; see "Status values and progress weight")

### Feedback
- …

### Changes
| Change | Status | Notes / next step |
|---|---|---|
| … | Proposed | … |

### Open decisions
- …
```

---

## 2026-10-01 — Feedback session with Natalia and Andrés: governance, capabilities and review

**Attendees:** Natalia, Andrés
**Progress:** 13% — 2 Live / 16

### Feedback

- Publishing needs a formal approval workflow and governance model: who owns, submits, reviews, approves and maintains each solution, and what quality bar content must meet.
- The approver should be the Capability Owner for the solution, and PRISMA should use the official capability framework the organization is defining.
- Capture lessons learned and insights (blockers, recommendations, implementation notes), not just the solution itself.
- Track how solutions were built: tools used and whether AI contributed, with analytics later.
- Adoption needs a rollout plan, a user guide, training material and in-form guidance for classifying solutions.
- Redefine which submission fields are required, and improve the look and feel of the librarian review.

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| **High** · Define the approval process (Librarian role); proposed approver is the Capability Owner | Proposed | Today the PRISMA Librarian role approves ([runbook](../operations/librarian-runbook.md)). Capability Owner as approver depends on the next row; who sees the approver is [decision log Q17](decision-log.md) |
| **High** · Associate each solution with its Capability Owner | Proposed | `nx_capability` has no owner today; [decision log Q15](decision-log.md) |
| **High** · Align capabilities with the official organization framework | Proposed | Capabilities are governed reference data ([reference-data governance](../data_model/reference-data-governance.md)); load the official list when it is defined |
| **High** · Define the content governance model (ownership, submission, review, approval, maintenance) | Proposed | Builds on [ADR-0008](../architecture/decisions/adr-0008-controlled-submission-transitions.md) and the [content health](../operations/content-health.md) runbook |
| **High** · Define content quality standards | Proposed | The review checklist's Review points list today's publication requirements; quality criteria beyond completeness still to define |
| **High** · Capture lessons learned and insights | Proposed | New content (blockers, recommendations, implementation notes); needs a schema decision |
| **Medium** · Adoption strategy; user guide; training videos and onboarding | Proposed | Rollout and enablement material, outside the app |
| **Medium** · Contextual guidance in forms for classifying solutions and capabilities | Proposed | Builds on the step introductions and field hints already in the submit flow |
| **Medium** · Content curation: may Capability Owners correct metadata before publication? | Proposed | Today librarians cannot edit contributor content; they return it with comments |
| **Medium** · Track tools used to build the solution (Copilot, Cowork, GitHub Copilot, …) and whether AI was used | Proposed | New fields; needs a schema decision |
| **Medium** · Review whether one capability per solution is enough | Proposed | `nx_capability` is a single lookup today ([SchemaV2](../data_model/SchemaV2.md)) |
| **Medium** · Retrieve roles from Azure AD instead of manual entry | Proposed | Evaluate against the contributor and client role fields |
| **Medium** · Effort metadata: whether to capture and show minimum effort estimates | Proposed | Continues the open effort decision from [2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication) |
| **Low** · Adoption analytics (usage, contribution rates, capability coverage) and AI tool analytics | Proposed | Note: analytics dashboards are out of scope for v1 (AGENTS.md); confirm before building |
| Redefine required fields in the submission form | 🟢 Live | One legend per step ("* Required to submit for review. To save a draft, only the solution name is needed."), the same accessible asterisk on every required field and "(optional)" on the rest. `98b88a7`, published 2026-10-02 ([app README](../../app/README.md#required-and-optional-field-marks-2026-10-02)) |
| Improve the librarian review look and feel | 🟢 Live | Review panel (status → checklist → one decision at a time), Review points, review queue filters and state-coloured cards, "Waiting for corrections" and Published blocks. `5460e95`, `ee8dc31`, `e2ca558`, published 2026-10-02 ([runbook](../operations/librarian-runbook.md)). Sending a published record back for changes ("Need to change it?") and a required retire reason are also Live: deployed 2026-10-02 (signed plug-in by Luis, then the connected app) and confirmed working by the user ([decision log Q18](decision-log.md)) |

### Open decisions

- Who approves: the PRISMA Librarian role, the Capability Owner, or both; and who may see the approver's name (Q15, Q17)
- Whether Capability Owners may edit metadata before publication
- Schema for lessons learned, tools used and AI usage
- One capability per solution, or several
- Whether adoption and AI-tool analytics fit v1 scope

## 2026-10-01 — Working session: Top 3 save counts and card sizing

**Progress:** 100% — 7 Live / 7

### Feedback

- Show how popular each Top 3 solution is, without revealing who saved it.
- Make it clearer that the Top 3 shelf scrolls; area tags crowd the narrower cards.

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| `nx_GetTopFavorites` returns `saves` per ranked solution | 🟢 Live | `3015bd5`. Signed plug-in pushed 2026-10-01; `inspect-favorites` returned `saves`. See [SchemaV2](../data_model/SchemaV2.md#nx_solutionfavorite--per-person-favorites) |
| Save count beside the Top 3 heart, narrower cards (half the next card peeks), `2xs` area tag | 🟢 Live | `3015bd5`. Connected app published 2026-10-01 ([app README](../../app/README.md#top-3-save-counts-2026-10-01)); hosted UI not yet checked. [Design system](../design/design-system.md#library-page) |
| Top cards: "♥ 12" as one small heart + count with no circle in the top-right corner, level with the title; summary centred below; area tag removed | 🟢 Live | `7b83ef4`, published 2026-10-01 ([app README](../../app/README.md#top-10-corner-heart-and-dark-area-tags-2026-10-01)); hosted UI not yet checked. The count moves with the viewer's own click |
| Dark theme area tags: AI shifted to a saturated blue (`#6aa5f5`) so it no longer reads as Data's teal; richer tag fill and edge | 🟢 Live | `7b83ef4`, published 2026-10-01. Light theme unchanged |
| Submit flow: steps 2–3 rearranged into **Define the solution** (name, summary, areas, what it does, business value) and **Solution context** (status, built by & effort, client); client fields only after "Is this solution associated with a client?" = Yes; rewritten Before you start copy | 🟢 Live | PoC and connected share the change, published 2026-10-01 ([app README](../../app/README.md#submit-flow-rearranged-2026-10-01)). No schema or plug-in change; No clears the client name, anonymous profile and client role |
| "Top N" and "Solution Library" headings take the wordmark "P" colour (`--brand-p`) instead of the IBO lavender | 🟢 Live | Deep steel blue in light, light blue in dark, so a heading no longer reads as an area. Published 2026-10-01 ([app README](../../app/README.md#brand-p-headings-2026-10-01)) |
| Library hero: the "All areas" note ("Everything Nextant has built and can show…") removed; a chosen area still shows its note | 🟢 Live | Published 2026-10-01 ([app README](../../app/README.md#all-areas-note-removed-2026-10-01)) |

## 2026-09-30 — Feedback session with Sebastian: library discovery, tag accessibility, and solution-detail clarity

**Attendees:** Sebastian, …
**Progress:** 57% — 8 Live, 1 In code, 6 Proposed / 15

### Feedback

- Keep the Top 3 Most Liked Solutions section as a featured playlist, but make sure newly added solutions still surface in the main library feed.
- Keep the default sort as Newest First so recent solutions aren't buried under highly-liked content.
- Make it easy to discover recently published content without relying only on filters.
- Add an uploaded/published date indicator to solution cards.
- Prefer relative dates (Today, This Week, Last Week, 2 Weeks Ago, Last Month, Last Year) over exact timestamps, so new content is easy to spot at a glance.
- Improve visual differentiation between solution tags/categories; increase color contrast, especially in dark mode — stronger fills, more distinct colors, additional visual indicators.
- Review tag-color accessibility and readability across the platform.
- Every solution needs a clear one-line summary (One-Liner).
- Make "What it Does" concise and easy to understand.
- Make "Why it Matters" focused on business value.
- Prioritize clarity for CSMs, internal stakeholders, and customers reviewing solutions.
- Strengthen the value-proposition messaging per solution: what problem it solves, who benefits, why it's relevant.
- Reduce technical complexity in solution descriptions where possible.

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| PR-016 Published date on solution cards | 🟢 Live | Shipped as a compact age label ("3d/2w/4mo/1yr") with full date on hover, in `64c1ac2`, verified ancestor of every subsequent publish |
| PR-017 Relative date labels (Today/This Week/Last Week/2 Weeks Ago/Last Month/Last Year) | 🟢 Live | `64c1ac2` ships only the shorter age format; the literal exact-bucket wording was never built — a lighter solution was accepted in its place |
| PR-018 Keep Top 3 featured section | Proposed | Shelf already exists ([2026-09-28/29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux)); still not decided whether it needs to change to avoid crowding out new content |
| PR-019 New-content visibility in default view | 🟢 Live | `LibraryView.tsx` default sort is `"newest"` (by `createdon`); confirmed no separate mechanism exists or was asked for beyond that |
| PR-020 Tag color accessibility | In code | Contrast targets (≥4.7:1) are documented in the [design system](../design/design-system.md#design-tokens) and an automated axe-core pass found no violations, but [accessibility.md](../design/accessibility.md) itself flags manual contrast verification on glass surfaces as still pending |
| PR-021 Enhanced tag styling (fills/borders/stronger colors) | 🟢 Live | `64c1ac2` raises the specialization-area `AreaTag` tint from 11% to 17%; no other tag/badge type received equivalent treatment |
| PR-022 Dark-mode tag readability review | 🟢 Live | Same commit (`7b83ef4`) already credited as Live under [2026-10-01 — Top 3 save counts and card sizing](#2026-10-01--working-session-top-3-save-counts-and-card-sizing); not separate work |
| PR-023 One-Liner standardization | Proposed | The "One-line summary" field (200-char max) predates this session by a week (`d027276`, 2026-09-22); no standardization work followed |
| PR-024 "What It Does" optimization | 🟢 Live | `448d02b` (published 2026-10-06): detail panel and form label renamed to "What the solution does", paired with "Business value" so the two read as "what it does / what you gain"; accepted as sufficient |
| PR-025 "Why It Matters" enhancement | 🟢 Live | `448d02b` (published 2026-10-06): the detail panel "Why it matters" is now titled "Business value", matching the `businessValue` field and the form label |
| PR-026 Business-value-first ordering | 🟢 Live | Accepted 2026-10-06 as covered by the "What the solution does" / "Business value" pairing (`448d02b`); no separate reordering of the detail page |
| PR-027 Download a presentation with each solution's material | Proposed | Added 2026-10-02 from the meeting notes. A per-solution deck (summary, value, screenshots, links to demos) for CSMs to take into client conversations. Must use present-mode-safe content only (redacted context, no builder credits or internal notes) |
| PR-028 Library filter by demo | Proposed | Added 2026-10-02. Narrow the library to solutions that have a demo (attachment or linked asset), and possibly by demo type |
| PR-029 Remove Allocation from contributor effort | Proposed | Added 2026-10-02. Calendar-mode effort asks for start date, end date and Allocation (%); removing it changes how hours are derived, so it touches [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md) and the open effort decision from [2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication) |
| PR-030 Solution-to-Project as true N:N in the app | Proposed | Added 2026-10-02. Dataverse already models Solution ↔ Project as a native N:N ([SchemaV2](../data_model/SchemaV2.md)), but the connected form allows only one project ("Project (choose one)", `projectIds.length <= 1` in `DraftsView.tsx`/`DraftGraphEditor.tsx`). Allow several projects and show them on the detail page; check the graph plug-in accepts more than one |

### Open decisions

- How a solution stays visible in the main feed while the Top 3 shelf is also shown, and whether PR-018 needs to change to avoid crowding out new content.
- Manual contrast verification on glass surfaces (PR-020) — automated checks pass, but [accessibility.md](../design/accessibility.md) marks manual sign-off pending.
- One-Liner standardization (PR-023): still a generic pre-existing field, no dedicated content-design work done yet.
- Presentation download (PR-027): format (PowerPoint or PDF), template, and which fields and media it includes.
- Without Allocation (PR-029), how calendar-mode effort is calculated, or whether calendar mode stays at all.

## 2026-09-30 — Working session: external resource links, demo viewing experience, and effort communication

**Attendees:** Ximena, Ernesto
**Progress:** 7% — 1 Live / 14

### Feedback

- Allow direct linking to external resources instead of requiring download and re-upload.
- Associate demos, tools, videos and documentation through direct URLs; add direct access links to prototypes and related apps.
- Support linking directly to internal repositories such as Marketing Kits and other knowledge sources.
- Let users open demos/prototypes full-screen, or in a separate browser tab/window.
- Consider a popup/modal viewing mode for demos as an alternative.
- Reduce how much screen space the PRISMA frame takes while a demo is being viewed.
- Standardize how media assets (video, image, HTML, demo) are displayed across the platform.
- Collect user feedback on overall UX, navigation and visual design.
- Communicate effort without exposing hours or cost: consider high-level duration bands (e.g. 2-3 weeks, 2-3 months) or a Small/Medium/Large complexity label instead of actual hours.
- Evaluate future integration with time-tracking systems, and how solutions/prototypes would map to workstreams and projects if that integration is pursued.
- Allow more than one target client role per solution.
- Allow associating more than one client with a solution.

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| External resource / repository links (incl. Marketing Kit) | Proposed | High priority. Store a URL instead of requiring upload |
| Tool URL field | Proposed | High priority |
| Prototype URL field | Proposed | High priority |
| Full-screen demo/prototype view | 🟢 Live | 2026-10-01: Full screen button in every viewer (browser full screen, or the stage expanded over the PRISMA chrome when the Power Apps host forbids it). In Local Play the host granted full screen and the demo filled the monitor. See [Demo assets](../workflows/demo-assets.md#viewer-routes) |
| Open demo/prototype in a new tab | Proposed | High priority |
| Demo modal/popup view | Proposed | Medium priority. Likely redundant with full-screen/new-tab — see open decisions |
| Reduce chrome around the demo viewer | Proposed | High priority |
| User feedback capture (comments/suggestions) | Proposed | Medium priority |
| Solution rating / usefulness score | Proposed | Low priority |
| Estimated duration metadata instead of hours | Proposed | Medium priority. Interacts with the maturity-based effort model in [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md) |
| Complexity classification (Small / Medium / Large) | Proposed | Medium priority. Alternative or complement to duration bands above |
| Time-tracking system integration | Proposed | Low priority · Backlog |
| Solution-to-workstream/project mapping | Proposed | Low priority · Backlog. Prerequisite if time-tracking integration is pursued |
| Media display standardization (video/image/HTML/demo) | Proposed | Medium priority |

### Open decisions

- Full-screen vs. new tab vs. modal/popup: whether to build all three or pick one primary demo-viewing pattern.
- How effort is represented going forward — duration bands, Small/Medium/Large complexity, or both — and whether this replaces or sits alongside the hours-based model in ADR-0007.
- Whether and when time-tracking integration and workstream/project mapping get scoped for a future release.

## 2026-09-28 / 29 — Working sessions: integration, favorites ranking and library UX

**Progress:** 100% — 6 Live / 6

### Feedback

- Bring the `juli` branch into `main` step by step, fixing each step so it builds.
- Show which solutions the team saves most, Netflix Top 10 style.
- White screenshots get lost in the light theme; card images should be larger; thumbnails should be framed by the contributor; screenshots should open large with arrows.
- The library hero should say more; the entry screen should not show technical connection steps.
- Add sorting and a list view to All solutions.

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| `juli` integrated into `main` (roles, favorites, present mode, main demo) | 🟢 Live | PR #1; two favorites fixes (server-side writes; card heart hidden when favorites don't load) |
| Favorites ranking API `nx_GetTopFavorites` | 🟢 Live | See [SchemaV2](../data_model/SchemaV2.md#nx_solutionfavorite--per-person-favorites). A later plug-in upload replaced it once; see the [deployment collision note](../architecture/technical-architecture.md) |
| Top 3 shelf, hero copy with live counts, welcome screen | 🟢 Live | [Design system](../design/design-system.md#library-page) |
| Sort by creation date and grid/list view | 🟢 Live | Catalogue reads `createdon` |
| Thumbnail framing, detail hero beside the image, screenshot lightbox | 🟢 Live | No schema change: the framed crop is what gets uploaded |
| Light-theme contrast for white thumbnails | 🟢 Live | Pale steel-blue cards and image edges |

### Open decisions

- Whether the ranking should also count views or demo requests, and whether it should ever show in present mode.

## 2026-09-23 — Data model update: Specialization Area, roles, client role, favorites

**Progress:** 83% — 5 Live, 1 Proposed / 6 (1 Dropped excluded)

### Feedback

- A solution often belongs to more than one specialization area, so the single Specialization Area should become multi-valued.
- Users want to save solutions as favorites and see them in their own "My favorites" space.
- It would be useful to track a top ranking of solutions. How to measure it is not decided yet (most viewed, most saved, most requested).
- Contributors should distinguish the CSM who leads a solution from the consultants who built it.
- Solutions should record which client stakeholder role they are aimed at.

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| Specialization Area from 1:N lookup to native N:N (`nx_Solution_nx_SpecializationArea_nx_SpecializationArea`) | Done in Dataverse · 🟢 **Live** | The old lookup `nx_solution.nx_specializationarea` was **deleted**, which broke the published connected app. On 2026-09-24 the catalogue fix was merged to `main` (`04f76b2`, `7c0196a`) and the connected app was republished. On 2026-09-28 the updated plugins were deployed with the app, so drafts, My submissions and review use the N:N too. Specialization Area behaves like Industry: a solution without an area shows under "All" only. The N:N was added to `PRISMA_Dev` on 2026-09-28. Still to do: tag "Budget Management Solution" with an area |
| New column `nx_solutioncontributor.nx_role` (CSM · Consultant) | Done in Dataverse · 🟢 **Live** | Contributor role selector, plugin read/write, and CSM listed apart from builders. Integrated from `juli` and deployed on 2026-09-28. Rules for CSM rows are still open (see below) |
| New column `nx_solution.nx_clientrole` (Client Role, 14 values) | Done in Dataverse · 🟢 **Live** | Client role picker on connected drafts and plugin read/write, deployed on 2026-09-28. The PRISMA library filters by it ("Target client role"), in present mode too. Its exact meaning is still open |
| New table `nx_solutionfavorite` (per-person favorites) | Done in Dataverse · 🟢 **Live** | Delete Cascade from Solution, RemoveLink from Consultant. `FavoriteApi` (`nx_SetFavorite`, `nx_GetMyFavorites`) sets `nx_user` server-side; roles get User-depth Read only. Hearts and "My favorites" in the connected app. Deployed and republished on 2026-09-28; the user verified save and remove in the hosted app |
| Schema docs synced with Dataverse | 🟢 Live | Updated [SchemaV2](../data_model/SchemaV2.md), the example values, the legacy companion and reference-data governance (`23fe769`) |
| Top ranking (favorites, unique views, demo requests) | Proposed | The suggested first phase ranks by favorites only, which needs no new table. Views need a private `nx_solutionview` table. Not built |
| Lead CSM as a lookup on `nx_solution` (`nx_leadcsm`) | Dropped | Replaced by `nx_solutioncontributor.nx_role` |

### Open decisions

- Specialization areas: the maximum per solution (the app assumes 3), and whether a "primary" area is needed. The current rule is lowest Sort Order.
- `nx_clientrole`: what it represents, whether it is required at submit, and whether it shows in present mode.
- CSM rows (`nx_role`): whether they carry effort, whether there is exactly one per solution, and whether they count toward the contributor minimum.
- Favorites and ranking: which signals the ranking counts. Visibility: the Top 3 shows every internal user how many people saved each ranked solution (never who), outside present mode.
