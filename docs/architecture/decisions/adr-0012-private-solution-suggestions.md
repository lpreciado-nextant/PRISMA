# ADR-0012 — Private suggestions on published solutions

**Status:** Accepted. Table `nx_solutionsuggestion` created in `PRISMA_Dev` 2026-10-13; signed plug-in containing `SuggestionApi` deployed 2026-10-13 22:18 UTC; both Custom APIs registered and the connected app published with suggestions on the same day; hosted UI not yet checked. 2026-10-14: `nx_addressedon` created; signed plug-in with addressing and open feedback deployed 22:56 UTC, `nx_AddressSuggestion` and `nx_GetMyOpenFeedback` registered, clients generated and the connected app published. Owner-only addressing deployed in the signed plug-in 2026-10-26; owner/non-owner address and reopen paths covered by local API tests, live least-privilege write acceptance pending.
**Date:** 2026-10-13
**Last updated:** 2026-10-26

## Context

The team asked for a way to propose **changes and improvements** to a solution that does not go through the librarian review (PR-008 in the [change log](../../delivery/change-log.md)). The review only covers submissions on their way to publication; once a solution is published, nobody who uses it has a channel to tell its builders what to improve.

What the owner already knows (blockers, recommendations) is covered by the internal Challenges and Lessons learned fields. This decision covers what **other people** notice. v1 excludes social features (AGENTS.md), so public comments, threads or likes are not an option.

## Decision

- New user-owned table **`nx_solutionsuggestion`** (Solution Suggestion): `nx_name` (primary, filled by the server), `nx_solution` (lookup, Delete: Cascade All, Assign/Share: Cascade None), `nx_suggestion` (text area, 1000), `nx_suggestedby` (lookup to `cr6b0_consultant`). The date is `createdon`. No status column: suggestions are a list, not a workflow.
- **Who sends:** anyone who can read a Published, active solution, outside present mode, including its owner, contributors and the librarian (changed 2026-10-13; the first build rejected the owner and showed the button only to non-readers). The author is the signed-in person's consultant record, resolved on the server by email (the same rule as favorites); the client never sends an identity.
- **Who reads:** only the solution's **owner**, its **contributors** (`nx_solutioncontributor.nx_builtby` matches the caller's consultant) and the **PRISMA Librarian**. They see each suggestion's text, author name and date. Nobody else can list them.
- Custom APIs on `Prisma.Plugins.SuggestionApi`: `nx_SuggestChange` (SolutionId, Text) and `nx_GetSolutionSuggestions` (SolutionId, returns `canRead` and the list, each with `addressedOn`); added and deployed 2026-10-14: `nx_AddressSuggestion` (SuggestionId, Addressed: only the solution owner sets or clears `nx_addressedon`; contributors and the librarian only read, narrowed from owner-or-contributor on 2026-10-26) and `nx_GetMyOpenFeedback` (no parameters: the caller's unaddressed suggestions on their active published solutions and their drafts returned with Changes requested, one read for the masthead count). Both use the execute privilege `prvReadnx_Solution`: the caller proves Read on the solution, and the plug-in reads and writes the table as the server. **No role gets privileges on the table**, so nobody can read another person's suggestions directly; the author still owns the row.
- **UI (connected only):** on the published solution page, everyone gets **Suggest an improvement** ("Have an idea to improve this solution? Share your suggestion with the solution team."), a dashed-outline action card at the end of the side column that opens its short form in place (changed 2026-10-14; it was a "Suggest a change" button in the action row); readers also get the **Suggestions** panel in the main column, refreshed after they send one. The same panel shows below the details on the owner's submission page and in the librarian review (2026-10-14), and My submissions has a Suggestions tab listing the cards that have any. Neither renders in present mode; the PoC has no suggestions.

## Consequences

- Builders get feedback from colleagues without reopening the review, and it stays private to the people who can act on it.
- Rollout order: table (done) → signed plug-in (`blob-plugin --execute`) → `suggestion-api --execute` (registers the two APIs; its preview checks the table first) → generate the two clients in `app/connected` → wire `suggestionApi` in `dataSource.ts` → publish the app. Until the clients exist, `suggestionApi` is undefined and the page shows neither the button nor the panel.
- No notification yet: owners see suggestions when they open the solution. Email notification would follow [ADR-0006](adr-0006-power-automate-notifications-only.md).
- Suggestions are not moderated or editable after sending. Deleting a solution deletes its suggestions.
