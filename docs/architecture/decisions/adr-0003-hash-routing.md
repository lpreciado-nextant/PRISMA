# ADR-0003 — Hash routing

**Status:** Accepted
**Date:** 2026-09-16

## Context

A published Power Apps code app is served from `/play/e/{environmentId}/a/{appId}` and never owns the path segment, so path-based routing cannot work.

## Decision

All navigation goes through `window.location.hash`. Logical routes map to hash routes (`#/`, `#/s/:id`, `#/s/:id/demo/:assetId`, `#/submit`). Present mode is a mode over every route rather than a route of its own, which keeps its state persistent across navigation.

## Consequences

- Filter state is encoded in the hash, so filtered views remain bookmarkable and pasteable into Teams.
- No server-side routing concerns; works identically in local dev and published play URLs.
- Deep links carry the full play URL prefix when shared externally to the app.
