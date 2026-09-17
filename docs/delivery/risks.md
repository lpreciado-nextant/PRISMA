# Risk register

**Status:** Living · **Last updated:** 2026-09-17
**Source:** [End-to-end design §10](../design/end-to-end-design.md#10-risks)

| # | Risk | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|
| R1 | **Contribution never happens** — builders don't submit, the library stays thin, CSMs stop visiting | Fatal to G2 and G4 | Seed 40 records via librarian bulk entry in Phase 1 before opening submissions. Keep the form under 10 minutes. Make credit visible. Practice leads own a quota. | _TBD_ | Open |
| R2 | **Client data leaks into a client presentation** | Severe, reputational | Mandatory shareability and sample-data questions at submission; librarian review gate; server-side filtering in present mode; explicit redacted-context field | _TBD_ | Open |
| R3 | **Demos break silently** — hosted URLs rot, embeds start failing | Erodes CSM trust, which is unrecoverable | Periodic link-health check; `Allows Embedding` flag; video walkthrough as universal fallback; librarian-driven staleness review | _TBD_ | Open |
| R4 | **Librarian becomes a bottleneck** | Contributions queue up and stall | More than one librarian; SLA on review; auto-approve path for minor edits | _TBD_ | Open |
| R5 | **Stale content presented as current** | Undermines G3 | `Date Added` surfaced on cards; retirement workflow; annual re-confirmation prompt to the contributor | _TBD_ | Open |
| R6 | **Self-contained HTML assets carry active content** | Security exposure via embedded demo files | Sandboxed iframe with restrictive policy; librarian review of uploaded files; no same-origin access to the host app | _TBD_ | Open |

## Process

- Review this register at each phase boundary.
- New risks get a row and an owner; closed risks stay in the table with status *Closed* and a note.
