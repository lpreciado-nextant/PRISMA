# ADR-0010 — Uploaded attachments in Azure Blob through Dataverse plug-ins

**Status:** Accepted for the pilot; code and templates implemented and tested locally; nothing deployed. Supersedes [ADR-0004](adr-0004-assets-in-dataverse.md) for newly uploaded videos, HTML, PDF and PowerPoint files only.
**Date:** 2026-09-29
**Last updated:** 2026-09-29

## Context

Large videos consume Dataverse file capacity. The user decided on 2026-09-29 to move newly uploaded attachment bytes to Azure Blob Storage in the **Microsoft Azure Sponsorship (Laboratorios)** subscription, using only first-party Azure products that the sponsorship credits cover (credits exclude Marketplace/third-party products, support plans and separately sold products). The published code app may only connect to its own origin, so browser-to-Azure transport would require an environment-wide CSP change and a separate sign-in path.

## Decision

- **Transport:** the existing Custom APIs remain the only client contract. The media plug-ins read and write Blob Storage themselves using **Power Platform managed identity** (version 2) for the `Prisma.Plugins` assembly: a user-assigned identity with a federated credential for Nextant Pulse, and Storage Blob Data Contributor on one private container only. No keys, SAS, tokens or storage URLs reach the browser. No CSP, CORS or new hosted compute changes.
- **Scope:** new uploads of MP4/WebM, HTML, PDF, PPT and PPTX go to Blob when `nx_MediaBlobUploads` is `yes`. Images, thumbnails and linked assets stay in Dataverse. **Existing Dataverse files stay in Dataverse permanently**, so both readers are permanent.
- **Network:** the storage account keeps a public endpoint because Dataverse plug-ins egress from shared platform addresses, but accepts Entra authorization only (Shared Key, anonymous access and cross-tenant replication disabled). Private networking would require a Managed Environment and Power Platform VNet support and was not chosen.
- **Records:** the storage marker, server-generated blob name, committed ETag and incremental hash state live on private `nx_uploadsession`, which no application role can read. `nx_demoasset` and the client contract gain no storage reference; media snapshots expose only `storage: "blob"`.
- **Integrity:** each block is hashed as it arrives with a serializable SHA-256 state. Finalization compares the digest with the declared resumable digest, commits the block list only if the blob does not already exist, and verifies committed size. Reads are pinned to the committed ETag.
- **Deletion:** removing a session never deletes bytes inside the Dataverse transaction. An asynchronous post-delete step deletes the blob after commit, conditional on its ETag. Soft delete retains deleted blobs for the configured period.
- **Malware scanning:** not included. Files are labelled integrity-verified but not malware-scanned; librarian review is unchanged.
- **Rollback:** setting `nx_MediaBlobUploads` to `no` returns new uploads to Dataverse; Blob-backed files stay readable through the same APIs.

## Consequences

- Every byte still passes through Dataverse Custom APIs, so upload and playback speed are unchanged or slower; the benefit is Dataverse capacity. Claims require measurement.
- The plug-in assembly must be Authenticode-signed for managed identity. Self-signed certificates are for development/test only; a trusted signing certificate is required before general release.
- Blob and Dataverse do not share a transaction. A rolled-back finalization can leave a committed blob that a retry adopts only when its size matches; a failed asynchronous deletion leaves an orphan for reconciliation.
- The sponsorship has a credit cap and end date and converts to Pay-As-You-Go. Infrastructure is repeatable Bicep so storage can move to another subscription by redeploying and copying.
- Setup, deployment order and verification are in the [technical architecture](../technical-architecture.md#blob-storage-pilot-through-plug-ins).
