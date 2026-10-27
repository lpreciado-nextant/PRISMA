# PRISMA documentation

**Status:** Living; connected dev and managed production PRISMA are deployed, with isolated containers/identities on the existing Blob account. Production promotion has a repeatable runbook; the private-endpoint foundation remains undeployed. Two-stage AI authoring is planned, not implemented · **Last updated:** 2026-10-27

Documentation map for the PRISMA — Nextant Solution Library project. The [end-to-end design](design/end-to-end-design.md) is the overview; each aspect below has a dedicated living document.

**Environments and solutions:** develop in **Nextant Pulse** (`ce09ad9b-57d1-e5df-9400-8ce973c86213`); promote the connected-only `PRISMA_Release` solution to **Nextant Pulse Prod** (`bce2c94a-b2b3-e487-b368-b8d7c931f90b`). The [production deployment runbook](architecture/technical-architecture.md#production-deployment-runbook) owns app/solution/organization/storage IDs, commands and safeguards. Do not import the broader `PRISMA_Dev` solution or confuse these targets with the separate [PRISMA PoC deployment](../app/README.md#poc-deployment).

## Map

| Area | Document | What it owns |
|---|---|---|
| **Design** | [End-to-end design](design/end-to-end-design.md) | The overall product design — purpose, users, workflows, principles. Source of truth for scope. |
| | [Design system](design/design-system.md) | Palette, typography, liquid-glass surface language, motion, theming |
| | [Accessibility](design/accessibility.md) | WCAG 2.1 AA commitments and verification checklist |
| **Architecture** | [Technical architecture](architecture/technical-architecture.md) | Stack, system shape, integration points, search approach |
| | [Production deployment runbook](architecture/technical-architecture.md#production-deployment-runbook) | Exact dev/prod identities; source publication, managed export/import, settings, backup, verification and rollback gates |
| | [Azure Blob Storage transition plan](architecture/technical-architecture.md#azure-blob-storage-transition-plan) | Draft migration scope, security decisions, phased gates and rollback; not deployment authorization |
| | [Infrastructure template runbook](architecture/technical-architecture.md#infrastructure-template-runbook) | Private-storage Bicep foundation, required IT inputs, local checks and undeployed cloud acceptance gates |
| | [Security model](architecture/security-model.md) | Roles, table privileges, field-level security, present-mode enforcement |
| | [Decision records](architecture/decisions/README.md) | ADRs — why key technical choices were made |
| **Data model** | [Dataverse schema spec (v2)](data_model/SchemaV2.md) | Authoritative table specs with live logical names and types, relationships, contributor effort (minimum hours) and validation |
| | [Legacy schema companion](data_model/nextant-solution-library-dataverse-schema.md) | Original v1 entry point synchronized to the current model; v2 remains authoritative |
| | [Reference data governance](data_model/reference-data-governance.md) | Governed vs open vocabularies, seeding, merge process |
| **Workflows** | [Contribution & review](workflows/contribution-and-review.md) | Submission form, draft/review/publish lifecycle, edit rules |
| | [Discovery & presentation](workflows/discovery-and-presentation.md) | The CSM hero flow — search, facets, browse, detail |
| | [Demo assets](workflows/demo-assets.md) | Asset types, viewer behaviour, fallbacks |
| | [Present mode](workflows/present-mode.md) | Client-safe restriction, redaction, visual treatment |
| | [Demo requests](workflows/demo-requests.md) | Live-demo handoff from CSM to builder |
| **Delivery** | [Roadmap](delivery/roadmap.md) | Phases 1–5, current status |
| | [AI authoring integration plan](delivery/roadmap.md#ai-authoring-integration) | Inline narrative rewrites, then private document-to-form suggestions; agreed scope, proposed architecture, dependencies and acceptance gates; not implemented |
| | [Success metrics](delivery/success-metrics.md) | Goal-mapped metrics and targets |
| | [Risks](delivery/risks.md) | Risk register with mitigations |
| | [Decision log](delivery/decision-log.md) | Open questions and their resolutions |
| | [Change log by meeting](delivery/change-log.md) | Per-meeting feedback and proposed changes, tracked from proposal to live |
| **Operations** | [Librarian runbook](operations/librarian-runbook.md) | Review queue, publication gate, retirement, reference-data upkeep |
| | [Content health](operations/content-health.md) | Link checks, staleness review, re-confirmation cycle |
| **Implementation** | [Code app PoC](../app/README.md) | The look-and-feel proof of concept — current visual reference |
| | [Offline migration dry runs](../app/README.md#offline-migration-dry-runs) | Evidence manifests, independent snapshot verification, immutable checkpoints/resume and rollback reports; no live copy or reference changes |

## Conventions

- Every document carries a **Status** line (Draft / In review / Approved / Living) and a **Last updated** date.
- Design decisions with lasting consequences get an ADR in [architecture/decisions](architecture/decisions/README.md); the decision log tracks open questions until they resolve into an ADR or a doc change.
- The [end-to-end design](design/end-to-end-design.md) links out rather than duplicating detail. If a section here and the design doc disagree, fix the design doc first.
