# Risk register

**Status:** Living; URL persistence repaired, browser delivery/playback and security acceptance remain open · **Last updated:** 2026-09-22
**Source:** [End-to-end design §10](../design/end-to-end-design.md#10-risks)

| # | Risk | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|
| R1 | **Contribution never happens** — builders don't submit, the library stays thin, CSMs stop visiting | Fatal to G2 and G4 | Seed 40 records via librarian bulk entry in Phase 1 before opening submissions. Keep the form under 10 minutes. Make credit visible. Practice leads own a quota. | _TBD_ | Open |
| R2 | **Client data leaks into a client presentation** | Severe, reputational | Upfront acknowledgment; independent librarian client-safe review; server-side filtering; client identity always internal; authored anonymous context | _TBD_ | Open |
| R3 | **Demos break silently** — hosted URLs rot, embeds start failing | Erodes CSM trust, which is unrecoverable | Periodic link-health check; `Allows Embedding` flag; video walkthrough as universal fallback; librarian-driven staleness review | _TBD_ | Open |
| R4 | **Librarian becomes a bottleneck** | Contributions queue up and stall | More than one librarian; SLA on review; auto-approve path for minor edits | _TBD_ | Open |
| R5 | **Stale content presented as current** | Undermines G3 | `Date Added` surfaced on cards; retirement workflow; annual re-confirmation prompt to the contributor | _TBD_ | Open |
| R6 | **Self-contained HTML assets carry active content** | Security exposure via embedded demo files | Sandboxed iframe with restrictive policy; librarian review of uploaded files; no same-origin access to the host app | _TBD_ | Open |
| R7 | **Real application URLs fail storage despite compatible metadata** | Connected Power Apps/BI assets may fail to save | Effective 100-character boundary was confirmed. User-approved metadata 4000 -> 3999 -> 4000 and scoped table publication repaired storage after an unchanged reapply failed. Protected 2000-character and original MyPortal 230-character create/edit/readback passed; no URL shortening. [Repair evidence](../architecture/technical-architecture.md#url-storage-repair). External launch verification is separate. | Platform owner | Closed 2026-09-22; persistence verified |
| R8 | **Browser acceptance cannot prove delivery/playback** | Successful byte reads could be mistaken for usable demos | PDF/PPTX/video round trips are checksum-exact, but integrated browser exposes no download event and fails WebM demuxing even on a direct reference source. Verify downloaded files and playback in a supported external browser. Error/download fallback added; no success claim for delivery. | App owner | Open |

## Process

- Review this register at each phase boundary.
- New risks get a row and an owner; closed risks stay in the table with status *Closed* and a note.
