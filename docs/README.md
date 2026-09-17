# PRISMA documentation

Documentation map for the PRISMA — Nextant Solution Library project. The [end-to-end design](design/end-to-end-design.md) is the overview; each aspect below has a dedicated living document.

## Map

| Area | Document | What it owns |
|---|---|---|
| **Design** | [End-to-end design](design/end-to-end-design.md) | The overall product design — purpose, users, workflows, principles. Source of truth for scope. |
| | [Design system](design/design-system.md) | Palette, typography, liquid-glass surface language, motion, theming |
| | [Accessibility](design/accessibility.md) | WCAG 2.1 AA commitments and verification checklist |
| **Architecture** | [Technical architecture](architecture/technical-architecture.md) | Stack, system shape, integration points, search approach |
| | [Security model](architecture/security-model.md) | Roles, table privileges, field-level security, present-mode enforcement |
| | [Decision records](architecture/decisions/README.md) | ADRs — why key technical choices were made |
| **Data model** | [Dataverse schema spec](data_model/nextant-solution-library-dataverse-schema.md) | Column-by-column table specs, relationships, choices |
| | [Reference data governance](data_model/reference-data-governance.md) | Governed vs open vocabularies, seeding, merge process |
| **Workflows** | [Contribution & review](workflows/contribution-and-review.md) | Submission form, draft/review/publish lifecycle, edit rules |
| | [Discovery & presentation](workflows/discovery-and-presentation.md) | The CSM hero flow — search, facets, browse, detail |
| | [Demo assets](workflows/demo-assets.md) | Asset types, viewer behaviour, fallbacks |
| | [Present mode](workflows/present-mode.md) | Client-safe restriction, redaction, visual treatment |
| | [Demo requests](workflows/demo-requests.md) | Live-demo handoff from CSM to builder |
| **Delivery** | [Roadmap](delivery/roadmap.md) | Phases 1–5, current status |
| | [Success metrics](delivery/success-metrics.md) | Goal-mapped metrics and targets |
| | [Risks](delivery/risks.md) | Risk register with mitigations |
| | [Decision log](delivery/decision-log.md) | Open questions and their resolutions |
| **Operations** | [Librarian runbook](operations/librarian-runbook.md) | Review queue, publication gate, retirement, reference-data upkeep |
| | [Content health](operations/content-health.md) | Link checks, staleness review, re-confirmation cycle |
| **Implementation** | [Code app PoC](../app/README.md) | The look-and-feel proof of concept — current visual reference |

## Conventions

- Every document carries a **Status** line (Draft / In review / Approved / Living) and a **Last updated** date.
- Design decisions with lasting consequences get an ADR in [architecture/decisions](architecture/decisions/README.md); the decision log tracks open questions until they resolve into an ADR or a doc change.
- The [end-to-end design](design/end-to-end-design.md) links out rather than duplicating detail. If a section here and the design doc disagree, fix the design doc first.
