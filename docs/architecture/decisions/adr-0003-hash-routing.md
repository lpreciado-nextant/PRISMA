# ADR-0003 — Hash routing

**Status:** Accepted; amended 2026-09-30 for player deep links
**Date:** 2026-09-16
**Last updated:** 2026-09-30

## Context

A published Power Apps code app is served from `/play/e/{environmentId}/a/{appId}` and never owns the path segment, so path-based routing cannot work.

The player also runs the app inside a frame. The browser address bar shows only the player URL, never the app's hash, and reloading the player returns the app to the library. A hash route therefore cannot be copied from the address bar or pasted into one.

## Decision

All navigation goes through `window.location.hash`. Logical routes map to hash routes (`#/`, `#/s/:id`, `#/s/:id/demo/:assetId`, `#/submit`). Present mode is a mode over every route rather than a route of its own, which keeps its state persistent across navigation.

Links from outside the app use the supported query-parameter channel. The connected app reads `route` from `getContext().app.queryParams` once at launch (for example `…/app/{appId}?tenantId=…&route=/s/{id}`). If the person has not navigated yet, it replaces the library hash with that route. Only known PRISMA routes are accepted: GUID identifiers, library filters rebuilt through the search parser, and nothing else. A link can never switch present mode on or off. Present mode still redirects internal routes, and the Custom APIs still decide access. The published detail page offers **Copy link**, which builds the link from the host's `appUrl` (or the published player address when the host omits it) and drops `sourcetime`. If the player frame refuses clipboard access, the link is shown in a selectable field.

## Consequences

- No server-side routing concerns; works identically in local dev and published play URLs.
- Filter state is encoded in the hash. It survives in-app navigation, but in the published app a filtered view is shared through a `route` link, not the address bar.
- Deep links are ordinary play URLs, so sign-in, sharing and licensing apply unchanged; a link to something the person cannot read shows the usual unavailable state.
- Hosted pass-through of custom query parameters and host clipboard permissions must be verified after each publication that changes this path. Both passed at the 2026-09-30 publication ([record](../../../app/README.md#deep-links-and-copy-link-2026-09-30)).
