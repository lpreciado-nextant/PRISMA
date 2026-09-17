# ADR-0001 — Dataverse as the single source of truth

**Status:** Accepted
**Date:** 2026-09-16

## Context

The library needs storage for solution records, tags, assets, and demo requests, plus row-level security by role. Introducing a separate database or search index would add infrastructure to provision, sync, and secure.

## Decision

Dataverse is the single source of truth. No separate search index, no external database in v1. Security, ownership, and publication state are modeled as Dataverse constructs (roles, ownership, field-level security).

## Consequences

- One system to secure; platform-level enforcement of visibility (unpublished records invisible to CSMs at the source).
- Native N:N relationships replace hand-built junction tables for tagging.
- Search must work within Dataverse's query capabilities or move client-side (see [ADR-0002](adr-0002-client-side-search.md)).
