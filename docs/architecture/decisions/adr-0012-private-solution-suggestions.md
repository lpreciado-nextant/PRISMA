# ADR-0012 — Private suggestions on published solutions

**Status:** Accepted. Table `nx_solutionsuggestion` created in `PRISMA_Dev` 2026-10-13; signed plug-in containing `SuggestionApi` deployed 2026-10-13 22:18 UTC; Custom APIs not yet registered; connected UI shipped switched off.
**Date:** 2026-10-13
**Last updated:** 2026-10-13

## Context

The team asked for a way to propose **changes and improvements** to a solution that does not go through the librarian review (PR-008 in the [change log](../../delivery/change-log.md)). The review only covers submissions on their way to publication; once a solution is published, nobody who uses it has a channel to tell its builders what to improve.

What the owner already knows (blockers, recommendations) is covered by the internal Challenges and Lessons learned fields. This decision covers what **other people** notice. v1 excludes social features (AGENTS.md), so public comments, threads or likes are not an option.

## Decision

- New user-owned table **`nx_solutionsuggestion`** (Solution Suggestion): `nx_name` (primary, filled by the server), `nx_solution` (lookup, Delete: Cascade All, Assign/Share: Cascade None), `nx_suggestion` (text area, 1000), `nx_suggestedby` (lookup to `cr6b0_consultant`). The date is `createdon`. No status column: suggestions are a list, not a workflow.
- **Who sends:** anyone who can read a Published, active solution, except its owner, outside present mode. The author is the signed-in person's consultant record, resolved on the server by email (the same rule as favorites); the client never sends an identity.
- **Who reads:** only the solution's **owner**, its **contributors** (`nx_solutioncontributor.nx_builtby` matches the caller's consultant) and the **PRISMA Librarian**. They see each suggestion's text, author name and date. Nobody else can list them.
- Two Custom APIs on `Prisma.Plugins.SuggestionApi`: `nx_SuggestChange` (SolutionId, Text) and `nx_GetSolutionSuggestions` (SolutionId, returns `canRead` and the list). Both use the execute privilege `prvReadnx_Solution`: the caller proves Read on the solution, and the plug-in reads and writes the table as the server. **No role gets privileges on the table**, so nobody can read another person's suggestions directly; the author still owns the row.
- **UI (connected only):** on the published solution page, readers get a **Suggestions** panel; everyone else gets **Suggest a change**, a short form in the same place. Neither renders in present mode; the PoC has no suggestions.

## Consequences

- Builders get feedback from colleagues without reopening the review, and it stays private to the people who can act on it.
- Rollout order: table (done) → signed plug-in (`blob-plugin --execute`) → `suggestion-api --execute` (registers the two APIs; its preview checks the table first) → generate the two clients in `app/connected` → wire `suggestionApi` in `dataSource.ts` → publish the app. Until the clients exist, `suggestionApi` is undefined and the page shows neither the button nor the panel.
- No notification yet: owners see suggestions when they open the solution. Email notification would follow [ADR-0006](adr-0006-power-automate-notifications-only.md).
- Suggestions are not moderated or editable after sending. Deleting a solution deletes its suggestions.
