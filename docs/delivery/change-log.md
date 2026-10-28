# Change log by meeting

**Status:** Living · **Last updated:** 2026-10-28

One entry per meeting or working session, newest first. Each has one **Changes** table whose rows keep their place and move up in Status until live, and a **Progress** % computed from it. Link to the authoritative doc ([SchemaV2](../data_model/SchemaV2.md), an ADR, the [decision log](decision-log.md)) instead of repeating detail.

💬 marks **stakeholder feedback** (only Patricia, Sebastian, Ximena and Ernesto, Natalia and Andrés); 🛠️ marks **own changes**: things the team built, written in plain words, Live once published to the dev app (production follows the managed release). Their "Feedback" lists the reasons, not requests. Pending stakeholder feedback lives only in the four 💬 entries.

**Entries** (newest first — jump to a meeting)
| Date | Session | Source | Progress |
|---|---|---|---|
| [2026-10-28](#2026-10-28--working-session-new-presentation-templates-refresh-and-help) | New presentation templates (v4), Refresh on every tab, help in one panel | 🛠️ Own changes | 100% — 3 Live / 3 |
| [2026-10-27](#2026-10-27--working-session-review-across-areas-duplicate-technologies-and-ui-polish) | Review across areas, duplicate technology decisions, UI polish | 🛠️ Own changes | 100% — 4 Live / 4 |
| [2026-10-26](#2026-10-26--working-session-other-capability-librarian-scope-and-richer-text) | Other capability, librarian scope by area, richer text | 🛠️ Own changes | 100% — 6 Live / 6 |
| [2026-10-23](#2026-10-23--working-session-main-capability-present-mode-selection-and-form-polish) | Main capability by area, present-mode filters and selection, form polish | 🛠️ Own changes | 100% — 11 Live / 11 |
| [2026-10-22](#2026-10-22--working-session-redesigned-presentation-download) | Redesigned presentation download (Dark and Light) | 🛠️ Own changes | 100% — 1 Live / 1 |
| [2026-10-21](#2026-10-21--working-session-contact-from-the-help-page) | Contact from the help page | 🛠️ Own changes | 100% — 1 Live / 1 |
| [2026-10-15](#2026-10-15--working-session-librarian-content-editing-and-solution-level-effort) | Librarian content editing; solution-level effort; visual tweaks | 🛠️ Own changes | 100% — 5 Live / 5 |
| [2026-10-14](#2026-10-14--working-session-review-clarity-suggestions-filter-and-library-ui-polish) | Review clarity, Suggestions filter and library UI polish | 🛠️ Own changes | 100% — 11 Live / 11 |
| [2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required) | Contributor effort as minimum hours required; CSM from the consultant level | 🛠️ Own changes | 100% — 4 Live / 4 |
| [2026-10-07](#2026-10-07--working-session-presentation-download-refinements-and-new-technology-review) | Presentation download refinements and new-technology review | 🛠️ Own changes | 100% — 5 Live / 5 |
| [2026-10-01 (Natalia, Andrés)](#2026-10-01--feedback-session-with-natalia-and-andrés-governance-capabilities-and-review) | Governance, capability owners, approval, quality, adoption, required fields, review look and feel | 💬 **Stakeholder feedback** | 87% — 13 Live, 2 Proposed / 15 (1 Dropped excluded) |
| [2026-10-01](#2026-10-01--working-session-top-3-save-counts-and-card-sizing) | Top 3 save counts and card sizing | 🛠️ Own changes | 100% — 6 Live / 6 |
| [2026-09-30 (Sebastian)](#2026-09-30--feedback-session-with-sebastian-library-discovery-tag-accessibility-and-solution-detail-clarity) | Library discovery, content freshness, tag accessibility, solution-detail clarity, presentation download, demo filter, allocation, project N:N | 💬 **Stakeholder feedback** | 100% — 15 Live / 15 |
| [2026-09-30 (Ximena, Ernesto)](#2026-09-30--feedback-session-with-ximena-and-ernesto-external-resource-links-demo-viewing-experience-and-effort-communication) | External links, demo viewing experience, effort communication | 💬 **Stakeholder feedback** | 92% — 12 Live, 1 Proposed / 13 (3 Dropped excluded) |
| [2026-09-28 / 29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux) | Integration, favorites ranking and library UX | 🛠️ Own changes | 100% — 6 Live / 6 |
| [2026-09-23 (Patricia)](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites) | Data model update: Specialization Area, roles, client role, favorites | 💬 **Stakeholder feedback** | 100% — 6 Live / 6 (1 Dropped excluded) |

**Open decisions still pending** (from the entries below)
- Approver: PRISMA Librarian, Capability Owner, or both; who may see the approver's name; Capability Owners' editing scope (librarian editing is live since 2026-10-15; whether owners act only on their capabilities is [Q21](decision-log.md)) ([2026-10-01 (Natalia, Andrés)](#2026-10-01--feedback-session-with-natalia-and-andrés-governance-capabilities-and-review))
- Whether to record that AI was used to build a solution (tools used are covered by Technologies); one vs. several capabilities per solution; analytics vs. v1 scope ([2026-10-01 (Natalia, Andrés)](#2026-10-01--feedback-session-with-natalia-and-andrés-governance-capabilities-and-review))
- Whether to delete the retired `nx_startdate`/`nx_enddate` contributor columns (optional; first remove them from the unused "Information" form) ([2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required), [Q20](decision-log.md)). `nx_role` and `nx_allocationpercent` were deleted 2026-10-08; legacy rows without hours are dummy data, no backfill
- Merging duplicate technologies needs a librarian-only plug-in operation; today only the read-only `technology-duplicates` report exists ([2026-10-07](#2026-10-07--working-session-presentation-download-refinements-and-new-technology-review))
- Favorites ranking: whether to also count views/demo requests, and visibility in present mode ([2026-09-28/29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux))
- Specialization areas: max per solution, whether a "primary" area is needed ([2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites))
- `nx_clientrole`: meaning, required at submit?, shown in present mode? ([2026-09-23](#2026-09-23--data-model-update-specialization-area-roles-client-role-favorites))

When one is resolved, delete it here and update its entry (or move it to the [decision log](decision-log.md)).

**Status values and progress weight**

| Status | Meaning | Weight |
|---|---|---|
| Proposed | Discussed, not yet built | 0% |
| Done in Dataverse | Table, column or relationship exists in `PRISMA_Dev` (Nextant Pulse) | 25% |
| In code | Implemented on a branch, not yet deployed or published | 50% |
| 🔴 Pending to do | Agreed and still to be done; nothing built yet | 0% |
| 🟡 Pending review | Built or set up, awaiting stakeholder review or confirmation | 75% |
| 🟢 Live | Deployed/published and working in the app | 100% |
| Dropped | Decided against, or replaced by another change | excluded from the total |

**Progress %** is the average weight of a session's rows, leaving out `Dropped` (e.g. 2 Live + 8 Proposed → 20%). A row with mixed sub-steps counts at its most advanced deployed state. When a Status changes, update the entry's Progress line and its row in "Entries".

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

## 2026-10-28 — Working session: new presentation templates, Refresh and help

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 3 Live / 3

### Feedback

- The presentation download should follow the new card-and-pill design, in Dark and Light.
- People needed to reload data without leaving the tab they were on.
- The help page spread its introduction, contact and steps across separate places.

### Changes

| Change | Status | Notes |
|---|---|---|
| Presentation download with the new card-and-pill templates (v4), Dark and Light, including Juliana's corrections to Light; the cover keeps the whole summary | 🟢 Live | [Field map](../../tools/pptx-template/PRISMA_Field_Map.md) |
| **Refresh** at the end of the section tabs, on every tab | 🟢 Live |  |
| Help: introduction, contact shortcut and the How PRISMA works steps in one panel; clearer suggestions panel, librarian guide and common questions | 🟢 Live |  |

## 2026-10-27 — Working session: review across areas, duplicate technologies and UI polish

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 4 Live / 4

### Feedback

- Librarians needed to see the whole review queue, not only their area, without deciding outside it.
- Technologies that look like an existing one were getting approved as new tags.
- Some buttons gave no hover feedback, and people did not know why Continue was disabled.

### Changes

| Change | Status | Notes |
|---|---|---|
| Librarians see every area's review queue but decide only in their own (**My capability** option, with counts) | 🟢 Live | [runbook](../operations/librarian-runbook.md) |
| Possible duplicate technologies: the librarian chooses to use the existing one or keep the new one; approval waits for that decision, and the warning shows only in Pending review | 🟢 Live | [runbook](../operations/librarian-runbook.md) |
| Review queue's Capability filter lists only capabilities with submissions in that tab | 🟢 Live |  |
| Every button shows hover, the form says what blocks Continue, a busy overlay while saving, and My submissions cards open on the first click | 🟢 Live | [design system](../design/design-system.md) |

## 2026-10-26 — Working session: other capability, librarian scope and richer text

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 6 Live / 6

### Feedback

- The "other capability" existed in Dataverse but the app could not save it yet.
- Librarians should work on the areas their capabilities belong to.
- Long descriptions needed structure, and uploaded files showed technical names.

### Changes

| Change | Status | Notes |
|---|---|---|
| One other capability per solution, saved and shown in the connected app | 🟢 Live | Plug-ins deployed by Luis |
| Librarians act on the specialization areas of the capabilities they own | 🟢 Live | [runbook](../operations/librarian-runbook.md) |
| Long texts accept safe formatting (bold, lists, links) | 🟢 Live |  |
| Uploaded files show a readable name | 🟢 Live |  |
| List rows, thumbnails in My submissions and updated help | 🟢 Live |  |
| Drafts keep contributors and classification chosen again after removing them | 🟢 Live |  |

## 2026-10-23 — Working session: main capability, present-mode selection and form polish

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 11 Live / 11

### Feedback

- Cards with new suggestions barely stood out.
- Areas and capability were chosen separately and could contradict each other, so the card colour was arbitrary.
- Present mode had only search and areas; CSMs want to filter, reset in one click and show a list prepared before the call.
- Status labels had no explanation; the contributor and effort rows took too much space; the first contributor could not be removed.

### Changes

| Change | Status | Notes |
|---|---|---|
| Cards with new feedback glow so they stand out (static with reduced motion) | 🟢 Live |  |
| **Classify & tag** step: one main capability chosen from columns by area; the solution's area and capability owner follow from it | 🟢 Live |  |
| One other capability per solution | 🟢 Live | Saved by the connected app since 2026-10-26 |
| Present mode: filters behind a **Filters** button, built only from client-safe solutions | 🟢 Live | [present mode](../workflows/present-mode.md) |
| One **Clear all** resets search, area and filters | 🟢 Live |  |
| Present mode: **Selected for you** shows your saved solutions that are safe to present, with a **Show my saved solutions** switch | 🟢 Live | [present mode](../workflows/present-mode.md) |
| Status and complexity explained under their fields | 🟢 Live |  |
| Contributors as removable bubbles, a tidier effort line, target client roles A–Z | 🟢 Live |  |
| My submissions: **Needs your attention** above **All my solutions**, with filters, sort and grid or list | 🟢 Live | [contribution and review](../workflows/contribution-and-review.md) |
| Review queue filters by the main capability's area, with Clear all | 🟢 Live | [runbook](../operations/librarian-runbook.md) |
| Same-size cards and an aligned list view | 🟢 Live |  |

## 2026-10-22 — Working session: redesigned presentation download

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 1 Live / 1

### Feedback

- Juliana reworked a downloaded deck in PowerPoint (larger titles, lists instead of cards) and wanted it as the download, with a Light version.

### Changes

| Change | Status | Notes |
|---|---|---|
| New Dark and Light presentation templates from that redesign | 🟢 Live | Replaced by the v4 templates on 2026-10-28 |

## 2026-10-21 — Working session: contact from the help page

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 1 Live / 1

### Feedback

- People who find an inconsistency or have a question need a way to reach the PRISMA team from the app.

### Changes

| Change | Status | Notes |
|---|---|---|
| Help page **Contact**: Chat in Teams or Email the PRISMA team, with a link to the page you came from | 🟢 Live |  |

## 2026-10-15 — Working session: librarian content editing and solution-level effort

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 5 Live / 5

### Feedback

- The librarian should be able to fix a solution, not only send it back with comments, and the owner must know what changed and why.
- Effort should be one minimum-hours estimate for the whole solution plus how hard it was to build, not hours per person.
- Small visual issues: the Data colour looked like AI's in light theme, the effort fields did not match, and "Estimated cost" should not show.

### Changes

| Change | Status | Notes |
|---|---|---|
| The librarian edits a solution under review or published, says what changed and why, and the owner sees "Edited by the librarian" | 🟢 Live | [ADR-0013](../architecture/decisions/adr-0013-librarian-content-editing.md) |
| Effort: one optional hour estimate per solution and a required complexity (Easy, Medium, Hard); per-person hours removed | 🟢 Live | [ADR-0014](../architecture/decisions/adr-0014-solution-effort-estimate-and-complexity.md) |
| Review panel: **Edit solution** is the main action; Send back and Retire move to a ••• menu | 🟢 Live | [runbook](../operations/librarian-runbook.md) |
| Review queue: amber marks only what is waiting for you | 🟢 Live |  |
| Visual fixes: Data colour in light theme, effort fields, librarian editor notice; "Estimated cost" removed | 🟢 Live | [design system](../design/design-system.md) |

## 2026-10-14 — Working session: review clarity, Suggestions filter and library UI polish

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 11 Live / 11

### Feedback

- Suggest a change opened its form where it was easy to miss.
- The librarian review panel had too much text.
- Owners need to see which solutions have suggestions and who sent them.
- The library headings, toolbar and filters felt heavy, and the filters did not work well on small screens.

### Changes

| Change | Status | Notes |
|---|---|---|
| Suggest a change jumps to its form, now in the side column | 🟢 Live |  |
| Review panel shows only what is missing and possible duplicate technologies | 🟢 Live | [runbook](../operations/librarian-runbook.md) |
| Review: solution overview with Capability Owner, a five-item publication checklist, and a short reason required to request changes | 🟢 Live | [runbook](../operations/librarian-runbook.md) |
| Review: compact Published row; Request changes and Retire open their own form | 🟢 Live | [runbook](../operations/librarian-runbook.md) |
| My submissions: Suggestions filter, who sent them, suggestions read inside the solution, Edit on the card | 🟢 Live | [contribution and review](../workflows/contribution-and-review.md) |
| Mark feedback as addressed, New / Addressed / All filter and "N new" counts, saved in Dataverse | 🟢 Live | [contribution and review](../workflows/contribution-and-review.md) |
| Solution page side column reorganized; internal sections never show in present mode | 🟢 Live | [present mode](../workflows/present-mode.md) |
| Download presentation: theme menu with hints and a confirmation | 🟢 Live |  |
| Library: lighter hero and headings, glass search, area filters with colour dots, counts | 🟢 Live | [design system](../design/design-system.md) |
| Refine filters: collapsible groups, search, hide or show, mobile drawer, Clear all | 🟢 Live | [design system](../design/design-system.md) |
| Header: slim bar, Submit as the main button, section tabs with counts | 🟢 Live | [design system](../design/design-system.md) |

## 2026-10-08 — Working session: contributor effort as minimum hours required

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 4 Live / 4

### Feedback

- Asking dates and a percentage per person added work without adding meaning.
- The contributor role picker repeated what the consultant directory already knows.
- Every solution must say what it does and its business value.

### Changes

| Change | Status | Notes |
|---|---|---|
| Effort per person as "Minimum hours required"; dates, allocation and the holiday calendar removed | 🟢 Live | Replaced by solution-level effort on 2026-10-15 |
| The solution page shows "Incomplete" effort instead of an error when hours are missing | 🟢 Live |  |
| Contributor role comes from the consultant directory, and the CSM is recognized from it | 🟢 Live | [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md#csm-from-the-consultant-level) |
| "What it does" and "Business value" required to submit | 🟢 Live |  |

### Open decisions

- Whether to delete the unused contributor start and end date columns ([Q20](decision-log.md)).

## 2026-10-07 — Working session: presentation download refinements and new-technology review

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 5 Live / 5

### Feedback

- The downloaded presentation must fit each solution's content, and every demo button must do what it says.
- Reviewers should notice a new technology before it becomes a near-duplicate tag.

### Changes

| Change | Status | Notes |
|---|---|---|
| Presentation demos slide in three columns, with Play, Open or Download buttons that work | 🟢 Live |  |
| Slides adapt to the content: names, cards, screenshots and tags | 🟢 Live |  |
| Speaker notes on every slide, and the library link works in full | 🟢 Live |  |
| Review panel flags new technologies and the similar existing names | 🟢 Live | [runbook](../operations/librarian-runbook.md) |
| Team report of look-alike technologies (local tool) | 🟢 Live | [Reference-data governance](../data_model/reference-data-governance.md) |

### Open decisions

- Merging duplicate technologies automatically.
- Readable demo titles in the presentation ([Q19](decision-log.md)).


## 2026-10-01 — Feedback session with Natalia and Andrés: governance, capabilities and review

<div style="background:#e3f4e8;color:#14532d;border-left:4px solid #2e7d32;padding:8px 12px;border-radius:4px">💬 <b>Stakeholder feedback</b> from Natalia and Andrés.</div>

**Attendees:** Natalia, Andrés
**Progress:** 87% — 13 Live, 2 Proposed / 15 (1 Dropped excluded)

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
| **High** · Define the approval process (Librarian role); proposed approver is the Capability Owner | 🟢 Live | Marked Live 2026-10-28. Today the PRISMA Librarian role approves ([runbook](../operations/librarian-runbook.md)). Capability Owner as approver depends on the next row; who sees the approver is [decision log Q17](decision-log.md) |
| **High** · Associate each solution with its Capability Owner | 🟢 Live | 2026-10-13: `nx_capability.nx_capabilityowner` (lookup to `cr6b0_consultant`) added and filled for 8 of 10 capabilities, so each solution reaches its owner through its capability. 2026-10-14: shown read-only on the solution page and in the librarian review panel (`8a8afb6`, `91ad934`); marked Live 2026-10-28 ([decision log Q15](decision-log.md), [SchemaV2](../data_model/SchemaV2.md#nx_capability)) |
| **High** · Align capabilities with the official organization framework | 🟢 Live | 2026-10-13: the 10 capabilities were renamed to the framework and each now belongs to a specialization area (`nx_capability.nx_specializationarea`); list in [SchemaV2](../data_model/SchemaV2.md#nx_capability). "Business Aplication Engineering" has a typo in Dataverse. Existing solutions keep their capability; the app shows the new names on its next read. Marked Live 2026-10-28 |
| **High** · Define the content governance model (ownership, submission, review, approval, maintenance) | 🟢 Live | Marked Live 2026-10-28. Builds on [ADR-0008](../architecture/decisions/adr-0008-controlled-submission-transitions.md) and the [content health](../operations/content-health.md) runbook |
| **High** · Define content quality standards | 🟢 Live | 2026-10-14: the librarian's **Publication checklist** sets five quality criteria to confirm before approving (no confidential data or PII in media; client details anonymized unless authorized; accurate, professional, non-confidential descriptions; demos and documents fit the audience; correct classification), live in `8a8afb6` ([runbook](../operations/librarian-runbook.md)); marked Live 2026-10-28 |
| **High** · Capture lessons learned and insights | 🟢 Live | Columns created 2026-10-13 (`nx_challenges` and `nx_lessonslearned`, both text area, 2000 characters). Signed plug-in deployed by Luis 2026-10-13 22:18 UTC (verified to contain both columns); connected app published from `5c6e00b` the same day with the "Challenges & lessons learned" section in Solution context and the internal panel on the solution page; hosted UI not yet checked. Schema decided 2026-10-13: two optional multiline columns on `nx_solution`, Challenges (`nx_challenges`) and Lessons learned (`nx_lessonslearned`), both **internal-only** like `nx_clientcontext`: the plug-ins omit them when `Present` is true (ADR-0005), the present catalogue query does not select them and the presentation download never exports them. Outside present mode any internal user who can read the solution sees them (no field-level security). Next: create the columns in `PRISMA_Dev`, then plug-ins, connected form ("Solution context" step) and detail section |
| **Medium** · Adoption strategy; user guide; training videos and onboarding | 🟢 Live | Marked Live 2026-10-28. 2026-10-15: in-app help built (`#/help`, from a masthead info button and the welcome screen): one guide per role and common questions, tailored to each app ([design system](../design/design-system.md)). The general walkthrough video is **on hold** until the app is ready; adoption and rollout material stay outside the app |
| **Medium** · Contextual guidance in forms for classifying solutions and capabilities | Dropped | 2026-10-15: not needed. Capabilities and specialization areas are understood across Nextant, so the form keeps its existing hints and adds no classification guidance |
| **Medium** · Content curation: may Capability Owners correct metadata before publication? | 🟢 Live | Live 2026-10-15 through librarian content editing ([ADR-0013](../architecture/decisions/adr-0013-librarian-content-editing.md)): a PRISMA Librarian edits another person's Pending review or Published solution in place (all content except the contributor list) and must tell the owner what changed and why. Capability Owners edit as librarians; their scope (own capabilities only or all) is open as [Q21](decision-log.md) |
| **Medium** · Track tools used to build the solution (Copilot, Cowork, GitHub Copilot, …) and whether AI was used | 🟢 Live | Tools used: decided 2026-10-13, no new field; they are captured as Technologies, already live in the app. Marked Live 2026-10-14 at the user's request; whether AI was used has no field of its own |
| **Medium** · Review whether one capability per solution is enough | Proposed | `nx_capability` is a single lookup today ([SchemaV2](../data_model/SchemaV2.md)) |
| **Medium** · Retrieve roles from Azure AD instead of manual entry | 🟢 Live | Delivered 2026-10-08 for the contributor role: it now comes automatically from the consultant directory, `cr6b0_consultant.cr6b0_consultantlevel` (synced directory data), shown read-only, and a level naming customer success marks the solution's CSM; the manual `nx_role` entry was removed and the column deleted. The source is the `cr6b0_consultant` table, not a direct Microsoft Entra ID (Azure AD) call. The client role (`nx_clientrole`) is unchanged and still entered manually. `1c89c2d`, deployed 2026-10-08 ([2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required), [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md#csm-from-the-consultant-level)) |
| **Medium** · Effort metadata: whether to capture and show minimum effort estimates | 🟢 Live | Live 2026-10-15 at solution level ([ADR-0014](../architecture/decisions/adr-0014-solution-effort-estimate-and-complexity.md)): one optional whole-hour estimate (`nx_estimatedminimumhours`) and a required complexity, Easy / Medium / Hard (`nx_complexity`), shown internally on the solution page and never in present mode or the presentation download. Per-contributor hours were retired |
| **Low** · Adoption analytics (usage, contribution rates, capability coverage) and AI tool analytics | Proposed | Note: analytics dashboards are out of scope for v1 (AGENTS.md); confirm before building |
| Redefine required fields in the submission form | 🟢 Live | One legend per step ("* Required to submit for review. To save a draft, only the solution name is needed."), the same accessible asterisk on every required field and "(optional)" on the rest. `98b88a7`, published 2026-10-02 ([app README](../../app/README.md#required-and-optional-field-marks-2026-10-02)) |
| Improve the librarian review look and feel | 🟢 Live | Review panel (status → checklist → one decision at a time), Review points, review queue filters and state-coloured cards, "Waiting for corrections" and Published blocks. `5460e95`, `ee8dc31`, `e2ca558`, published 2026-10-02 ([runbook](../operations/librarian-runbook.md)). Sending a published record back for changes ("Need to change it?") and a required retire reason are also Live: deployed 2026-10-02 (signed plug-in by Luis, then the connected app) and confirmed working by the user ([decision log Q18](decision-log.md)) |

### Open decisions

- Who approves: the PRISMA Librarian role, the Capability Owner, or both; and who may see the approver's name (Q15, Q17)
- Whether Capability Owners may edit metadata before publication
- Whether to record that AI was used to build a solution. Tools used need no field (Technologies covers them); lessons learned is decided (two internal columns, readable by any internal user outside present mode)
- One capability per solution, or several
- Whether adoption and AI-tool analytics fit v1 scope

## 2026-10-01 — Working session: Top 3 save counts and card sizing

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

**Progress:** 100% — 6 Live / 6

### Feedback

- Show how popular each Top 3 solution is, without revealing who saved it.
- Make it clearer that the Top 3 shelf scrolls; area tags crowded the narrower cards.

### Changes

| Change | Status | Notes |
|---|---|---|
| Top 3 cards show how many people saved each solution, with a small heart in the corner | 🟢 Live |  |
| Narrower Top 3 cards so the next one peeks and the shelf clearly scrolls; area tag removed | 🟢 Live | [design system](../design/design-system.md) |
| Dark theme: the AI area blue no longer looks like Data's teal | 🟢 Live |  |
| Submit form reorganized into **Define the solution** and **Solution context**; client fields only when the solution has a client | 🟢 Live |  |
| "Top N" and "Solution Library" headings in the brand colour, not an area colour | 🟢 Live |  |
| Library hero: the "All areas" note removed | 🟢 Live |  |


## 2026-09-30 — Feedback session with Sebastian: library discovery, tag accessibility, and solution-detail clarity

<div style="background:#e3f4e8;color:#14532d;border-left:4px solid #2e7d32;padding:8px 12px;border-radius:4px">💬 <b>Stakeholder feedback</b> from Sebastian.</div>

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

## 2026-09-30 — Feedback session with Ximena and Ernesto: external resource links, demo viewing experience, and effort communication

<div style="background:#e3f4e8;color:#14532d;border-left:4px solid #2e7d32;padding:8px 12px;border-radius:4px">💬 <b>Stakeholder feedback</b> from Ximena and Ernesto.</div>

**Attendees:** Ximena, Ernesto
**Progress:** 92% — 12 Live, 1 Proposed / 13 (3 Dropped excluded)

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
| PR-001 External resource / repository links (incl. Marketing Kit) | 🟢 Live | Closed 2026-10-08. The connected Media step stores a link instead of an upload: **URL**, Power Apps, Power BI or desktop arrangements, checked live 2026-09-22 ([Demo assets](../workflows/demo-assets.md)). A Marketing Kit or repository goes in as a URL under "Supporting material" (PR-028). The 2026-10-08 change renames the "Hosted web app (URL)" option to **URL** on screen only; the Dataverse choice is unchanged. Rename published with the connected app on 2026-10-08 (`6c19f67`); hosted UI not yet checked |
| PR-002 Tool URL field | Dropped | Closed 2026-10-08 as covered by PR-001: no dedicated field; a tool is added as a **URL** link under "Supporting material", whose hint now invites tools, repositories and marketing kits |
| PR-003 Prototype URL field | Dropped | Closed 2026-10-08 as covered by PR-001: no dedicated field; a prototype is added as a **URL** link under "Interactive demo", whose hint now invites prototypes |
| PR-004 Full-screen demo/prototype view | 🟢 Live | 2026-10-01: Full screen button in every viewer (browser full screen, or the stage expanded over the PRISMA chrome when the Power Apps host forbids it). In Local Play the host granted full screen and the demo filled the monitor. See [Demo assets](../workflows/demo-assets.md#viewer-routes) |
| PR-005 Open demo/prototype in a new tab | 🟢 Live | Every published solution page has **Copy link** (Luis, `e6f4c92` and `7237ea3`, 2026-09-30): a play link carrying `?route=/s/{id}` that opens that solution directly, in a new tab or for a colleague, with the usual sign-in and access checks ([ADR-0003](../architecture/decisions/adr-0003-hash-routing.md)). Hosted demo URLs also keep **Pop out** (new tab) in the viewer |
| PR-006 Demo modal/popup view | 🟢 Live | Resolved 2026-10-14 without a modal: every viewer demo offers **Open in new tab**, which opens that demo alone in a focused viewer (in present mode when opened from it), alongside Full screen (PR-004). `1f6a01b`, published and confirmed by the user ([demo assets](../workflows/demo-assets.md)) |
| PR-007 Reduce chrome around the demo viewer | 🟢 Live | 2026-10-14: one centred 16:9 stage for every demo type, the same in the viewer and the solution page's main demo; the focused viewer (Open in new tab) shows the demo with only its title bar, no masthead, tabs or banner. `1f6a01b`, published and confirmed by the user |
| PR-008 User feedback capture (comments/suggestions) | 🟢 Live | Live 2026-10-13: `nx_SuggestChange` and `nx_GetSolutionSuggestions` registered by Juliana (Web API, same definition as `Prisma.Deploy suggestion-api`), clients generated and the connected app published with **Suggest a change** and the **Suggestions** panel; hosted UI not yet checked. Table `nx_solutionsuggestion` created 2026-10-13; `SuggestionApi` plug-in, `suggestion-api` registration command and the connected button/panel in code ([ADR-0012](../architecture/decisions/adr-0012-private-solution-suggestions.md)). Medium priority. Decided 2026-10-13: private **suggestions** on published solutions, not public comments (no social features in v1). Anyone who can read a published solution, outside present mode, uses **Suggest a change** on the solution page (owner included: second signed plug-in deployed by Luis and connected app republished 2026-10-14). Only the owner, the solution's contributors and the PRISMA Librarian read them, in a **Suggestions** panel on the same page, with the author's name and date; no status. Separate from the librarian review. Signed plug-in with `SuggestionApi` deployed 2026-10-13 22:18 UTC |
| PR-009 Solution rating / usefulness score | Proposed | Low priority |
| PR-010 Estimated duration metadata instead of hours | 🟢 Live | 2026-10-15: resolved as one whole-hour estimate for the solution (`nx_estimatedminimumhours`, optional), replacing per-person hours ([ADR-0014](../architecture/decisions/adr-0014-solution-effort-estimate-and-complexity.md)). Deployed 2026-10-15 |
| PR-011 Complexity classification (Small / Medium / Large) | 🟢 Live | 2026-10-15: `nx_complexity` Easy / Medium / Hard, required to submit and approve, internal only ([ADR-0014](../architecture/decisions/adr-0014-solution-effort-estimate-and-complexity.md)). Deployed 2026-10-15 |
| PR-012 Time-tracking system integration | 🟢 Live | Resolved 2026-10-06 as a time filter in the library: an "Added: …" picker beside "Sort by" with Any time / Last 30 days / Last 3 months / Last 6 months / Last 12 months, each showing how many solutions it leaves. Filters on creation date (`createdon`), months counted as calendar months back from today; kept in the URL (`added=3m`). `6e0b314`, `8a7b544`, published 2026-10-06 ([design system](../design/design-system.md#library-page)). Integration with an external time-tracking system is not part of this |
| PR-013 Solution-to-workstream/project mapping | 🟢 Live | Resolved 2026-10-14 with the existing projects table: a solution links to any number of `cr6b0_project` rows through the native N:N (PR-030, live), chosen in the form's Projects picker and shown as **Associated projects** on the solution page (internal; hidden in present mode). No separate workstream table |
| PR-014 Media display standardization (video/image/HTML/demo) | 🟢 Live | 2026-10-14: video, uploaded HTML, embedded links and images play in one centred 16:9 stage, the same size and place for every type, with the same Full screen and Open in new tab (`1f6a01b`). Decided 2026-10-14 (user): demos open on request, never auto-shown on the solution page, for quality; the connected app keeps listing them as rows. Screenshots keep their own gallery and lightbox; PDF and PowerPoint download |
| PR-031 More than one target client role per solution | 🟢 Live | Added 2026-10-14 from Ximena's feedback. 2026-10-21: the user created the `nx_clientrole` table (14 roles), the N:N `nx_ClientRole_nx_Solution_nx_Solution` and the role privileges (read back with `inspect-client-roles`). On branch `feat/client-roles-nn`: plug-ins (graph `clientRoleIds`, catalogue `clientRoles`, guard), form chips in the same place (several at once), "Target client role" filter matching any chosen role, solution page, PoC mock ([SchemaV2](../data_model/SchemaV2.md#nx_clientrole)). `nx_clientrole` data source generated with `pa app add data-source` (PAC 2.12.2 fails on the Custom API schemas). No backfill: the 4 solutions with the old choice are dummy data (user, 2026-10-21). Deployed 2026-10-21 from `main` `d630738` by Luis (PR #3): signed plug-in, then the connected app; CI passed and the catalogue loaded without alerts. The user then deleted `nx_solution.nx_clientrole` and checked editing several roles in the hosted app the same day |
| PR-032 More than one client per solution | Dropped | Dropped 2026-10-28: not requested. Added 2026-10-16 from Ximena's feedback (raised 2026-09-30, had no row). Today the client is one free-text pair on `nx_solution`, `nx_clientcontext` (internal) and `nx_clientcontextredacted` (the only one shown in present mode). Several clients means a child table or N:N with an internal name and a redacted label per client, plus the form, the solution page, present-mode filtering (ADR-0005) and the plug-ins. Never started |

### Open decisions

- ~~Modal/popup (PR-006)~~ resolved 2026-10-14: Open in new tab in a focused viewer replaces it.
- ~~How effort is represented going forward (PR-010/011)~~ decided 2026-10-15: a solution-level whole-hour estimate plus Easy/Medium/Hard complexity, replacing ADR-0007's per-person hours ([ADR-0014](../architecture/decisions/adr-0014-solution-effort-estimate-and-complexity.md)).
- ~~Workstream/project mapping (PR-013)~~ resolved 2026-10-14 through the projects table (N:N, PR-030).

## 2026-09-28 / 29 — Working sessions: integration, favorites ranking and library UX

<div style="background:#cbd2da;color:#1f2937;border-left:4px solid #64748b;padding:8px 12px;border-radius:4px">🛠️ <b>Own changes</b>, not stakeholder feedback. "Feedback" below lists the reasons for the change.</div>

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

<div style="background:#e3f4e8;color:#14532d;border-left:4px solid #2e7d32;padding:8px 12px;border-radius:4px">💬 <b>Stakeholder feedback</b> from Patricia.</div>

**Attendees:** Patricia
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
| Specialization Area from 1:N lookup to native N:N (`nx_Solution_nx_SpecializationArea_nx_SpecializationArea`) | 🟢 Live | The old lookup `nx_solution.nx_specializationarea` was **deleted**, which broke the published connected app. On 2026-09-24 the catalogue fix was merged to `main` (`04f76b2`, `7c0196a`) and the connected app was republished. On 2026-09-28 the updated plugins were deployed with the app, so drafts, My submissions and review use the N:N too. Specialization Area behaves like Industry: a solution without an area shows under "All" only. The N:N was added to `PRISMA_Dev` on 2026-09-28. Still to do: tag "Budget Management Solution" with an area |
| New column `nx_solutioncontributor.nx_role` (CSM · Consultant) | 🟢 Live | Contributor role selector, plugin read/write, and CSM listed apart from builders. Integrated from `juli` and deployed on 2026-09-28. Retired 2026-10-08 (the CSM is derived from `cr6b0_consultantlevel`) and deleted from Dataverse after that deploy ([2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required)) |
| New column `nx_solution.nx_clientrole` (Client Role, 14 values) | 🟢 Live | Client role picker on connected drafts and plugin read/write, deployed on 2026-09-28. The PRISMA library filters by it ("Target client role"), in present mode too. Its exact meaning is still open |
| New table `nx_solutionfavorite` (per-person favorites) | 🟢 Live | Delete Cascade from Solution, RemoveLink from Consultant. `FavoriteApi` (`nx_SetFavorite`, `nx_GetMyFavorites`) sets `nx_user` server-side; roles get User-depth Read only. Hearts and "My favorites" in the connected app. Deployed and republished on 2026-09-28; the user verified save and remove in the hosted app |
| Schema docs synced with Dataverse | 🟢 Live | Updated [SchemaV2](../data_model/SchemaV2.md), the example values, the legacy companion and reference-data governance (`23fe769`) |
| Top ranking (favorites, unique views, demo requests) | 🟢 Live | Live as a favorites-only ranking: `nx_GetTopFavorites` and the Top 10 shelf with save counts ([2026-09-28/29](#2026-09-28--29--working-sessions-integration-favorites-ranking-and-library-ux), [2026-10-01](#2026-10-01--working-session-top-3-save-counts-and-card-sizing)). Unique views and demo requests are not counted; views would need a private `nx_solutionview` table (open decision under 2026-09-28/29) |
| Lead CSM as a lookup on `nx_solution` (`nx_leadcsm`) | Dropped | Replaced by `nx_solutioncontributor.nx_role`, itself retired and deleted 2026-10-08 for the consultant level |

### Open decisions

- Specialization areas: the maximum per solution (the app assumes 3), and whether a "primary" area is needed. The current rule is lowest Sort Order.
- `nx_clientrole`: what it represents, whether it is required at submit, and whether it shows in present mode.
- CSM rows (`nx_role`): resolved 2026-10-08. `nx_role` is retired and was deleted after the deploy; the CSM is derived from the consultant level and is an ordinary contributor with hours ([2026-10-08](#2026-10-08--working-session-contributor-effort-as-minimum-hours-required)).
- Favorites and ranking: which signals the ranking counts. Visibility: the Top 3 shows every internal user how many people saved each ranked solution (never who), outside present mode.
