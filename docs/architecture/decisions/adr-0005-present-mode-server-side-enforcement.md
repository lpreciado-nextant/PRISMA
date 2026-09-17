# ADR-0005 — Present mode enforced server-side

**Status:** Accepted
**Date:** 2026-09-16

## Context

Present mode restricts the catalogue to solutions flagged *Shareable with clients* while a client is watching. A purely client-side filter could transiently expose an internal-only record (render flash, cache staleness, a bug) — and "never embarrass a CSM in front of a client" is a core principle.

## Decision

Present mode is enforced server-side as well as client-side: the query issued while present mode is active filters on shareability at the Dataverse level.

## Consequences

- A client-visible list can never contain an internal-only record, even transiently.
- Redaction uses a dedicated `Client Context (Redacted)` field rather than runtime string-scrubbing, which is not trustworthy.
- The PoC mirrors this by filtering the source list before render — the client-side analogue of the server-side filter the real app issues.
