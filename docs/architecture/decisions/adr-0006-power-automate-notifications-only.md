# ADR-0006 — Power Automate for notifications only

**Status:** Accepted
**Date:** 2026-09-16

## Context

The system needs review-queue alerts and demo-request handoffs delivered to Teams/Outlook. Flows are convenient, but business logic spread across flows becomes invisible, untestable, and hard to version.

## Decision

Power Automate is used for notifications only. No business logic lives in flows — state transitions, validation, and visibility rules live in the app and the Dataverse security model.

## Consequences

- The contribution lifecycle and present-mode rules remain testable and reviewable in one codebase.
- Flows stay trivial: trigger on Dataverse change, post a message. Losing a flow degrades notification delivery, never data integrity.
