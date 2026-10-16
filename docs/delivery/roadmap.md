# Roadmap

**Status:** Living; connected pilot published with favorites, Top 10 and Blob media; non-admin acceptance, notifications, seed content and Phase 5 pending; two-stage AI authoring planned, not implemented · **Last updated:** 2026-10-16
**Source:** [End-to-end design §9](../design/end-to-end-design.md#9-delivery-phases)

Phases 2 and 3 justify the project to a CSM; phase 4 keeps it alive. Neither can be dropped.

| Phase | Scope | Proves | Status |
|---|---|---|---|
| **1 — Foundation** | Dataverse schema incl. §6 deltas, security roles, reference data seeded, librarian-only bulk entry of the initial known solutions | G2 is achievable before any CSM sees the app | Tables exist; reference data partially seeded; schema/security gaps open |
| **2 — Discovery** | Card grid, search, facets, connected detail/gallery/viewer | G1 | Published in the pilot with favorites, Top 10 shelf, sort and list view. Since 2026-09-30 the library reads all tags and builder names through one `nx_GetCatalogueGraph` call instead of several requests per solution. Larger-scale and non-admin acceptance pending |
| **3 — Present mode** | Server-restricted eligible catalogue and projection | G3 safety | Published present-mode redaction passed; non-admin permissions and hosted acceptance pending |
| **4 — Contribution** | Draft graph, media, submission and review | G2 at scale | Privileged lifecycle, retirement/restoration, two-tab conflicts and upload recovery passed; new attachments stored in Azure Blob (16 MiB resumable blocks); cross-account/non-admin acceptance unresolved; notifications absent |
| **5 — Handoff** | Demo requests, contributor dashboards, one-pager downloads | G3/G4 | Not started |

## Current state

- **Power Platform solution:** PAC verified `PRISMA_Dev` in **Nextant Pulse**, with controlled APIs, synchronous guards and user-approved pilot role/profile/readers assignments. The disposable published lifecycle fixture was withdrawn and deleted; three original drafts remain and the published catalogue is empty again. See the [inventory and deployed scope](../architecture/technical-architecture.md#deployed-core-draft-backend) and [lifecycle evidence](../workflows/contribution-and-review.md#verified-lifecycle).
- **Look-and-feel PoC** implemented in [`app/`](../../app/README.md) — the visual and interaction reference for phases 2–4. Mock in-memory data shaped like the Dataverse schema.
- **Connected app:** published as the pilot app **PRISMA** in `PRISMA_Dev` ([deployment record](../../app/README.md#connected-prisma-target)). Every write goes through plug-in Custom APIs; new attachments live in the Azure Blob pilot ([ADR-0010](../architecture/decisions/adr-0010-attachments-in-blob-through-plugins.md)). General release still needs non-admin acceptance, seed content, notifications and owners for the open [decisions](decision-log.md).
- **Engineering:** CI runs lint, test type-checks, all unit/UI tests and both builds plus backend tests on every pull request. Dev, pilot and teammates share one environment, so deploys must come from an up-to-date `main` ([R10](risks.md)).

## AI authoring integration

**Plan status:** Scope agreed on 2026-10-16; architecture and pilot defaults proposed. Neither stage is implemented or deployed. Azure AI Foundry access is available, but project, model deployment, permissions, region, quotas and cost have not been verified. This plan does not authorize resource creation, role assignments, schema changes or publication.

This extends Phase 4 contribution without replacing its outstanding acceptance gates. AI proposes edits inside the existing form; users decide what enters the submission. Manual authoring remains available throughout. The [contribution design](../design/end-to-end-design.md#31-contribution--publication) owns the product workflow; this section owns the implementation sequence and release gates.

### Agreed scope and boundaries

| Area | Scope |
|---|---|
| Stage 1 narrative fields | Title/name, summary, what the solution does, business value, anonymous client description, challenges and lessons learned |
| Editing interaction | Inline preview, then Accept or Discard; Undo after acceptance |
| Stage 2 inputs | PDF, Word (`.docx`), PowerPoint (`.pptx`), Markdown and plain text |
| Stage 2 suggestions | Narrative fields plus existing capability, specialization, technologies, industries and maturity when supported by source evidence |
| Client information | Exclude real client identity and the internal `clientContext` field from AI requests; rewrite only the separately authored anonymous description |
| Pilot data | Sanitized/approved material only; no confidential client-document pilot |
| Manual decisions | People, projects, effort, client association/role, safety acknowledgment, review and publication; no automatic reference-data creation |
| App boundary | Connected PRISMA only. Shared controls are optional; no Foundry calls, credentials or real integration in the mock PoC |

Recommended defaults are to preserve the source language, support contributor and authorized librarian editors under existing permissions, and require an explicitly saved record before AI assistance. A new submission must therefore have a valid authored name and pass existing draft-save validation; there is no hidden save or placeholder-record creation. No AI is exposed in the library or present mode. A chatbot, autonomous agent, vector database and fine-tuning are not needed for these two stages.

### Stage 1: Inline rewriting

1. **Verify Foundry readiness and define contracts.** Inventory the approved tenant/subscription, resource/project, region and deployment type, endpoint, deployed model, structured-output support, quota and pricing. Benchmark an available low-latency model on representative sanitized fields before selecting it. Verify managed-identity token audience, least-privilege RBAC and connectivity from the Dataverse sandbox; working Blob access does not prove Foundry access. Establish versioned field allowlists, public/internal classification, context rules and response contracts.
2. **Build a suggestion-only backend.** Add a dedicated rewrite Custom API, provisionally `nx_RewriteSubmissionField`, with solution ID/version, field key, current unsaved text, rewrite mode and request ID. Return validated suggestion text and request binding, not a saved solution. Reuse existing editable-state authorization before inference and recheck access before returning protected content. The endpoint, deployment and prompts are server-controlled; clients cannot supply URLs or arbitrary model configuration. Inference must not run inside Save or Submit operations or mutate solution fields/row versions.
3. **Add inline controls.** Offer Improve wording, Shorten and Fix grammar with original/proposed text, Accept, Discard, retry and Undo. Keep the field editable while inference runs. Use the existing icons, themes, keyboard/focus conventions and accessible status announcements; avoid a separate chat panel or wizard redesign.
4. **Apply through existing editor state.** Accept uses `change()` and the ordinary save path, preserving dirty tracking, recovery, field validation and contributor/librarian safety semantics. Bind requests to editor instance, solution, saved version, field, source text and any supplied context. Typing, saving, navigation, identity changes or newer requests invalidate stale suggestions. Undo must not overwrite subsequent typing. Disable acceptance during saves and uncertain/recovery states. A failed suggestion leaves the original intact and must not mark the draft as an uncertain write.
5. **Evaluate and pilot.** Complete the Stage 1 gates below, then enable for a small authorized group behind a disabled-by-default rewrite flag. Collect content-free quality/usage metrics and keep manual editing available when the service is unavailable.

**Proposed transport:** a bounded REST call from the signed .NET Framework 4.6.2 plug-in to Foundry using managed identity, following the existing external-service pattern. Check runtime compatibility before choosing an SDK. Proposed pilot targets are p95 at or below 10 seconds and a hard inference deadline at or below 20 seconds, with room for transport overhead. These are targets, not measured results. If connectivity or latency fails the gate, revisit an authenticated worker transport rather than extend save transactions.

**Generation safeguards:** reject blank rewrite sources; preserve meaning, language and supplied numbers; do not invent metrics, capabilities or outcomes. Send only the selected text and explicitly permitted context, never the whole draft or internal client identity. Internal reflections must not become implicit context for public-field rewrites. Validate structured output independently against current application/schema limits; reject malformed, refused, truncated or overlength responses. Treat user text as data, disable tools/web access, and render output as text. AI is not a confidentiality classifier or a replacement for librarian review.

**Operational safeguards:** enforce server-side request/token bounds, per-user limits and an environment cost cap, with atomic shared usage tracking where needed. Do not treat static plug-in memory or Azure budget alerts as a hard spending limit. Record request IDs, prompt/model version, timing, token counts and error classes, not prompt/completion text. Retry explicitly and within quota. Browser cancellation discards results but does not guarantee remote computation or billing stopped. Unaccepted suggestions stay out of browser recovery storage.

### Stage 2: Documents to form

1. **Add private document intake.** Place Import from document near the beginning of the form, after safety confirmation and explicit draft saving, rather than requiring navigation through Media. Confirm the source is approved/sanitized before transfer. Use dedicated protected ingestion APIs and a separate private Blob container; reuse chunk/hash/checkpoint patterns without turning source files into `nx_demoasset` records or public attachment purposes. Browsers receive no storage URLs, SAS or credentials.
2. **Create durable processing jobs.** Introduce private Dataverse source/job metadata, provisionally `nx_aiinput` and `nx_aijob`, bound to caller and solution. Track checksum, type/size, status, source version, expiry, attempt count and prompt/schema versions. A proposed timer-triggered Azure Functions worker claims queued jobs through restricted Custom APIs using atomic leases. A narrowly scoped worker application identity may claim/complete jobs, but cannot write solution fields or approve publication. Job mutations remain plug-in-controlled; source, model and extraction access use scoped managed identities.
3. **Extract document content.** Use Azure Document Intelligence v4 Layout for PDF/DOCX/PPTX and bounded text decoding for Markdown/TXT. Preserve PDF page, PPTX slide and heading/paragraph evidence. DOCX service page units are not physical printed pages, so use section/snippet references instead. Office embedded images are not extracted by Layout. Scanned-document OCR and diagram interpretation are not initial acceptance requirements; surface empty/partial extraction rather than silently claim complete coverage.
4. **Map content to field suggestions.** Foundry produces a versioned structured response containing field, proposed value, evidence references and missing/conflicting indicators. Verify references point to actual extracted spans. Missing facts stay empty; conflicts remain visible. Match classifications against authorized active reference lists, with ambiguous/unmatched values requiring manual selection. Do not create taxonomy, infer people/hours or manufacture unsupported claims. Model confidence percentages are not evidence of accuracy; source citations still require human review.
5. **Review and merge.** Show current/proposed values and source snippets beside their page, slide or section references. Support individual acceptance and explicitly selected batches. Default selection may include empty fields only; replacing existing values requires explicit selection. Recheck each field against its captured baseline immediately before apply, flagging intervening edits as conflicts. Reuse Stage 1 controls, `change()` and `changeGraph()`; accepted values enter the normal version-checked save, never an automatic background write.
6. **Recover, cancel and clean up.** Allow continued editing while analysis runs, and authorized job resumption after navigation/reload. Make start/finalize idempotent by caller, solution and request ID. Use bounded retries and expiring leases for worker restarts; after an uncertain start response, query status instead of creating another job. Reauthorize status/results and processing completion. Cancellation, access loss and parent deletion must prevent stale completion from restoring results. Keep source bytes and pending extraction results out of browser recovery and published projections.

Proposed job lifecycle: `Uploading -> Scanning -> Queued -> Extracting -> Mapping -> Ready`, with `Failed`, `Cancelled` and `Expired` terminal states. The initial worker may poll private jobs instead of introducing a separate message queue; polling cadence, throughput and Dataverse request cost must be validated before enabling.

**Pilot limits to confirm:** one source per job, up to 20 MiB and 100 PDF pages/PPTX slides, with a 200,000-character extracted-text ceiling and a deployment-specific token budget. Sequential imports may be supported without silently replacing prior edits. Validate file signatures/MIME as well as extensions, bound decompression, reject encrypted/malformed/macro-enabled inputs, and never execute embedded content or follow links. Quarantine and malware scanning must succeed before parsing; scanner provisioning and cost are prerequisites, not existing media-pilot capabilities. Do not silently truncate sources that exceed limits.

**Proposed retention:** remove source bytes and derived full text after 24 hours, and suggestion results after seven days or explicit discard. Cancellation and draft deletion initiate cleanup immediately. Confirm these defaults with governance before enabling; Blob soft-delete/versioning and provider-side retention must be accounted for separately. Retain only content-free operational audit metadata under an approved policy. Source documents never become published demo attachments merely because users accepted extracted text. Sanitization is a pre-upload requirement, not a promise that AI will anonymize an identified document.

### Implementation anchors

| Existing surface | Planned integration |
|---|---|
| [Shared submission form](../../app/src/components/SubmissionForm.tsx) | Optional controls in `SolutionDetailsFields`, `ClientFields`, `StoryFields` and `LessonsFields`; keep AI buttons outside wrapping field labels or use explicit label/input association |
| [Connected editor](../../app/connected/src/DraftsView.tsx) | `DraftEditor`, request lifetimes, safe acceptance through `change()`/`changeGraph()`, existing `persist()` ordering and save/recovery locks |
| [Connected data source](../../app/connected/src/dataSource.ts) | Typed wrappers around CLI-generated AI Custom API clients; generate only after API registration, never hand-edit generated files |
| [Draft recovery](../../app/connected/src/draftRecovery.ts) | Reuse recovery for accepted unsaved values; exclude raw source files and unaccepted results |
| [Draft authorization](../../backend/Prisma.Plugins/DraftPolicy.cs) and [save API](../../backend/Prisma.Plugins/DraftApi.cs) | Reuse editable-state, row-version and contributor/librarian safety rules; AI has no alternative field-write path |
| [Blob transport](../../backend/Prisma.Plugins/BlobStorage.cs) and [media transfer](../../backend/Prisma.Plugins/MediaTransferApi.cs) | Reuse identity and bounded-transfer patterns, not public attachment ownership or storage-specific token audiences |
| [Deployment utility](../../backend/Prisma.Deploy/Program.cs) | Preview-guarded API/schema/configuration and worker-permission changes |
| [Rendered UI tests](../../app/scripts/ui.test.mjs), [connected draft tests](../../app/connected/src/drafts.test.ts) and [plug-in tests](../../backend/Prisma.Plugins.Tests) | Follow existing test conventions, adding focused AI policy/adapter tests and browser interaction coverage |

New modules should have narrow ownership: shared inline review controls, a connected AI contract/merge adapter, a rewrite API/policy/Foundry client, and Stage 2 import UI, ingestion/job APIs and worker. The existing [product suggestion API](../../backend/Prisma.Plugins/SuggestionApi.cs) is unrelated and should not be repurposed. Choose final module names during implementation; create a supported Azure Functions project and infrastructure templates only when Stage 2 work is authorized.

### Delivery sequence and acceptance

| Work package | Dependencies | Exit gate |
|---|---|---|
| Foundry readiness and contracts | Resource inventory and approved sanitized examples | Endpoint/model/identity verified; field contracts, cost limits and evaluation set agreed |
| Stage 1 backend and inline UI | Contracts; UI can start with isolated fake adapters while backend is built | Suggestion-only calls and safe apply/undo; manual workflow unaffected |
| Stage 1 pilot | Backend/UI complete | Authorization, quality, latency, accessibility and cost gates pass |
| Stage 2 intake and jobs | Stage 1 stabilized; storage, scanning, worker identity and retention approved | Private, bounded uploads and durable, idempotent processing |
| Stage 2 extraction and review | Intake/jobs and result schema; fixtures can be prepared earlier | Evidence-linked suggestions and conflict-safe field/tag application |
| Stage 2 pilot | All Stage 2 gates | Hosted, least-privilege, cleanup and cost acceptance; separate import flag enabled |

**Stage 1 tests:** field/context allowlists, length limits, blank/refused/malformed results, authorization and no solution writes; typing during inference, out-of-order responses, save/navigation/auth changes, accept/discard/undo and preservation of later edits. Evaluate factual preservation and prompt injection across every supported narrative field. Block pilot on invented facts or client-identity leakage in the evaluation set; passing examples is not a guarantee for all future inputs. Measure p50/p95 latency, error rate, token cost and accept/discard rate without logging content.

**Stage 2 tests:** fixtures for every supported format, tables, missing/conflicting evidence, invalid references, unsupported embedded images, encrypted/oversized/malformed files and injected instructions. Verify citations, explicit overwrites, batch conflicts, cross-user/reader denial, duplicate starts, worker restart/lease recovery, cancellation, expiry, parent deletion and cleanup. Prove sources and results cannot enter catalogue, present mode or decks. Measure representative processing cost/time before defining a completion SLA.

**Shared regression gates:** keyboard/focus, desktop/mobile, light/dark, no overflow, save/reopen, contributor and librarian behavior, present-mode unmount and outage/manual fallback. Use real non-admin accounts; administrator success does not prove least privilege. The library search/detail/viewer flow must remain unchanged. Run focused AI tests first, then existing CI gates: from `app/`, `npm test`, `npm run test:connected`, `npm run test:ui`, `npm run typecheck:tests`, `npm run lint`, `npm run build` and `npm run build:connected`; from the root, `dotnet test backend/Prisma.Plugins.Tests` and `dotnet build backend/Prisma.Deploy`. Add worker and infrastructure checks for Stage 2, and presentation-build checks if shared bundling changes.

**Documentation and deployment gates:** before implementation, review the proposed architecture and record lasting choices in an ADR using the next available number. Update the owning architecture/security, schema and contribution workflow docs as contracts become agreed; do not document proposed resources as live. Enablement requires separate approval for infrastructure, schema, role assignments, API registration, client generation and publication in dependency order. Preview `Prisma.Deploy` operations and run infrastructure what-if first. Deploy only from up-to-date `origin/main`, coordinate the shared environment, and distinguish hosted verification from build/upload success. Both feature flags default off and provide rollback without disabling manual submission.

### Open readiness decisions

- Foundry project/resource, deployed model, region/deployment type, data handling, token audience, network access, quota and budget owner are unverified. No live model call, cost measurement or Azure configuration change has been performed for this plan.
- Confirm direct plug-in inference latency before committing to that transport; finalize worker polling cadence, permissions and request volume for Stage 2.
- Approve document limits, scanner, retention/deletion policy and service-side storage behavior before ingesting pilot files.
- Assign delivery owners and pilot reviewers; set release dates only after readiness and the representative evaluation are complete. Existing non-admin acceptance work remains a separate release dependency.

**Service references:** [Document Intelligence v4 Layout](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/layout?view=doc-intel-4.0.0) documents PDF/DOCX/PPTX support and Office embedded-image limitations. [Foundry structured outputs](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/structured-outputs) documents model/API support and JSON Schema restrictions; enforce application limits independently. Availability in documentation does not establish that either service is provisioned in PRISMA's environment.

## Milestone log

| Date | Milestone |
|---|---|
| 2026-09-16 | End-to-end design draft; PoC demonstrating hero flow, submission form, present mode |
| 2026-09-17 | Documentation structure established |
| 2026-09-21 | PAC inventory completed; separate mock/connected app strategy and full read/write first-release gate agreed |
| 2026-09-21 | Separate local connected catalogue UI and SDK adapter added; both builds, lint and 22 tests pass; authenticated Local Play verification pending |
| 2026-09-22 | Core APIs/guards deployed; Local Play create/update/reload/reopen and stale-save recovery verified. Both builds, lint and 40 tests pass; non-admin verification and complete workflow remain release blockers. No app published. |
| 2026-09-22 | Graph/media/review/published-detail APIs deployed; private upload table and empty custodian/readers teams approved. Owner graph/media/submit/withdraw verified; 64 tests. User deferred non-admin tests and will make assignments. Connected publication remains blocked. |
| 2026-09-22 | Connected PRISMA published as a pilot with acceptance gates deferred; hosted CSP additions approved; full hosted workflow passed with a privileged account |
| 2026-09-28 | Specialization-area N:N, client and contributor roles, favorites APIs and "Target client role" filter deployed |
| 2026-09-29 | Azure Blob media pilot deployed and enabled; Top 10 shelf, 16 MiB resumable uploads and faster protected reads published |
| 2026-09-30 | Implementation review: CI, accessibility lint, test type-checks, lazy-loaded contributor screens and the bulk catalogue graph API added; plug-in (with tracing) and API deployed, connected app published |
| 2026-10-16 | Two-stage AI authoring plan recorded: inline narrative rewriting, then private document-to-form suggestions through Azure AI Foundry. Scope agreed; readiness, architecture acceptance, implementation and deployment pending. |
