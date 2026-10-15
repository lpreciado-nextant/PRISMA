# ADR-0014 — Solution effort as an estimate and a complexity

**Status:** Accepted 2026-10-15. The two columns were created and their metadata verified the same day. The plug-ins and both apps are implemented on branch `feature/solution-effort` and not deployed.
**Date:** 2026-10-15
**Supersedes:** the effort part of [ADR-0007](adr-0007-contributor-effort.md). Its CSM-from-the-consultant-level decision stands.

## Context

[ADR-0007](adr-0007-contributor-effort.md) records effort as the minimum hours each contributor needed, entered per person and summed. In practice:

- A per-person split asks for precision nobody has.
- It makes the contributor list a timesheet.
- It keeps effort out of reach for a librarian edit, because contributor rows stay with the owner ([ADR-0013](adr-0013-librarian-content-editing.md)).

What CSMs and librarians actually use is a rough sense of how big and how hard the solution was. The change log already proposed a complexity classification (PR-011).

## Decision

Effort is a property of the **solution**, not of each contributor. Two columns on `nx_solution`:

- **Estimated Minimum Hours** (`nx_estimatedminimumhours`, Whole number). The least time the whole solution took, including preparation and discovery.
  - It is an estimate, so it is a whole number from 0 to 100,000.
  - It is **optional**, and blank is not zero.
- **Complexity** (`nx_complexity`, local choice). Easy = 125060000, Medium = 125060001, Hard = 125060002.
  - It is **required to submit and approve**, while drafts may leave it empty.
  - It is Business Required in Dataverse, which only Dataverse's own forms enforce; `ReviewPolicy.Complete` is the real check.

Both are **internal**:
- They are shown to the team inside the app, on the detail page's "Contributors & development effort" panel and in the review.
- They are never returned in present mode, by `nx_GetPublishedDetail` or the client, and never exported to the presentation download.
- They carry no column security: CSMs may read them in the app.

Contributors remain required to submit (at least one unique person), but only as credit.
- `nx_solutioncontributor.nx_directhours` is no longer read or written. The column and its existing values stay in Dataverse until a separately approved deletion.
- Older clients may still send `directHours`. The plug-in accepts the value and discards it.

Because effort now lives on the solution, a librarian edit ([ADR-0013](adr-0013-librarian-content-editing.md)) covers it, with the same "what changed and why" rule.

## Consequences

- **Data:** existing solutions have no complexity, so they must be completed before their next submission or approval. Already published records are unaffected until they are edited. Existing per-person hours are not migrated: they meant something different (per-person minimums) and the rows are test data.
- **Plug-ins:**
  - `nx_SaveCoreDraft` accepts `estimatedMinimumHours` and `complexityValue`.
  - The graph read no longer returns `hours`.
  - `nx_GetPublishedDetail` returns `estimatedMinimumHours` and `complexity` instead of per-credit `hours`, `effort` and `totalHours`.
  - The plug-in and the connected app change their response shapes together, so they must be deployed as a pair: plug-in first, then the app right after. In between, the old app cannot read the new responses.
- **Apps:**
  - The PoC and the connected app share `EffortFields`: complexity as a required radio group and the estimate as an optional whole-number field.
  - `ContributorRow` is credit only.
  - The review checklist gains a "Complexity" item and "Contributors" no longer requires hours.
  - The mock catalogue sets each solution's estimate to its former per-person total, with complexity derived from that total.
- **Out of scope:** filtering or sorting the library by complexity, and showing it on cards.
- **Revisit** if CSMs need complexity in front of clients, or if a per-person split is needed again.

## Implementation

[`app/src/lib/effort.ts`](../../../app/src/lib/effort.ts) exports:
- `estimatedHours` (validation);
- `COMPLEXITIES` and `COMPLEXITY_BY_CHOICE` (labels and live choice values);
- `effortSummary` ("~120 h · Medium").

On the plug-in side:
- `DraftPolicy` (`ComplexityValues`, `MaxEstimatedHours`) and `ReviewPolicy.Complete` enforce the rules.
- `PublishedApi.ComplexityName` maps the choice values to their labels.
- `Prisma.Deploy inspect-effort-columns` reads the live metadata. The live columns have no Dataverse-level 0–100,000 bounds; the plug-in and the form apply them.
