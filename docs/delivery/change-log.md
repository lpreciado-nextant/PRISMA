# Change log by meeting

**Status:** Living · **Last updated:** 2026-10-01

One entry per meeting or working session, newest first. Each entry lists the feedback raised and the changes proposed, and tracks each change until it is live. Keep it short: link to the authoritative doc ([SchemaV2](../data_model/SchemaV2.md), an ADR, the [decision log](decision-log.md)) instead of repeating detail.

**Entries** (newest first — jump to a meeting)
| Date | Session | Mostly |
|---|---|---|
| [2026-10-01](#2026-10-01--working-session-top-3-save-counts-and-card-sizing) | Top 3 save counts and card sizing | Live; hosted UI not yet checked |
| [2026-09-30 (Sebastian)](#2026-09-30--feedback-session-with-sebastian-library-discovery-tag-accessibility-and-solution-detail-clarity) | Library discovery, content freshness, tag accessibility, solution-detail clarity | Mostly Proposed; three In code |
| [2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication) | External links, demo viewing experience, effort communication | All Proposed — nothing built yet |
| [2026-09-28 / 29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux) | Integration, favorites ranking and library UX | All Live |
| [2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites) | Data model update: Specialization Area, roles, client role, favorites | Mostly Live; one Proposed, one Dropped |

**Open decisions still pending** (pulled from the entries below, so you don't have to read each one to check)
- Top 3 `2xs` area tag (9.5px) vs. the tag-readability pass ([2026-10-01](#2026-10-01--working-session-top-3-save-counts-and-card-sizing))
- Top 3 shelf vs. Newest First default: how a solution should be visible in both without the shelf crowding out new content ([2026-09-30 (Sebastian)](#2026-09-30--feedback-session-with-sebastian-library-discovery-tag-accessibility-and-solution-detail-clarity))
- Relative date buckets (Today / This Week / Last Week / 2 Weeks Ago / Last Month / Last Year) vs. the compact `createdon` age tag ("3d/2w/4mo/1yr") in code since `64c1ac2` ([2026-09-30 (Sebastian)](#2026-09-30--feedback-session-with-sebastian-library-discovery-tag-accessibility-and-solution-detail-clarity))
- Demo viewing: full-screen vs. new tab vs. modal/popup — pick one primary pattern ([2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication))
- Effort: duration bands vs. Small/Medium/Large vs. both, and whether it replaces ADR-0007's hours model ([2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication))
- Time-tracking integration and workstream/project mapping — not scoped, future release only ([2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication))
- Favorites ranking: whether to also count views/demo requests, and visibility in present mode ([2026-09-28/29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux))
- Specialization areas: max per solution, whether a "primary" area is needed ([2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites))
- `nx_clientrole`: meaning, required at submit?, shown in present mode? ([2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites))
- CSM rows (`nx_role`): effort, cardinality, contributor-minimum counting ([2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites))

When a decision above gets resolved, delete its bullet here and update the matching "Open decisions" bullet in that entry (or move it into the [decision log](decision-log.md) if it needs its own record).

**Status values**

| Status | Meaning |
|---|---|
| Proposed | Discussed, not yet built |
| Done in Dataverse | Table, column or relationship exists in `PRISMA_Dev` (Nextant Pulse) |
| In code | Implemented on a branch, not yet deployed or published |
| Live | Deployed/published and working in the app |
| Dropped | Decided against, or replaced by another change |

**Template for a new entry**

```markdown
## YYYY-MM-DD — <meeting or session name>

**Attendees:** …

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

## 2026-10-01 — Working session: Top 3 save counts and card sizing

### Feedback

- Show how popular each Top 3 solution is, without revealing who saved it.
- Make it clearer that the Top 3 shelf scrolls; area tags crowd the narrower cards.

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| `nx_GetTopFavorites` returns `saves` per ranked solution | Live | `3015bd5`. Signed plug-in pushed 2026-10-01; `inspect-favorites` returned `saves`. See [SchemaV2](../data_model/SchemaV2.md#nx_solutionfavorite--per-person-favorites) |
| Save count beside the Top 3 heart, narrower cards (half the next card peeks), `2xs` area tag | Live | `3015bd5`. Connected app published 2026-10-01 ([app README](../../app/README.md#top-3-save-counts-2026-10-01)); hosted UI not yet checked. [Design system](../design/design-system.md#library-page) |

### Open decisions

- The `2xs` tag text (9.5px) runs against the tag-readability feedback in PR-020/PR-022; revisit in that pass.

## 2026-09-30 — Feedback session with Sebastian: library discovery, tag accessibility, and solution-detail clarity

**Attendees:** Sebastian, …

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
| PR-016 Published date on solution cards | In code | Shipped as a compact age label ("3d/2w/4mo/1yr") with full date on hover, in `64c1ac2` |
| PR-017 Relative date labels (Today/This Week/Last Week/2 Weeks Ago/Last Month/Last Year) | In code | `64c1ac2` ships a shorter age format, not yet the exact bucket wording requested; revisit copy |
| PR-018 Keep Top 3 featured section | Proposed | Shelf already exists ([2026-09-28/29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux)); no change needed unless it's found to be crowding out new content |
| PR-019 New-content visibility in default view | Proposed | Needs a concrete mechanism beyond Newest-First sort — see open decisions |
| PR-020 Tag color accessibility | Proposed | High priority |
| PR-021 Enhanced tag styling (fills/borders/stronger colors) | In code | `64c1ac2` raises the specialization-area badge tint from 11% to 17%; other tag types not yet covered |
| PR-022 Dark-mode tag readability review | Proposed | Medium priority |
| PR-023 One-Liner standardization | Proposed | Medium priority |
| PR-024 "What It Does" optimization | Proposed | Medium priority |
| PR-025 "Why It Matters" enhancement | Proposed | Medium priority |
| PR-026 Business-value-first ordering | Proposed | Medium priority |

### Open decisions

- How a solution stays visible in the main feed while the Top 3 shelf is also shown (PR-018/PR-019) — no mechanism agreed yet.
- Exact relative-date bucket wording and thresholds (PR-017) vs. the shorter age format already shipped.
- Scope of the tag-contrast pass (PR-020/021/022): specialization-area badges only, or all tag/category types.

## 2026-09-30 — Working session: external resource links, demo viewing experience, and effort communication

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

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| External resource / repository links (incl. Marketing Kit) | Proposed | High priority. Store a URL instead of requiring upload |
| Tool URL field | Proposed | High priority |
| Prototype URL field | Proposed | High priority |
| Full-screen demo/prototype view | Proposed | High priority |
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

### Feedback

- Bring the `juli` branch into `main` step by step, fixing each step so it builds.
- Show which solutions the team saves most, Netflix Top 10 style.
- White screenshots get lost in the light theme; card images should be larger; thumbnails should be framed by the contributor; screenshots should open large with arrows.
- The library hero should say more; the entry screen should not show technical connection steps.
- Add sorting and a list view to All solutions.

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| `juli` integrated into `main` (roles, favorites, present mode, main demo) | Live | PR #1; two favorites fixes (server-side writes; card heart hidden when favorites don't load) |
| Favorites ranking API `nx_GetTopFavorites` | Live | See [SchemaV2](../data_model/SchemaV2.md#nx_solutionfavorite--per-person-favorites). A later plug-in upload replaced it once; see the [deployment collision note](../architecture/technical-architecture.md) |
| Top 3 shelf, hero copy with live counts, welcome screen | Live | [Design system](../design/design-system.md#library-page) |
| Sort by creation date and grid/list view | Live | Catalogue reads `createdon` |
| Thumbnail framing, detail hero beside the image, screenshot lightbox | Live | No schema change: the framed crop is what gets uploaded |
| Light-theme contrast for white thumbnails | Live | Pale steel-blue cards and image edges |

### Open decisions

- Whether the ranking should also count views or demo requests, and whether it should ever show in present mode.

## 2026-09-23 — Data model update: Specialization Area, roles, client role, favorites

### Feedback

- A solution often belongs to more than one specialization area, so the single Specialization Area should become multi-valued.
- Users want to save solutions as favorites and see them in their own "My favorites" space.
- It would be useful to track a top ranking of solutions. How to measure it is not decided yet (most viewed, most saved, most requested).
- Contributors should distinguish the CSM who leads a solution from the consultants who built it.
- Solutions should record which client stakeholder role they are aimed at.

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| Specialization Area from 1:N lookup to native N:N (`nx_Solution_nx_SpecializationArea_nx_SpecializationArea`) | Done in Dataverse · **Live** | The old lookup `nx_solution.nx_specializationarea` was **deleted**, which broke the published connected app. On 2026-09-24 the catalogue fix was merged to `main` (`04f76b2`, `7c0196a`) and the connected app was republished. On 2026-09-28 the updated plugins were deployed with the app, so drafts, My submissions and review use the N:N too. Specialization Area behaves like Industry: a solution without an area shows under "All" only. The N:N was added to `PRISMA_Dev` on 2026-09-28. Still to do: tag "Budget Management Solution" with an area |
| New column `nx_solutioncontributor.nx_role` (CSM · Consultant) | Done in Dataverse · **Live** | Contributor role selector, plugin read/write, and CSM listed apart from builders. Integrated from `juli` and deployed on 2026-09-28. Rules for CSM rows are still open (see below) |
| New column `nx_solution.nx_clientrole` (Client Role, 14 values) | Done in Dataverse · **Live** | Client role picker on connected drafts and plugin read/write, deployed on 2026-09-28. The PRISMA library filters by it ("Target client role"), in present mode too. Its exact meaning is still open |
| New table `nx_solutionfavorite` (per-person favorites) | Done in Dataverse · **Live** | Delete Cascade from Solution, RemoveLink from Consultant. `FavoriteApi` (`nx_SetFavorite`, `nx_GetMyFavorites`) sets `nx_user` server-side; roles get User-depth Read only. Hearts and "My favorites" in the connected app. Deployed and republished on 2026-09-28; the user verified save and remove in the hosted app |
| Schema docs synced with Dataverse | Live | Updated [SchemaV2](../data_model/SchemaV2.md), the example values, the legacy companion and reference-data governance (`23fe769`) |
| Top ranking (favorites, unique views, demo requests) | Proposed | The suggested first phase ranks by favorites only, which needs no new table. Views need a private `nx_solutionview` table. Not built |
| Lead CSM as a lookup on `nx_solution` (`nx_leadcsm`) | Dropped | Replaced by `nx_solutioncontributor.nx_role` |

### Open decisions

- Specialization areas: the maximum per solution (the app assumes 3), and whether a "primary" area is needed. The current rule is lowest Sort Order.
- `nx_clientrole`: what it represents, whether it is required at submit, and whether it shows in present mode.
- CSM rows (`nx_role`): whether they carry effort, whether there is exactly one per solution, and whether they count toward the contributor minimum.
- Favorites and ranking: which signals the ranking counts. Visibility: the Top 3 shows every internal user how many people saved each ranked solution (never who), outside present mode.
