# Demo assets

**Status:** 50/500 MiB MP4 upload, integrity and playback verified; full-download startup latency, external-launch and non-admin acceptance remain · **Last updated:** 2026-09-22
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

One to six gallery images are required at submission; up to six files/linked assets are optional. Image limit is 5 MB (and 40 megapixels for client decoding); WebP is converted to PNG within that limit. Document/HTML limit is 25 MB, video 500 MB, additionally capped by the actual Dataverse column limit. Large-video upload, integrity and MP4 playback were verified as recorded below; full-download startup latency remains a concern. A dedicated thumbnail is supported; pending screenshot captions save through the main Save draft/Continue flow. Native parent Solution images are not trusted publication inputs.

On 2026-09-22 the user reported both repository MP4 samples failing: 52,428,800 bytes and 524,288,000 bytes. Published/editable `nx_demoasset.nx_filemedia` metadata was only 32,768 KB (32 MiB), below both file sizes despite the advertised 500 MB video allowance. With explicit approval, `Prisma.Deploy set-video-limit --execute` increased that one file attribute to 512,000 KB (500 MiB / 524,288,000 bytes), published only `nx_demoasset`, and verified both metadata layers. The command defaults to read-only preview, checks organization/attribute/current limits, and accepts only the expected 32 MiB or already-correct 500 MiB states. Table publication can include other pending customizations on that table. No existing file contents, rows, permissions, code apps or plug-in assemblies were changed. The 25 MiB document/HTML and 5 MiB image policies remain unchanged. Full 50/500 MiB upload and playback were not performed as part of this metadata update. An editor already locked by an unconfirmed upload must reopen the draft before retrying; remove an unfinished upload only if one is present.

Screenshots and attachments can be reordered within their own groups by dragging the handle, using ArrowUp/ArrowDown on that handle, or activating Move earlier/later buttons (also suitable for touch). The PoC stores the ordered arrays with its local draft. Connected reordering first saves pending captions, then saves and verifies every finalized media ID/caption/order with the confirmed parent version. Thumbnail position is not draggable; uploads and unfinished media disable reordering. A failed/unconfirmed reorder locks further writes until reopen. Upload progress uses theme tokens, a rounded track, byte counts and accessible progress semantics; 100% received is labeled Finalizing until the server commits the file.

### Large-video verification

After the limit correction, an authenticated Local Play test on 2026-09-22 used the actual connected file input and a disposable draft, `b3126637-97b6-f111-aaac-6045bd049fba`. Both repository MP4s completed without UI upload errors; the editor returned from Uploading/Finalizing to Saved to Dataverse and re-enabled actions. Save draft & close followed by reopening retained both finalized attachments.

| File | Stored bytes | Confirmed blocks | SHA-256 matching local original |
|---|---|---|---|
| sample-50mb.mp4 | 52,428,800 | 100 | `48F8A871E7A615D9A23DEBA06CD419465C24BE4DD5128365061865412CB7EBD3` |
| sample-500mb.mp4 | 524,288,000 | 1,000 | `206817F772D75B8B6BB380B23DEA2485A300DBC9133515527A82169040425AFA` |

The 50 MiB file was independently verified through both the browser SDK and streamed Dataverse download; the 500 MiB file was verified with a bounded-memory 4 MiB-block download, avoiding another full browser allocation. Readback times were 13.5s and 106.4s respectively in this session, not an SLA. The larger upload took approximately 13 minutes based on server session timestamps; sequential 512 KiB requests remain a throughput limitation. `Prisma.Deploy verify-video-files <test-draft-id> <local-file> [local-file...]` is a read-only repeatable checker restricted to the `[PRISMA TEST] Large video acceptance` draft label, complete MP4 attachments and exact stored sizes; it does not create, upload, delete or change records.

The connected 50 MiB preview decoded at 1920x1080, duration 60 seconds, and successfully played, advanced time, paused and sought to five seconds without a media error. Controlled UI deletion removed the first disposable draft and its two file copies; an independent session query returned no rows. The two preexisting user submissions (`Prisma Test` and `Test`) and both local MP4s were untouched. No app/plug-in deployment or permission/schema change occurred during this test. Connected tests (41), rendered UI tests (11), backend tests (42) and lint passed.

The separately requested 500 MiB playback test used disposable draft `e763d331-9ab6-f111-aaac-6045bd049fba` and the actual connected upload/preview path. Upload finalized without errors. Preview took **144,217 ms** before the video element appeared because the SDK downloads the complete file before creating a blob URL; this is not progressive streaming. The player decoded at **1920x1080**, duration **300 seconds**, readyState 4, with no media error. Playback time advanced, pause/resume worked, forward seek to 30 seconds and backward seek to five seconds resumed correctly, and seeking to the last two seconds reached the ended event at 300 seconds. This was sampled playback and seek/end testing, not five uninterrupted minutes or a multi-device performance certification. A brief quality sample reported 71 total frames and two dropped frames. The preview was closed and controlled deletion removed the draft/file; the private-session query returned no rows. Existing user submissions and source MP4s were untouched. Earlier WebM failures, actual OS-delivered downloads, fullscreen and non-admin/cross-browser acceptance remain separate gates. Large-file browser memory use and the roughly 2m24s preview delay remain usability concerns.

Live disposable verification on 2026-09-22 reordered two PNGs and two HTML attachments, reopened the same order with captions intact, rejected a stale version, and deleted the fixture. Isolated browser checks verified project replacement, keyboard/tap ordering, synthetic drag/drop events, and mobile fit. The integrated browser's pointer drag gesture did not activate, so physical pointer-drag acceptance in a regular browser remains unverified.

Choose a linked format to add an asset name, URL and optional access note; hosted web apps can opt into embedding. Power Apps/BI cannot. Desktop/script entries instead require demo arrangements, with no URL or executable. Add/Save asset uses the version-checked `asset` transition on a caller-owned Draft. Unsaved asset text blocks leaving the step until saved or canceled. Edit and removal use the same protected lifecycle as files; the backend rejects unsafe URLs, unknown fields, wrong owners/states and stale versions. URLs must be HTTPS without credentials, and both URLs and notes must be free of secrets and client identifiers. Existing application authorization still applies; a PRISMA link does not grant access to its destination.

Hosted previews use an opaque sandbox (`allow-scripts allow-forms allow-popups`, no same-origin) and a pop-out fallback. Embedding is subject to the destination's CSP, framing policy and authentication requirements. Power Apps/BI open externally with `noopener,noreferrer`. Desktop arrangements are informational, not request delivery.

HTML and PNG upload/download/removal passed live; browser HTML sandbox blocks host-document access and network capabilities, and full-size image download preserves 640x360 rather than the native thumbnail. Native SDK reads enforce caller access. Object URLs are revoked on unmount. The [privileged lifecycle test](contribution-and-review.md#verified-lifecycle) passed publication, published detail/HTML viewer and withdrawal of uploaded and linked assets. Submit/approve validate link fields without file download, while uploaded assets retain byte-size verification. Reader-team share masks on all test media changed from Read to zero on withdrawal. Effective non-admin access and revocation denial remain unverified. Original PoC behavior and limits above are unchanged.

Linked-asset live checks on 2026-09-22 covered all four types, hosted edit, reopen, sandbox preview, desktop guidance, server unsafe/stale rejection, removal and cleanup. External-link attributes were checked; the integrated browser did not expose a popup event, so actual signed-in Power Apps/BI launch is still an acceptance item. Linked publication/revocation and non-admin reads remain unverified.

## Viewer routes

Full-screen viewer at `#/s/:id/demo/:assetId` — PoC implementation in [`app/src/views/ViewerView.tsx`](../../app/src/views/ViewerView.tsx). In present mode the viewer is full-bleed with minimal chrome.

Librarian previews use `#/review/:id/demo/:assetId`, with the same sandbox and a return path to the review record. Review routes are blocked in present mode.
