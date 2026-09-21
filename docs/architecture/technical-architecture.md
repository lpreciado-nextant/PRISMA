# Technical architecture

**Status:** PAC inventory verified; separate connected-app integration planned; full read/write publication gate agreed; backend enforcement pending · **Last updated:** 2026-09-21
**Source:** [End-to-end design §7](../design/end-to-end-design.md#7-technical-architecture)

**Confirmed stack:** Power Platform code app (React + TypeScript) over Dataverse, Microsoft Entra ID SSO, internal Nextant users only, Nextant brand standards.

## Environment and solution

The Power Platform solution **`PRISMA_Dev`** exists in **Nextant Pulse**, environment ID **`ce09ad9b-57d1-e5df-9400-8ce973c86213`** (not Nextant Pulse Prod). In the Power Apps maker portal, select that environment and open **Solutions > PRISMA_Dev**.

This Power Platform solution is distinct from both the published code app **PRISMA PoC** and the catalogue's `nx_solution` records. PAC CLI inspection on 2026-09-21 confirmed unmanaged solution version `1.0.0.1`, solution ID `adddc940-98ff-4b2f-9c8a-e89245c2fc33`, publisher `nx`, customization prefix `nx`, and choice-value prefix `12506`. The Dataverse URL is `https://nextantpulse.crm.dynamics.com/`.

The export includes **PRISMA PoC** (`cr6b0_prismapoc_c440f`, CodeApp type 4); `pac code list` returned only the existing PoC app. Its connection/database references are empty. App IDs, publishing commands and verification status are maintained in the [deployment details](../../app/README.md#poc-deployment). No connected PRISMA app was published during inspection.

### Verified solution inventory

Evidence: `pac solution list`, FetchXML queries through `pac env fetch`, and an unmanaged `pac solution export` inspected as XML. This was read-only exploration; no table, role, relationship or business record was changed. The temporary export includes the PoC package and is not a schema-only artifact to commit.

| Live logical table | Rows visible to inspection caller | UI mapping / integration note |
|---|---:|---|
| `nx_solution` | 0 | Core catalogue; `nx_solutionname`, `nx_onelinesummary`, `nx_whatitdoes`, `nx_businessvalue`, `nx_usecase`; specialization and capability are lookups, not string enums/N:N capability tags |
| `nx_solutioncontributor` | 0 | `nx_builtby` references `cr6b0_consultant`; direct/calendar effort fields; no calendar lookup |
| `nx_solutionimage` | 0 | Gallery image column `nx_imagefile`, caption and sort order |
| `nx_demoasset` | 0 | File column `nx_filemedia`, asset choice, external URL and embedding fields; name column is `nx_demoassetid1` |
| `nx_demorequest` | 1 | Requester references Consultant; do not delete or replace the existing row when seeding |
| `nx_specializationarea` | 3 | Resolve Dataverse IDs to UI area keys explicitly |
| `nx_capability` | 2 | Single capability lookup per Solution |
| `nx_technology` | 8 | Native N:N with Solution |
| `nx_industry` | 4 | Native N:N with Solution |
| `cr6b0_consultant` | Not queried | Reused people directory; fetch only name/email/ID and agreed eligibility fields |
| `cr6b0_project` | Not queried | Reused delivery evidence; native N:N with Solution; preserve existing security and schema |

The export has 11 table definitions; the solution-component query reports 14 Entity components, including relationship infrastructure. Native N:N definitions include `nx_Solution_nx_Technology_nx_Technology`, `nx_Solution_nx_Industry_nx_Industry` and `nx_Solution_cr6b0_Project_cr6b0_Project`. Do not implement the PoC's historical `nx_solutionproject` junction model.

The **PRISMA Librarian** field-security profile grants read/create/update for `nx_publicationstatus`, `nx_clientsafereviewed` and `nx_librarynote`. This is not a table security role or proof of user membership. Review Outcome/Comments are present in the schema but absent from that profile's exported permissions. No security-role, plug-in or Custom API components were found in this solution. The export also carries two existing Project business rules, not PRISMA transition handlers. Environment-wide components and effective permissions require separate verification; absence from this solution is not proof of absence from the environment.

### Live-schema gaps to resolve

- All 11 exported tables are **UserOwned**, including the four reference tables and Consultant. The design's organization-owned assumption is not the deployed model. Prefer explicit organization-level reference Read privileges with controlled writes; do not recreate tables or change existing Consultant/Project security without approval.
- `nx_reviewoutcome` and `nx_reviewcomments` have `IsSecured=0`. Publication status, clearance and Library Notes have `IsSecured=1`. Enable and configure the agreed review-field protection before enabling contributor writes, and verify read access to publication status for catalogue queries.
- `nx_capability` is ApplicationRequired although incomplete drafts permit no capability. Align metadata with conditional submit/approve validation. Solution name is required with maximum length 850, while the app contract is 100. Several live text columns are 4000, and DemoAsset name is `nx_demoassetid1` (850). Apply documented client/server limits deliberately; do not assume generated max lengths equal product limits.
- Publication and maturity choices have no configured default (`AppDefaultValue=-1`); creation must supply the agreed state. Publication values are Published `125060000`, Retired `125060001`, Pending review `125060002`, Draft `125060003`. Maturity values are Live in production `125060000`, Idea / concept `125060001`, Client demo `125060002`, Retired `125060003`, Working prototype `125060004`.
- Child-to-parent relationships currently use `NoCascade` for Assign/Share/Unshare and `RemoveLink` for Delete. A parent lookup does not propagate access or guarantee child cleanup. Define and enforce ownership, sharing/revocation and deletion for every child and file.

Track decisions and required owners in the [decision log](../delivery/decision-log.md). These observations do not authorize changes to shared environment security or destructive table recreation.

## Connected-app integration plan

Keep **PRISMA PoC** as the live UI test app. Create **PRISMA** with a separate configuration and eventual app ID in the same environment. Separate app IDs isolate deployments, not Dataverse security or environments. Never copy the PoC app ID into the new target or add live data sources to the PoC configuration.

**Local foundation completed (2026-09-21):** [app/connected/power.config.json](../../app/connected/power.config.json) is initialized as PRISMA with no app ID and registers all 11 inventoried tables. PAC generated models/services and the schema files they import in this isolated directory. The generated services pass TypeScript validation against the installed SDK, and repository lint passes. The PoC configuration was verified unchanged. There is no connected UI entry point, deployed app, runtime read/write verification or backend transition implementation yet. Generation is not completion of the following milestones; see [setup commands](../../app/README.md#connected-prisma-target).

1. **Isolate the app target.** Reuse the existing React views/design tokens through a shared source boundary. Give the connected target its own Power Apps configuration, generated services, entry point and output. Preserve existing PoC commands and browser storage. Confirm both builds and ensure the connected bundle excludes the mock catalogue and IndexedDB submission adapter.
2. **Generate and verify contracts.** Generate Dataverse models/services from live metadata in the new target. Map real logical names, GUIDs, choice integers, lookup navigation names and native N:N relationships to the UI model. Unknown choices must fail explicitly, not silently use a default. Paginate reads; use explicit column selections; handle permission failures distinctly from empty results. Update the mock-era calendar/project assumptions without copying their persistence model.
3. **Close backend security gaps before writes.** Verify ownership types, effective roles and field permissions. Implement published-row/child sharing and revocation; Dataverse roles do not express a predicate such as 'Published only'. Protect review fields and internal notes while allowing authorized contributors to read their feedback. Confirm a least-privilege librarian identity and a contributor/CSM test identity; builder credit is not record ownership.
4. **Implement controlled writes.** Deliver the synchronous Custom APIs and direct-write/child/media guards specified in [ADR-0008](decisions/adr-0008-controlled-submission-transitions.md). Save incomplete named drafts, submit, return, approve and invalidate approval on material edits. Use caller identity and expected row versions, not browser email keys or client approval flags. Define authorized deletion and child cleanup explicitly. Enforce US holidays for 2020-2035 on the server as well as the client.
5. **Connect the complete UI.** Load catalogue/reference data; hydrate authorized contributors, tags, media and internal delivery context. Connect own submissions and librarian review to authorized services. Stage images/files while Draft; report failed/partial uploads and clean up safely. Replace Data URLs with authenticated downloads/object URLs and revoke them. Keep user HTML sandboxed. No mock fallback, no local-only successful saves, and no assumption that Consultant IDs are systemuser IDs.
6. **Verify and publish only the new app.** Test save/reload from another session, incomplete drafts, media round-trips, submit/return/resubmit/approve, edit withdrawal, permission denials, direct-write bypass attempts, stale-version conflicts, child access and deletion. Verify present-mode server filters and projection, with no transient internal data on mode changes. Test with non-admin identities and approved non-sensitive fixtures. Then build, publish PRISMA, add/verify its solution membership, configure sharing, and run the authenticated hosted smoke test. Full read/write is the chosen first-release gate; do not publish a read-only placeholder.

Reference-data counts do not prove vocabulary completeness. Review the two live capabilities against the submission UI before any seed migration. Do not seed the mock catalogue automatically or modify existing Consultant/Project records. File/image operations and invocation of the controlled APIs through the installed SDK must be proven in Local Play before selecting the final client transport. The current Microsoft SDK documents generated file/image helpers as preview; verify the installed generator rather than assuming those helpers exist.

## System shape

```mermaid
flowchart TB
    subgraph Client["Code app (React + TypeScript)"]
        UI[UI components]
        State[Query cache / filter state]
        Viewer[Asset viewer + present mode]
    end
    subgraph Platform["Power Platform"]
        SDK[Power Apps SDK]
        DV[(Dataverse)]
        FILE[File / Image columns]
    end
    UI --> State --> SDK --> DV
    Viewer --> SDK
    SDK --> FILE
    DV -.notifications.-> Flow[Power Automate: review + demo-request alerts]
    Flow --> Teams[Teams / Outlook]
```

## Key decisions

Each carries an ADR — see [decision records](decisions/README.md).

| Decision | ADR |
|---|---|
| Dataverse is the single source of truth; no separate search index in v1 | [ADR-0001](decisions/adr-0001-dataverse-single-source-of-truth.md) |
| Client-side search over an in-memory published catalogue | [ADR-0002](decisions/adr-0002-client-side-search.md) |
| Hash routing, because a published code app never owns the path segment | [ADR-0003](decisions/adr-0003-hash-routing.md) |
| Assets live in Dataverse File and Image columns — no external blob storage | [ADR-0004](decisions/adr-0004-assets-in-dataverse.md) |
| Present mode is enforced server-side as well as client-side | [ADR-0005](decisions/adr-0005-present-mode-server-side-enforcement.md) |
| Power Automate for notifications only — no business logic in flows | [ADR-0006](decisions/adr-0006-power-automate-notifications-only.md) |
| Contributor-level effort derived from inclusive dates and allocation, excluding observed US federal holidays in code for 2020-2035 without calendar tables | [ADR-0007](decisions/adr-0007-contributor-effort.md) |

## Contributor data

The current [schema](../data_model/SchemaV2.md) contains 11 tables, including the existing, unchanged `cr6b0_project`. `nx_solutioncontributor` carries each builder's dates/allocation and derives Calendar-mode effort from Monday-Friday dates excluding observed US federal holidays calculated in code, with no calendar tables or contributor calendar lookup. The `Solution`↔`cr6b0_project` link is a native N:N relationship — no junction table — connecting reusable offerings to existing delivery evidence without modifying Project columns.

The PoC computes hours in `app/src/lib/effort.ts` from mock rows using its 2026 in-memory US federal holiday calendar. The agreed code-based 2020-2035 policy and removal of calendar IDs are pending app alignment; existing 2026 totals must remain unchanged. Person search is local name/email matching in the submission form, not a live-directory query. Production still requires Dataverse services, child ownership/sharing and validation enforcement; no persistence or deployment is implied by this documentation change.

## Code app constraints

The app stays inside what [code apps support](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/) — see the [app README](../../app/README.md) for the working list. Highlights:

- Single-page app; official `@microsoft/power-apps-vite` plugin; hash routing.
- No `initialize()` (client library v1.0+); only SDK call is `getContext()`.
- No server-side code, SSR, or build-time secrets; relative asset references.
- Nothing sensitive in the bundle — real data comes from Dataverse post-auth.
- Not available in code apps: Power BI `PowerBIIntegration`, SharePoint form integration, Power Platform Git integration.

## Search approach

At expected scale (~40 solutions year one) the published catalogue fits in memory. v1 loads published records once per session and performs search and faceting client-side — instant results, trivial typo-tolerance and multi-field matching, no latency in the hero flow.

**Documented ceiling:** does not scale past a few thousand records. Revisit with Dataverse full-text search or an external index if the catalogue grows an order of magnitude beyond projections. ([ADR-0002](decisions/adr-0002-client-side-search.md))

## Routing map

| Logical route | Hash route (PoC) |
|---|---|
| Home + catalogue (search, tabs, facet rail share the grid) | `#/` |
| Solution detail | `#/s/:id` |
| Full-screen asset viewer | `#/s/:id/demo/:assetId` |
| Guided submission | `#/submit` |
| Present mode | A mode over every route, not a route — keeps its state persistent |
| My submissions / edit | `#/my-submissions` / `#/submit/:id` (browser-local) |
| Review queue / record / asset | `#/review` / `#/review/:id` / `#/review/:id/demo/:assetId` (simulated librarian access) |
| Reference-data admin | Not yet in the PoC |

## Submission transitions

The local app uses IndexedDB and pure transition/validation helpers; it does not enforce production roles or multi-user concurrency. Production save-draft, submit and review commands use Dataverse Custom APIs backed by synchronous plug-ins, with caller/state/version checks and conditional completeness validation. Protected publication/review fields are written by scoped handlers, not directly by contributors. File uploads are staged in Draft before transition validation. See [ADR-0008](decisions/adr-0008-controlled-submission-transitions.md), the [schema contract](../data_model/SchemaV2.md#draft-and-transition-contract) and [security model](security-model.md#controlled-transitions). These services are planned, not deployed; the code app remains a client-only SPA.

## Notifications

Power Automate handles review-queue alerts and demo-request handoffs to Teams/Outlook. No business logic lives in flows.
