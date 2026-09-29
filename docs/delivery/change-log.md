# Change log by meeting

**Status:** Living · **Last updated:** 2026-09-29

One entry per meeting or working session, newest first. Each entry lists the feedback raised and the changes proposed, and tracks each change until it is live. Keep it short: link to the authoritative doc ([SchemaV2](../data_model/SchemaV2.md), an ADR, the [decision log](decision-log.md)) instead of repeating detail.

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
- Favorites and ranking: which signals the ranking counts, and who can see it.
