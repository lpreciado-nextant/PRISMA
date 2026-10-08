# Change log by meeting

**Status:** Living · **Last updated:** 2026-10-08

One entry per meeting or working session, newest first. Each entry lists the feedback raised and the changes proposed, and tracks each change until it is live. Keep it short: link to the authoritative doc ([SchemaV2](../data_model/SchemaV2.md), an ADR, the [decision log](decision-log.md)) instead of repeating detail.

Each session has one **Changes** table and one **Progress** percentage computed from it — see "Status values and progress weight" below. There is no separate table for "Proposed" vs. "built": a change stays in the same row and its Status (and the session's %) moves up as it ships.

**Entries** (newest first — jump to a meeting)
| Date | Session | Progress |
|---|---|---|
| [2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required) | Contributor effort as minimum hours required; CSM from the consultant level | 100% — 5 Live / 5 |
| [2026-10-07](#2026-10-07--working-session-presentation-download-refinements-and-new-technology-review) | Presentation download refinements and new-technology review | 100% — 5 Live / 5 |
| [2026-10-01 (Natalia, Andrés)](#2026-10-01--feedback-session-with-natalia-and-andrés-governance-capabilities-and-review) | Governance, capability owners, approval, quality, adoption, required fields, review look and feel | 19% — 3 Live / 16 |
| [2026-10-01](#2026-10-01--working-session-top-3-save-counts-and-card-sizing) | Top 3 save counts and card sizing | 100% — 7 Live / 7 |
| [2026-09-30 (Sebastian)](#2026-09-30--feedback-session-with-sebastian-library-discovery-tag-accessibility-and-solution-detail-clarity) | Library discovery, content freshness, tag accessibility, solution-detail clarity, presentation download, demo filter, allocation, project N:N | 100% — 15 Live / 15 |
| [2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication) | External links, demo viewing experience, effort communication | 21% — 3 Live / 14 |
| [2026-09-28 / 29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux) | Integration, favorites ranking and library UX | 100% — 6 Live / 6 |
| [2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites) | Data model update: Specialization Area, roles, client role, favorites | 100% — 6 Live / 6 (1 Dropped excluded) |

**Open decisions still pending** (pulled from the entries below, so you don't have to read each one to check)
- Approver: PRISMA Librarian, Capability Owner, or both; who may see the approver's name; whether Capability Owners may edit metadata ([2026-10-01 (Natalia, Andrés)](#2026-10-01--feedback-session-with-natalia-and-andrés-governance-capabilities-and-review))
- Schema for lessons learned, tools used and AI usage; one vs. several capabilities per solution; analytics vs. v1 scope ([2026-10-01 (Natalia, Andrés)](#2026-10-01--feedback-session-with-natalia-and-andrés-governance-capabilities-and-review))
- Demo viewing (PR-006): full screen (PR-004) and new-tab links (PR-005) are live; whether a modal is still wanted ([2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication))
- Effort (PR-010/011): duration bands vs. Small/Medium/Large vs. both, and whether it replaces ADR-0007's hours model ([2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication))
- Whether to delete the retired `nx_startdate`/`nx_enddate` contributor columns (optional; first remove them from the unused "Information" form) ([2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required), [Q20](decision-log.md)). `nx_role` and `nx_allocationpercent` were deleted 2026-10-08; legacy rows without hours are dummy data, no backfill
- Workstream/project mapping (PR-013) — not scoped, future release only; the time-tracking row (PR-012) was resolved as the library time filter ([2026-09-30](#2026-09-30--working-session-external-resource-links-demo-viewing-experience-and-effort-communication))
- Merging duplicate technologies needs a librarian-only plug-in operation; today only the read-only `technology-duplicates` report exists ([2026-10-07](#2026-10-07--working-session-presentation-download-refinements-and-new-technology-review))
- Favorites ranking: whether to also count views/demo requests, and visibility in present mode ([2026-09-28/29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux))
- Specialization areas: max per solution, whether a "primary" area is needed ([2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites))
- `nx_clientrole`: meaning, required at submit?, shown in present mode? ([2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites))

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

## 2026-10-08 — Working session: contributor effort as minimum hours required

**Progress:** 100% — 5 Live / 5

### Feedback

- Allocation is unnecessary; asking for dates and a percentage per person adds work without adding meaning (PR-029).
- Hours should state the minimum time each person needed to work on the solution, including preparation and discovery, whatever the maturity.
- The contributor Role picker is redundant: the consultant directory already records each person's role and level (`cr6b0_consultantlevel`).
- Every solution must say what it does and its business value: the user made `nx_whatitdoes` and `nx_businessvalue` Business Required in Dataverse, and cut `nx_onelinesummary` from 4000 to the agreed 200 characters (PR-023).

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| Every maturity takes "Minimum hours required" per person; dates, allocation, effort modes and the US holiday calendar removed | 🟢 Live | Implements PR-029. `effort.ts` keeps only `contributorHours`; plug-ins write `nx_effortmode` = Direct and `nx_directhours` on every save and ignore `startDate`/`endDate`/`allocation` from older clients. Mock contributors carry their former totals as direct hours (BSO Quota still 218). [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md), [SchemaV2](../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort). Deployed 2026-10-08 from `main` `1c89c2d` by Luis: signed plug-in 17:11 UTC, then the connected app 17:12 UTC; hosted UI check not recorded. The user then deleted `nx_allocationpercent`; `nx_startdate`/`nx_enddate` stay, unused ([Q20](decision-log.md)) |
| Published detail shows "Incomplete" effort instead of failing when a contributor has no hours | 🟢 Live | `nx_GetPublishedDetail` returns a null `totalHours`. Affects Client demo/production rows saved under the calendar model (dummy data); not backfilled, since calendar hours were estimated capacity, not minimum hours required. Deployed with the plug-ins 2026-10-08 |
| Contributor Role picker removed; the person's directory level is shown read-only and the CSM is derived from it | 🟢 Live | Submit/draft forms show **Level** (`cr6b0_consultantlevel`, "Not recorded in the consultant directory" when empty). A contributor whose level names customer success (`isCustomerSuccessLevel`) is listed as CSM in detail and passed as CSM to the PowerPoint download, and left out of PoC card builder names; builders show "name · level". `CONTRIBUTOR_ROLES` and `ContributorRole` removed; mock people carry illustrative levels. Connected cards (`CatalogueApi`) unchanged. [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md#csm-from-the-consultant-level). Deployed 2026-10-08 from `main` `1c89c2d` by Luis: signed plug-in 17:11 UTC, then the connected app 17:12 UTC; hosted UI check not recorded |
| `nx_solutioncontributor.nx_role` retired in the plug-ins; published detail returns each credit's `level` | 🟢 Live | `ContributorInput`/`DraftGraph` no longer read, write or validate `nx_role`; `roleValue` from older clients is ignored and no longer returned. `nx_GetPublishedDetail` returns `level` (omitted in present mode). Plug-ins deployed 2026-10-08 17:11 UTC (`1c89c2d`; the deployed assembly no longer references `nx_role`), then the connected app; the user then deleted `nx_role` from Dataverse (no blocking dependencies reported) |
| "What the solution does" and "Business value" required to submit | 🟢 Live | Both labels carry the required asterisk (were "(optional)"); the PoC and connected forms need them to continue past **Define the solution** and to submit; the librarian checklist gains "What it does and business value"; `ReviewPolicy.Complete` rejects submit/approve without them, because Dataverse Business Required (`nx_whatitdoes`, `nx_businessvalue`, set by the user 2026-10-08) is enforced only by its own forms. Drafts still save without them. `5eb7bfa`: signed plug-in pushed by Luis (assembly updated 2026-10-08 18:12 UTC, contains the new submit check), then the connected app published at 18:13 UTC; hosted UI not yet checked |

### Open decisions

- Whether to delete the retired `nx_startdate` and `nx_enddate` columns (optional, the user's call): each is still on the unused `nx_solutioncontributor` main form "Information"; remove both fields from it, publish, then delete the columns ([Q20](decision-log.md)). `nx_role` and `nx_allocationpercent` were deleted 2026-10-08 after the deploy; `nx_effortmode` stays (the plug-in writes Direct on every save). The legacy Client demo/production rows without hours are dummy data (confirmed 2026-10-08); no backfill.
- Resolved: CSM-row rules from 2026-09-23 lapse; a CSM is an ordinary contributor identified by directory level.

## 2026-10-07 — Working session: presentation download refinements and new-technology review

**Progress:** 100% — 5 Live / 5

### Feedback

- The downloaded presentation must fit each solution's content instead of fixed slots, and every demo button must do what it says.
- Reviewers should notice a technology no other published solution uses before it becomes a near-duplicate tag.

### Changes

| Change | Status | Notes / next step |
|---|---|---|
| Demos slide: three columns (demo videos, interactive demos, supporting material), tighter rows; buttons read Play, Open or Download | 🟢 Live | `b51f479`, `20351d9`, `fb56206`, `1277e51`. Files are never linked straight from the deck: Download opens the PRISMA viewer with `?download=1`, which starts the download on arrival; fill test checks every button is linked. Builds on PR-027; published with the connected app on 2026-10-08 17:12 UTC (`1c89c2d`, Luis); hosted UI not yet checked |
| Slides adapt to the solution: two-line cover names, cards as tall as their text, screenshot grid for the number there are, chips sized to their words | 🟢 Live | `dc25893`; published with the connected app on 2026-10-08 17:12 UTC (`1c89c2d`, Luis); hosted UI not yet checked |
| Speaker notes on every slide; slide 6 PRISMA chip links the full URL instead of the 40-character display text | 🟢 Live | `20351d9` (fixes long Power Apps links that were cut and broken); published with the connected app on 2026-10-08 17:12 UTC (`1c89c2d`, Luis); hosted UI not yet checked |
| Review panel flags **New technologies** (no other published solution uses them) with the existing names they resemble | 🟢 Live | `b210e8a` ([runbook](../operations/librarian-runbook.md)); published with the connected app on 2026-10-08 17:12 UTC (`1c89c2d`, Luis); hosted UI not yet checked |
| `Prisma.Deploy technology-duplicates`: read-only report of look-alike active technologies and how many solutions use each | 🟢 Live | `b210e8a`. Local command, nothing to deploy; uses the form's duplicate rules ([reference-data governance](../data_model/reference-data-governance.md)) |

### Open decisions

- Merging duplicate technologies is not automated: `DraftGraphGuard` blocks direct tag writes for every account, so it needs a librarian-only plug-in operation.
- Readable demo titles in the presentation ([Q19](decision-log.md)).

---

## 2026-10-01 — Feedback session with Natalia and Andrés: governance, capabilities and review

**Attendees:** Natalia, Andrés
**Progress:** 19% — 3 Live / 16

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
| **Medium** · Retrieve roles from Azure AD instead of manual entry | 🟢 Live | Delivered 2026-10-08 for the contributor role: it now comes automatically from the consultant directory, `cr6b0_consultant.cr6b0_consultantlevel` (synced directory data), shown read-only, and a level naming customer success marks the solution's CSM; the manual `nx_role` entry was removed and the column deleted. The source is the `cr6b0_consultant` table, not a direct Microsoft Entra ID (Azure AD) call. The client role (`nx_clientrole`) is unchanged and still entered manually. `1c89c2d`, deployed 2026-10-08 ([2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required), [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md#csm-from-the-consultant-level)) |
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
**Progress:** 100% — 15 Live / 15

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
| PR-018 Keep Top 3 featured section | 🟢 Live | Shelf already exists ([2026-09-28/29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux)). Decided 2026-10-06: keep it as a general **Top 5** (it showed up to ten). App-only change: `TopTenRow` shows the first five of the `nx_GetTopFavorites` ranking, which still returns up to ten; no plug-in deploy. New content stays visible through the default Newest-first sort (PR-019) and the "Added within" time filter. Published 2026-10-06 (`2fa9773`) and confirmed by the user |
| PR-019 New-content visibility in default view | 🟢 Live | `LibraryView.tsx` default sort is `"newest"` (by `createdon`); confirmed no separate mechanism exists or was asked for beyond that |
| PR-020 Tag color accessibility | 🟢 Live | Contrast targets (≥4.7:1) are documented in the [design system](../design/design-system.md#design-tokens), the stronger tag fills are published (PR-021/022) and an automated axe-core pass found no violations. Accepted as live by the user on 2026-10-06; the manual contrast check on glass surfaces stays on the [accessibility](../design/accessibility.md) checklist |
| PR-021 Enhanced tag styling (fills/borders/stronger colors) | 🟢 Live | `64c1ac2` raises the specialization-area `AreaTag` tint from 11% to 17%; no other tag/badge type received equivalent treatment |
| PR-022 Dark-mode tag readability review | 🟢 Live | Same commit (`7b83ef4`) already credited as Live under [2026-10-01 — Top 3 save counts and card sizing](#2026-10-01--working-session-top-3-save-counts-and-card-sizing); not separate work |
| PR-023 One-Liner standardization | 🟢 Live | Settled 2026-10-08: the user reduced Dataverse `nx_onelinesummary` from 4000 to **200** characters (Business Required), matching the 200-character limit the form and plug-ins already enforced since `d027276` (2026-09-22). One standard length end to end ([2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required)) |
| PR-024 "What It Does" optimization | 🟢 Live | `448d02b` (published 2026-10-06): detail panel and form label renamed to "What the solution does", paired with "Business value" so the two read as "what it does / what you gain"; accepted as sufficient |
| PR-025 "Why It Matters" enhancement | 🟢 Live | `448d02b` (published 2026-10-06): the detail panel "Why it matters" is now titled "Business value", matching the `businessValue` field and the form label |
| PR-026 Business-value-first ordering | 🟢 Live | Accepted 2026-10-06 as covered by the "What the solution does" / "Business value" pairing (`448d02b`); no separate reordering of the detail page |
| PR-027 Download a presentation with each solution's material | 🟢 Live | Added 2026-10-02 from the meeting notes. Resolved 2026-10-07 as a PowerPoint built from the PRISMA × Nextant Dark/Light templates (field map in `tools/pptx-template/`): **Download presentation** beside Copy link on published, Client review = Cleared solutions, never in present mode; six slides (cover, what it does, screenshots, built on, demo links, CSM). No effort hours, builder names, cost, projects or internal notes. Built in the browser, loaded only on click. `30909f9`, `3736fca`, `7ae2a66`, `428bdc7`; connected app published 2026-10-07 ([discovery and presentation](../workflows/discovery-and-presentation.md#download-presentation)). Readable demo titles open as [Q19](decision-log.md). Refinements: [2026-10-07](#2026-10-07--working-session-presentation-download-refinements-and-new-technology-review) |
| PR-028 Library filter by demo | 🟢 Live | Added 2026-10-02. Clarified 2026-10-06: CSMs mean a **demo video**, and a solution can have several. Decided in [ADR-0011](../architecture/decisions/adr-0011-asset-purpose.md): new choice `nx_demoasset.nx_assetpurpose` (Demo video · Interactive demo · Supporting material), set by the section of the submit Media step a file goes in. Column created 2026-10-06. Plug-in change written and tested (format default on new attachments, optional purpose on links and media metadata, `demoVideos`/`interactiveDemos` in the catalogue graph); pushed in `b613493` and deployed by Luis 2026-10-06 (`nx_GetCatalogueGraph` returns `purposes: true`). No backfill: the 14 existing assets are test data to be deleted. App `6d39c65` published 2026-10-06: Media step in three sections (Demo videos · Interactive demo · Supporting material), a **Demo** facet (Demo video, Interactive demo) in the library filters, solution page grouped by purpose with the first demo video as main demo. Verified by the user in the hosted app with a new solution ([demo assets](../workflows/demo-assets.md#purpose-demo-video-interactive-demo-supporting-material)) |
| PR-029 Remove Allocation from contributor effort | 🟢 Live | Added 2026-10-02. Resolved 2026-10-08 ([working session](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required)): calendar mode goes too. Every maturity takes directly entered minimum hours per person; start date, end date, allocation and the US holiday calendar are removed from the app and plug-ins ([ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md)). Deployed 2026-10-08 from `main` `1c89c2d` (signed plug-in 17:11 UTC, then the connected app 17:12 UTC); `nx_allocationpercent` deleted from Dataverse afterwards |
| PR-030 Solution-to-Project as true N:N in the app | 🟢 Live | Added 2026-10-02. Dataverse already models Solution ↔ Project as a native N:N ([SchemaV2](../data_model/SchemaV2.md)). 2026-10-06: the connected form's "Projects" picker now keeps every selection (no more last-one-wins, multi-project alert or Save/Continue/Submit block). No plug-in change needed: `nx_SaveDraftGraph` already syncs up to 100 project links and `nx_GetPublishedDetail` returns all of them; the detail page already lists them under "Delivered for · N". Published in `fa2ebf4` |

### Open decisions

- One-Liner standardization (PR-023): resolved 2026-10-08 as a 200-character one-line summary in Dataverse, the form and the plug-ins.
- Allocation (PR-029): resolved 2026-10-08 and live the same day. Calendar mode is retired as well; every maturity takes minimum hours required, and `nx_allocationpercent` was deleted ([2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required)).

## 2026-09-30 — Working session: external resource links, demo viewing experience, and effort communication

**Attendees:** Ximena, Ernesto
**Progress:** 21% — 3 Live, 11 Proposed / 14

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
| PR-001 External resource / repository links (incl. Marketing Kit) | Proposed | High priority. Store a URL instead of requiring upload |
| PR-002 Tool URL field | Proposed | High priority |
| PR-003 Prototype URL field | Proposed | High priority |
| PR-004 Full-screen demo/prototype view | 🟢 Live | 2026-10-01: Full screen button in every viewer (browser full screen, or the stage expanded over the PRISMA chrome when the Power Apps host forbids it). In Local Play the host granted full screen and the demo filled the monitor. See [Demo assets](../workflows/demo-assets.md#viewer-routes) |
| PR-005 Open demo/prototype in a new tab | 🟢 Live | Every published solution page has **Copy link** (Luis, `e6f4c92` and `7237ea3`, 2026-09-30): a play link carrying `?route=/s/{id}` that opens that solution directly, in a new tab or for a colleague, with the usual sign-in and access checks ([ADR-0003](../architecture/decisions/adr-0003-hash-routing.md)). Hosted demo URLs also keep **Pop out** (new tab) in the viewer |
| PR-006 Demo modal/popup view | Proposed | Medium priority. Likely redundant with full-screen/new-tab — see open decisions |
| PR-007 Reduce chrome around the demo viewer | Proposed | High priority |
| PR-008 User feedback capture (comments/suggestions) | Proposed | Medium priority |
| PR-009 Solution rating / usefulness score | Proposed | Low priority |
| PR-010 Estimated duration metadata instead of hours | Proposed | Medium priority. Interacts with the minimum-hours effort model in [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md) |
| PR-011 Complexity classification (Small / Medium / Large) | Proposed | Medium priority. Alternative or complement to duration bands above |
| PR-012 Time-tracking system integration | 🟢 Live | Resolved 2026-10-06 as a time filter in the library: an "Added: …" picker beside "Sort by" with Any time / Last 30 days / Last 3 months / Last 6 months / Last 12 months, each showing how many solutions it leaves. Filters on creation date (`createdon`), months counted as calendar months back from today; kept in the URL (`added=3m`). `6e0b314`, `8a7b544`, published 2026-10-06 ([design system](../design/design-system.md#library-page)). Integration with an external time-tracking system is not part of this |
| PR-013 Solution-to-workstream/project mapping | Proposed | Low priority · Backlog. Prerequisite if an external time-tracking integration is ever pursued |
| PR-014 Media display standardization (video/image/HTML/demo) | Proposed | Medium priority. Not closed by asset purpose (PR-028), which organizes assets (same three sections in the form, solution page and filter) but does not change how they look. Already shared: video, HTML, documents and links open in one viewer (`ViewerFrame`) with Full screen (PR-004). Remaining gap: the PoC shows the first demo video inline on the solution page, while the connected app lists every asset as a row to click; images keep their own gallery and lightbox |

### Open decisions

- Modal/popup (PR-006): full screen (PR-004) and new-tab links (PR-005) are live; whether a modal is still wanted.
- How effort is represented going forward (PR-010/011) — duration bands, Small/Medium/Large complexity, or both — and whether this replaces or sits alongside the hours-based model in ADR-0007.
- Whether and when workstream/project mapping (PR-013) gets scoped for a future release.

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

**Progress:** 100% — 6 Live / 6 (1 Dropped excluded)

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
| New column `nx_solutioncontributor.nx_role` (CSM · Consultant) | Done in Dataverse · 🟢 **Live** | Contributor role selector, plugin read/write, and CSM listed apart from builders. Integrated from `juli` and deployed on 2026-09-28. Retired 2026-10-08 (the CSM is derived from `cr6b0_consultantlevel`) and deleted from Dataverse after that deploy ([2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required)) |
| New column `nx_solution.nx_clientrole` (Client Role, 14 values) | Done in Dataverse · 🟢 **Live** | Client role picker on connected drafts and plugin read/write, deployed on 2026-09-28. The PRISMA library filters by it ("Target client role"), in present mode too. Its exact meaning is still open |
| New table `nx_solutionfavorite` (per-person favorites) | Done in Dataverse · 🟢 **Live** | Delete Cascade from Solution, RemoveLink from Consultant. `FavoriteApi` (`nx_SetFavorite`, `nx_GetMyFavorites`) sets `nx_user` server-side; roles get User-depth Read only. Hearts and "My favorites" in the connected app. Deployed and republished on 2026-09-28; the user verified save and remove in the hosted app |
| Schema docs synced with Dataverse | 🟢 Live | Updated [SchemaV2](../data_model/SchemaV2.md), the example values, the legacy companion and reference-data governance (`23fe769`) |
| Top ranking (favorites, unique views, demo requests) | 🟢 Live | Live as a favorites-only ranking: `nx_GetTopFavorites` and the Top 10 shelf with save counts ([2026-09-28/29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux), [2026-10-01](#2026-10-01--working-session-top-3-save-counts-and-card-sizing)). Unique views and demo requests are not counted; views would need a private `nx_solutionview` table (open decision under 2026-09-28/29) |
| Lead CSM as a lookup on `nx_solution` (`nx_leadcsm`) | Dropped | Replaced by `nx_solutioncontributor.nx_role`, itself retired and deleted 2026-10-08 for the consultant level |

### Open decisions

- Specialization areas: the maximum per solution (the app assumes 3), and whether a "primary" area is needed. The current rule is lowest Sort Order.
- `nx_clientrole`: what it represents, whether it is required at submit, and whether it shows in present mode.
- CSM rows (`nx_role`): resolved 2026-10-08. `nx_role` is retired and was deleted after the deploy; the CSM is derived from the consultant level and is an ordinary contributor with hours ([2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required)).
- Favorites and ranking: which signals the ranking counts. Visibility: the Top 3 shows every internal user how many people saved each ranked solution (never who), outside present mode.
