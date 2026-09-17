# ADR-0002 — Client-side search over an in-memory catalogue

**Status:** Accepted
**Date:** 2026-09-16

## Context

The hero flow demands instant, forgiving, multi-field search (name, summary, what-it-does, business value, tags, editorial keywords) with live facet counts. Expected scale is ~40 published solutions in year one.

## Decision

Load the published catalogue once per session and perform search and faceting client-side.

## Consequences

- Search is instant; typo-tolerance and multi-field matching are trivial; a whole class of latency problems disappears from the hero flow.
- **Documented ceiling:** does not scale past a few thousand records. Revisit with Dataverse full-text search or an external index if the catalogue grows an order of magnitude beyond projections.
- Present mode must not rely on this cache for safety — the present-mode query re-filters server-side ([ADR-0005](adr-0005-present-mode-server-side-enforcement.md)).
