# Reference data governance

**Status:** Active governance aligned with the two-field story model; approved starter taxonomy seeded in Nextant Pulse; capabilities replaced by the organization framework with area and owner (2026-10-13); client roles became a reference table (2026-10-21); current active references seeded and verified in Nextant Pulse Prod (2026-10-26) · **Last updated:** 2026-10-26
**Source:** [End-to-end design §6.4](../design/end-to-end-design.md#64-reference-data-governance) · Column specs in the [schema spec (v2)](SchemaV2.md)

## Vocabularies

| Vocabulary | Table | Governance | Who adds values |
|---|---|---|---|
| Specialization areas | `nx_specializationarea` | **Governed** | Librarian only |
| Capabilities | `nx_capability` | **Governed** | Librarian only |
| Industries | `nx_industry` | **Governed** | Librarian only |
| Target client roles | `nx_clientrole` | **Governed** | An administrator, in Dataverse. PRISMA roles only read and link them; the app has no screen to add one (PR-031, 2026-10-21) |
| Technologies | `nx_technology` | **Open** | Contributors, inline at submission; librarian periodically merges duplicates |

The problem and benefits belong in the Business Value narrative, not a separate vocabulary ([schema spec (v2)](SchemaV2.md)).

The connected app creates technologies through `nx_TransitionSubmission` action `technology`, not direct client CRUD. Require an owned Draft and exact parent version; trim names, reject empty/control characters and names over 100 characters, and reuse an active case-insensitive match. New rows are caller-owned. The existing graph operation attaches the returned ID. Clear safety acknowledgment and clearance without changing review feedback. Failed or ambiguous writes require reopen. Case-insensitive lookup avoids ordinary duplicate entry; simultaneous creation on different drafts can still race and remains subject to librarian duplicate merges. No new privileges or Consultant/Project writes are required.

Before anything is created, the shared technology field (both apps, [technologyName.ts](../../app/src/lib/technologyName.ts)) checks the name against the loaded list:

- **Duplicates:** matching ignores case, accents, spacing and punctuation, and the same words in another order (`OpenAI on Azure` suggests **Azure OpenAI**) (`PowerBI`, `power bi` and `Power-BI` all match **Power BI**) but keeps `C`, `C#` and `C++` distinct. Known aliases such as Azure DevOps → **ADO** and Microsoft Fabric → **Fabric** also match. A match selects the existing technology instead of creating one.
- **Similar names:** likely typos, singular/plural forms and names containing an existing one (Pyhton → Python, Azure Function → Azure Functions) are offered as one-click selections. They don't block creation.
- **Capitalization:** all-lowercase and all-caps words are corrected (github actions → GitHub Actions, KUBERNETES → Kubernetes, azure database for postgresql → Azure Database for PostgreSQL) using a built-in list of product spellings and the casing of existing labels. Mixed case (`jQuery`, `iOS`) and short acronyms (`AWS`) are kept. The corrected name is shown before adding, and the contributor can choose to keep the name exactly as typed.
- **Rejected:** lists (commas or semicolons), names with no letters, and placeholders such as N/A, None, Other or TBD.

These checks run only in the browser. The plug-in still reuses only case-insensitive exact matches, so the librarian's duplicate merge remains the backstop.

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

**Capability is the broad primary classification. Choose exactly one by the solution's principal purpose**, not every feature or technology it contains. Drafts may leave it empty; submission/publication requires it.

**Changed 2026-10-13:** the six starter capabilities were replaced by the organization's capability framework. Each capability now belongs to a specialization area (`nx_specializationarea`) and can name a **Capability Owner** (`nx_capabilityowner`, a consultant), who owns its definition and is the proposed contact for review ([decision log Q15](../delivery/decision-log.md)). A solution's own areas remain a separate N:N; nothing requires them to include its capability's area.

**Read back 2026-10-23:** 13 active capabilities (none inactive), now including four IBO ones; AI Transformation is gone, two names changed, and every capability has an owner. Listed in `nx_sortordernumber` order.

| Capability | Area | Capability Owner |
|---|---|---|
| Analytics Consulting | data | Lucia Bustillo |
| Governance & Security | data | Gerson Salinas |
| Business Aplications Engineering *(typo in Dataverse)* | ai | Mauricio Cubillos |
| Data Modeling & Architecture | data | Juan Pablo Sarmiento |
| AI-Enabled Data Solutions | data | Antonio Alvarez |
| Data Engineering | data | Jorge Isaias Ardila |
| Process Automation & Integration | ai | Andres Perez |
| AI & Agent Engineering | ai | Shashank Saxena |
| Responsible AI & Platform Governance | ai | Patricia Méndez |
| Program & Project Leadership | ibo | Jessica Wilson |
| Operational Transformation | ibo | Catalina Vasquez |
| Change Management & Adoption | ibo | Mary Thomason |
| AI-Enabled Operations & Governance | ibo | Valentina Velosa |

One-line purposes for each capability are still to be written with their owners; until then, pick the capability whose owner you would ask about the solution. Describe the specific problem and benefit in Business Value.

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

### Production reference seed (2026-10-26)

With explicit user approval, copied the current active dev reference rows to **Nextant Pulse Prod** (`bce2c94a-b2b3-e487-b368-b8d7c931f90b`), not the retired six-capability starter list. Production initially had no rows in these five tables. The one-transaction seed created **84 rows**: 3 specialization areas, 13 capabilities, 17 industries, 37 technologies and 14 client roles. Names, descriptions where present and sort orders were preserved. All 13 capability owners mapped uniquely by normalized email to existing active production Consultants; area lookups were mapped to production reference IDs. No Consultant, Project, solution, submission or media records were copied, and capability ownership did not itself assign anyone a PRISMA role.

[production-reference-seed.ps1](../../tools/production-reference-seed.ps1) guards both organization IDs and the installed managed release. Preview is read-only; execution requires the printed `-ExpectedPlanHash`. It refuses duplicate/inactive name matches, ID collisions, missing/ambiguous owner mappings and differing existing values rather than overwriting them. Only missing reference rows are created, in one Dataverse changeset. Run from the repository root:

```powershell
./tools/production-reference-seed.ps1
# Only for an approved preview, using its exact hash:
./tools/production-reference-seed.ps1 -Execute -ExpectedPlanHash <preview-hash>
```

The initial create-plan hash was `50310F143E0A0A2CDE849AFAE37EE14FCBDDE86F477B77F56BFD3516740DE35C`. Exact value and lookup readback passed; repeated previews proposed zero changes, including after disposable workflow/media acceptance. The script's original multipart response decoding was corrected after an ambiguous client result; readback confirmed the committed rows before any further action, and no create batch was replayed. Production user/team provisioning is recorded in the [security model](../architecture/security-model.md#production-access-2026-10-26).

## Admin surface

`/admin/reference-data` (librarian only) — not yet in the PoC.

## Contributor effort

Contributor effort needs no reference data: each person enters the minimum hours they needed, at every maturity. There are no business-calendar or holiday tables, and since 2026-10-08 no holiday policy in code either. See [schema v2](SchemaV2.md#nx_solutioncontributor--builders-and-effort) and [ADR-0007](../architecture/decisions/adr-0007-contributor-effort.md) for the decision history.
