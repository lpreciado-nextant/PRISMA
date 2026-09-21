# ADR-0005 — Present mode enforced server-side

**Status:** Accepted, amended for safety acknowledgment and client-safe review
**Date:** 2026-09-16
**Last updated:** 2026-09-21

## Context

Present mode restricts the catalogue to independently reviewed client-safe work while a client is watching. The submission acknowledgment replaces sharing/sample-data classifications, but cannot grant review approval. A purely client-side filter is not a production security boundary.

## Decision

Present mode is enforced server-side as well as client-side. Require Published, Safety Acknowledged and Client Safe Reviewed in the Dataverse query. Client Safe Reviewed is librarian-controlled and cleared on material edits. Always exclude internal client/context, project names and library notes from the client-visible projection; the anonymous context is separately authored.

## Consequences

- A client-visible list can never contain an internal-only record, even transiently.
- Redaction uses a dedicated `Client Context (Redacted)` field rather than runtime string-scrubbing, which is not trustworthy.
- The PoC mirrors this by filtering the source list before render — the client-side analogue of the server-side filter the real app issues.
