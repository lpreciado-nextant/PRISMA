# Reference data governance

**Status:** Active governance aligned with the two-field story model; approved starter taxonomy seeded in Nextant Pulse · **Last updated:** 2026-09-23
**Source:** [End-to-end design §6.4](../design/end-to-end-design.md#64-reference-data-governance) · Column specs in the [schema spec (v2)](SchemaV2.md)

## Vocabularies

| Vocabulary | Table | Governance | Who adds values |
|---|---|---|---|
| Specialization areas | `nx_specializationarea` | **Governed** | Librarian only |
| Capabilities | `nx_capability` | **Governed** | Librarian only |
| Industries | `nx_industry` | **Governed** | Librarian only |
| Technologies | `nx_technology` | **Open** | Contributors, inline at submission; librarian periodically merges duplicates |

The problem and benefits belong in the Business Value narrative, not a separate vocabulary ([schema spec (v2)](SchemaV2.md)).

The connected app creates technologies through `nx_TransitionSubmission` action `technology`, not direct client CRUD. Require an owned Draft and exact parent version; trim names, reject empty/control characters and names over 100 characters, and reuse an active case-insensitive match. New rows are caller-owned. The existing graph operation attaches the returned ID. Clear safety acknowledgment and clearance without changing review feedback. Failed or ambiguous writes require reopen. Case-insensitive lookup avoids ordinary duplicate entry; simultaneous creation on different drafts can still race and remains subject to librarian duplicate merges. No new privileges or Consultant/Project writes are required.

## Why governed vocabularies

- CSMs filter by these constantly — a fragmented vocabulary breaks faceting and live counts.
- Industry is modeled as a table (not a multi-select Choice) because multi-select picklists can't be filtered efficiently and can't carry sort order.
- Capability is a single-valued lookup rather than a tag: one Capability per Solution. Specialization Area is a native N:N tag since 2026-09-23, so a Solution can carry several. Both stay governed.

## Why technologies stay open

The technology list grows organically per solution ("React", "Dataverse", "Power Apps code app"). Over-governing it would add submission friction (against the 10-minute budget) for little quality gain. Cost: periodic duplicate merges by the librarian ([runbook](../operations/librarian-runbook.md)).

## Seeding

Reference data is seeded in Phase 1, before any CSM sees the app ([roadmap](../delivery/roadmap.md)). Sort order columns control tab, chip, and facet ordering.

### Approved starter taxonomy

Seeded in **Nextant Pulse** on 2026-09-22 after user approval: 43 additions, bringing the tables to **6 capabilities, 17 industries, and 34 technologies**. Existing names, IDs, owners, sort orders and associations were preserved. No solutions were reclassified; no schema, permissions or app deployment changed. All approved names were read back as active and unique; a repeated preview proposed zero additions.

**Capability is the broad primary classification. Choose exactly one by the solution's principal purpose**, not every feature or technology it contains. Drafts may leave it empty; submission/publication requires it. These are independent of specialization areas, not a new parent-child taxonomy.

| Capability | Primary purpose |
|---|---|
| AI & agents | An assistant, agent or AI service is the main deliverable |
| Planning & analytics | Reporting, forecasting, planning or decision support |
| Workflow & approvals | Process execution, task routing, approvals or operational automation |
| Data platform | Data ingestion, integration, storage, transformation or governance |
| Knowledge & search | Finding, organizing or retrieving documents and knowledge |
| Digital applications & experiences | A portal, business application or user-facing experience not primarily covered above |

An approvals application that uses AI is normally **Workflow & approvals**; a document-search solution with an AI-generated answer is normally **Knowledge & search**. Use **AI & agents** when the assistant or agent itself is the principal deliverable. Describe the specific problem and benefit in Business Value.

**Industries describe who the solution serves; multiple selections are allowed.** Use Cross-industry for genuinely industry-agnostic solutions instead of tagging every sector. Starter values: Financial services; IT; Manufacturing; Public sector; Cross-industry; Professional services; Healthcare; Life sciences; Retail & consumer goods; Energy & utilities; Telecommunications; Transportation & logistics; Education; Media & entertainment; Real estate & construction; Travel & hospitality; Nonprofit.

**Technologies describe what the solution actually uses; multiple selections are allowed.** Starter values: Copilot Studio; ADO; Microsoft Foundry; Power BI; Power Automate; Fabric; AWS; Power Apps; Dataverse; Power Apps code app; SharePoint; Microsoft Teams; Dynamics 365; Azure OpenAI; Azure AI Search; Azure Functions; Azure App Service; Azure Logic Apps; Azure Data Factory; Azure SQL; Azure Storage; Microsoft Graph; SQL Server; PostgreSQL; Snowflake; Databricks; Python; .NET; React; TypeScript; Node.js; LangChain; Semantic Kernel; Docker.

Keep existing labels **ADO** and **Fabric** rather than adding Azure DevOps and Microsoft Fabric as duplicate aliases. New technology creation remains open under the controls above; this starter list is not an exhaustive supported-stack inventory.

The guarded command in [Prisma.Deploy](../../backend/Prisma.Deploy/Program.cs) defaults to read-only preview and verifies the Nextant Pulse organization. Run from the repository root:

```powershell
dotnet build backend/Prisma.Deploy/Prisma.Deploy.csproj
dotnet backend/Prisma.Deploy/bin/Debug/net10.0/Prisma.Deploy.dll seed-reference-data
# Only after approval of the previewed taxonomy:
dotnet backend/Prisma.Deploy/bin/Debug/net10.0/Prisma.Deploy.dll seed-reference-data --execute
```

The seed pages through existing rows, matches trimmed names case-insensitively, refuses duplicate/inactive matches, and creates only missing values in one transaction. It never renames, reactivates, deletes or merges existing records. New capabilities and industries receive sort orders; the current connected submission pickers sort alphabetically. Verification checks approved names and preservation of existing row fields. This is a sequentially repeatable administrative seed, not a database uniqueness constraint; avoid concurrent reference maintenance during execution.

## Admin surface

`/admin/reference-data` (librarian only) — not yet in the PoC.

## Business days

There are no business-calendar or holiday reference tables and no Librarian-maintained calendar records. `Business Days` on `nx_solutioncontributor` counts Monday-Friday between Start Date and End Date, inclusive, excluding observed US federal holidays calculated in code for 2020-2035; working days are eight hours. Policy changes require a reviewed code change and regression checks, not reference-data editing. Existing 2026 effort totals must remain unchanged when the app adopts multi-year coverage. See [schema v2](SchemaV2.md#nx_solutioncontributor--builders-and-effort) for holiday rules and coverage validation, and [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md) for the decision history.
