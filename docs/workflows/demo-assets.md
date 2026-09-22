# Demo assets

**Status:** Connected files/links passed privileged review/publication/withdrawal; external-launch and effective non-admin acceptance pending · **Last updated:** 2026-09-22
**Source:** [End-to-end design §3.3](../design/end-to-end-design.md#33-demo-assets)

Asset handling is type-dependent. **The CSM should never have to guess what will happen when they click.**

Connected submissions use a single Media step for **images, videos, one-pagers/slides, self-contained HTML, hosted URLs, Power Apps, Power BI, and desktop demo arrangements**. Require one to six detail images; thumbnail is optional. Files and linked assets share a maximum of six attachments. The local PoC keeps its file-only submission controls and legacy seeded catalogue. Actual access/demo-request delivery is not implemented.

## Behaviour by type

| Asset type | In-app behaviour | Fallback |
|---|---|---|
| Self-contained HTML file | Render in the full-screen viewer directly from the Dataverse File column | Download the file |
| Hosted web app (URL) | Embed in the viewer if `Allows Embedding`; otherwise open in a new tab immediately | Pop-out, with the `Embed Hint` shown |
| Power Apps / Power BI | Deep-link out in a new tab (embedding is unreliable and auth-stalls inside frames) | Video walkthrough if one exists |
| Video walkthrough | Play inline in the viewer | Download |
| Desktop app or script | Not runnable in-app; show saved demo arrangements and state that no request was sent | Contact the builder; optional video |
| Client-ready one-pager / slide | Download | — |

## Rules

- **New submissions require at least one detail image.** Images alone are sufficient; a thumbnail alone is not. Review the complete visual story and confidentiality before publication.
- Uploaded assets live in Dataverse File/Image columns ([ADR-0004](../architecture/decisions/adr-0004-assets-in-dataverse.md)).
- Self-contained HTML renders in a **sandboxed iframe** with a restrictive policy and no same-origin access to the host app; files are librarian-reviewed before publication ([security model](../architecture/security-model.md)).
- Hosted URLs are subject to the periodic link-health check ([content health](../operations/content-health.md)).

In the PoC, PNG/JPG/WebP images are decoded locally (5 MB each). Optional attachments are limited to six files: MP4/WebM videos up to 500 MB each, and HTML or PDF/PPT/PPTX documents up to 25 MB each. Uploaded HTML uses a restrictive CSP and sandbox without same-origin access; network resources are blocked. Explicitly saving a draft or submitting persists media in browser-local IndexedDB; unsaved media and standalone walkthrough media remain memory-only. Browser quota, eviction or clearing site data can remove or prevent local persistence; failed saves keep the editor open. Videos are read as data URLs, so large files require additional browser memory; the size limit is not a storage-quota or playback-performance guarantee. These local limits do not configure Dataverse column limits.

## Connected media

The unpublished connected app uses generated mediated upload APIs, not direct SDK upload helpers. Files are read in 512 KiB slices; protocol state and continuation tokens stay in private `nx_uploadsession`. Every mutation checks caller-owned Draft state and the current version. Unfinished uploads expire after two hours; reopen and explicitly remove them before restarting. A failed/ambiguous response disables retries until reopen. See [ADR-0009](../architecture/decisions/adr-0009-mediated-media-and-publication-access.md).

One to six gallery images are required at submission; up to six files/linked assets are optional. Image limit is 5 MB (and 40 megapixels for client decoding); WebP is converted to PNG within that limit. Document/HTML limit is 25 MB, video 500 MB, additionally capped by the actual Dataverse column limit. Large-video acceptance is unverified. A dedicated thumbnail is supported; pending screenshot captions save through the main Save draft/Continue flow. No reorder UI exists. Native parent Solution images are not trusted publication inputs.

Choose a linked format to add an asset name, URL and optional access note; hosted web apps can opt into embedding. Power Apps/BI cannot. Desktop/script entries instead require demo arrangements, with no URL or executable. Add/Save asset uses the version-checked `asset` transition on a caller-owned Draft. Unsaved asset text blocks leaving the step until saved or canceled. Edit and removal use the same protected lifecycle as files; the backend rejects unsafe URLs, unknown fields, wrong owners/states and stale versions. URLs must be HTTPS without credentials, and both URLs and notes must be free of secrets and client identifiers. Existing application authorization still applies; a PRISMA link does not grant access to its destination.

Hosted previews use an opaque sandbox (`allow-scripts allow-forms allow-popups`, no same-origin) and a pop-out fallback. Embedding is subject to the destination's CSP, framing policy and authentication requirements. Power Apps/BI open externally with `noopener,noreferrer`. Desktop arrangements are informational, not request delivery.

HTML and PNG upload/download/removal passed live; browser HTML sandbox blocks host-document access and network capabilities, and full-size image download preserves 640x360 rather than the native thumbnail. Native SDK reads enforce caller access. Object URLs are revoked on unmount. The [privileged lifecycle test](contribution-and-review.md#verified-lifecycle) passed publication, published detail/HTML viewer and withdrawal of uploaded and linked assets. Submit/approve validate link fields without file download, while uploaded assets retain byte-size verification. Reader-team share masks on all test media changed from Read to zero on withdrawal. Effective non-admin access and revocation denial remain unverified. Original PoC behavior and limits above are unchanged.

Linked-asset live checks on 2026-09-22 covered all four types, hosted edit, reopen, sandbox preview, desktop guidance, server unsafe/stale rejection, removal and cleanup. External-link attributes were checked; the integrated browser did not expose a popup event, so actual signed-in Power Apps/BI launch is still an acceptance item. Linked publication/revocation and non-admin reads remain unverified.

## Viewer routes

Full-screen viewer at `#/s/:id/demo/:assetId` — PoC implementation in [`app/src/views/ViewerView.tsx`](../../app/src/views/ViewerView.tsx). In present mode the viewer is full-bleed with minimal chrome.

Librarian previews use `#/review/:id/demo/:assetId`, with the same sandbox and a return path to the review record. Review routes are blocked in present mode.
