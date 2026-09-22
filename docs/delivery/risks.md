# Risk register

**Status:** Living; single-account acceptance exposed URL persistence and browser delivery/playback blockers · **Last updated:** 2026-09-22
**Source:** [End-to-end design §10](../design/end-to-end-design.md#10-risks)

| # | Risk | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|
| R1 | **Contribution never happens** — builders don't submit, the library stays thin, CSMs stop visiting | Fatal to G2 and G4 | Seed 40 records via librarian bulk entry in Phase 1 before opening submissions. Keep the form under 10 minutes. Make credit visible. Practice leads own a quota. | _TBD_ | Open |
| R2 | **Client data leaks into a client presentation** | Severe, reputational | Upfront acknowledgment; independent librarian client-safe review; server-side filtering; client identity always internal; authored anonymous context | _TBD_ | Open |
| R3 | **Demos break silently** — hosted URLs rot, embeds start failing | Erodes CSM trust, which is unrecoverable | Periodic link-health check; `Allows Embedding` flag; video walkthrough as universal fallback; librarian-driven staleness review | _TBD_ | Open |
| R4 | **Librarian becomes a bottleneck** | Contributions queue up and stall | More than one librarian; SLA on review; auto-approve path for minor edits | _TBD_ | Open |
| R5 | **Stale content presented as current** | Undermines G3 | `Date Added` surfaced on cards; retirement workflow; annual re-confirmation prompt to the contributor | _TBD_ | Open |
| R6 | **Self-contained HTML assets carry active content** | Security exposure via embedded demo files | Sandboxed iframe with restrictive policy; librarian review of uploaded files; no same-origin access to the host app | _TBD_ | Open |
| R7 | **Real application URLs fail storage despite compatible metadata** | Connected Power Apps/BI assets may fail to save | The 163-character approved MyPortal URL reproducibly returns Dataverse `0x80090429` on `nx_ExternalURL`; published/editable metadata both report 4000. Diagnose physical/metadata consistency with the platform owner; do not truncate URLs or silently change schema. | Platform owner | Reproduced 2026-09-22; unresolved |
| R8 | **Browser acceptance cannot prove delivery/playback** | Successful byte reads could be mistaken for usable demos | PDF/PPTX/video round trips are checksum-exact, but integrated browser exposes no download event and fails WebM demuxing even on a direct reference source. Verify downloaded files and playback in a supported external browser. Error/download fallback added; no success claim for delivery. | App owner | Open |

## Process

- Review this register at each phase boundary.
- New risks get a row and an owner; closed risks stay in the table with status *Closed* and a note.
