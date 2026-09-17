# Contribution & review workflow

**Status:** Draft for review · **Last updated:** 2026-09-17
**Source:** [End-to-end design §3.1](../design/end-to-end-design.md#31-contribution--publication) · Roles: [Contributor, Librarian](../design/end-to-end-design.md#2-users-and-roles)

## Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: Contributor starts submission
    Draft --> Draft: Save and resume later
    Draft --> PendingReview: Submit
    PendingReview --> Draft: Librarian requests changes
    PendingReview --> Published: Librarian approves
    Published --> Retired: Stale, superseded, or client-sensitive
    Retired --> Published: Refreshed and re-approved
    Published --> PendingReview: Contributor edits a published record
```

Only the **Librarian** can publish — enforced by field-level security, not UI affordance ([security model](../architecture/security-model.md)).

## The submission form

Guided multi-step form with draft saving at every step. **Friction budget: under 10 minutes** — beyond that, builders stop submitting and G2 fails. Steps mirror how a builder thinks about their work, not how the database is shaped:

| Step | Collects | Notes |
|---|---|---|
| 1. What is it? | Name, one-line summary, specialization area, status (idea / prototype / client demo / production / retired) | |
| 2. What does it do and why does it matter? | What It Does, Business Value, client problem it solves | The step CSMs depend on most and builders resent most — gets inline examples and an optional AI-assist to expand terse bullets into prose |
| 3. Tag it | Capabilities, technologies, industries | Type-ahead against existing values. New technologies can be created inline; capabilities and industries cannot ([governance](../data_model/reference-data-governance.md)) |
| 4. Attach the demo | One or more assets | Form adapts to asset type ([demo assets](demo-assets.md)) |
| 5. Images | One card thumbnail (optional — generated poster covers records without one) + captioned detail screenshots (`nx_solutionimage`) | |
| 6. Safety & sharing | Shareable with clients, sample data level, client/context | Asked plainly — getting these wrong is the highest-consequence error in the system. If "Yes, with names removed": fill `Client Context (Redacted)` |
| 7. Review & submit | Preview of exactly how the card and detail page will look | |

On submit the record moves to *Pending review* and the librarian queue is notified (Power Automate → Teams/Outlook). Contributors can see the state of their own submissions at any time (`/my-submissions`).

## Editing a published record

| Change | Effect |
|---|---|
| Material — summary, business value, assets, sharing flags | Returns to *Pending review*; librarian sees a diff of what changed |
| Trivial — typo in library notes | Stays *Published* |

## Review (librarian side)

Detailed steps in the [librarian runbook](../operations/librarian-runbook.md). At review the librarian enforces:

- Every solution has at least one asset a CSM can show **without any setup** (video walkthrough as universal fallback).
- Shareability and sample-data flags are credible for the content.
- Uploaded HTML files are reviewed before publication (sandboxing is defence in depth, not a substitute).
- Entry quality — no half-finished entries or internal snark reach a client screen.
