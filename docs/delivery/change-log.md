# Change log by meeting

**Status:** Living · **Last updated:** 2026-09-24

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
| Specialization Area from 1:N lookup to native N:N (`nx_Solution_nx_SpecializationArea_nx_SpecializationArea`) | Done in Dataverse · **Live in the app** (catalogue) · In code (plugins) | The old lookup `nx_solution.nx_specializationarea` was **deleted**, which broke the published connected app. On 2026-09-24 the fix was merged to `main` (`04f76b2`, `7c0196a`) and the connected app was republished. Entry and the Library work again. Specialization Area now behaves like Industry: it is read through the N:N, and a solution without an area shows under "All" only. Next: build, test and deploy the updated plugins, which drafts, My submissions and review still need. Also add the N:N to `PRISMA_Dev` (it only sits in Default) and tag "Budget Management Solution" with an area |
| New column `nx_solutioncontributor.nx_role` (CSM · Consultant) | Done in Dataverse | The app doesn't read or write it yet. Rules for CSM rows are still open (see below) |
| New column `nx_solution.nx_clientrole` (Client Role, 14 values) | Done in Dataverse | Not used by the app yet. Its exact meaning is still open |
| New table `nx_solutionfavorite` (per-person favorites) | Done in Dataverse | Delete Cascade from Solution, RemoveLink from Consultant. Next: security role privileges, connected-app data source, a plugin that sets `nx_user` to the caller, and the "My favorites" view |
| Schema docs synced with Dataverse | Live | Updated [SchemaV2](../data_model/SchemaV2.md), the example values, the legacy companion and reference-data governance (`23fe769`) |
| Top ranking (favorites, unique views, demo requests) | Proposed | The suggested first phase ranks by favorites only, which needs no new table. Views need a private `nx_solutionview` table. Not built |
| Lead CSM as a lookup on `nx_solution` (`nx_leadcsm`) | Dropped | Replaced by `nx_solutioncontributor.nx_role` |

### Open decisions

- Specialization areas: the maximum per solution (the app assumes 3), and whether a "primary" area is needed. The current rule is lowest Sort Order.
- `nx_clientrole`: what it represents, whether it is required at submit, and whether it shows in present mode.
- CSM rows (`nx_role`): whether they carry effort, whether there is exactly one per solution, and whether they count toward the contributor minimum.
- Favorites and ranking: which signals the ranking counts, and who can see it.
