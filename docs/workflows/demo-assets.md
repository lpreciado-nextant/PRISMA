# Demo assets

**Status:** Agreed unified Media submission; legacy catalogue formats retained · **Last updated:** 2026-09-21
**Source:** [End-to-end design §3.3](../design/end-to-end-design.md#33-demo-assets)

Asset handling is type-dependent. **The CSM should never have to guess what will happen when they click.**

New submissions use a single Media step: **images, videos, one-pagers/slides, and self-contained HTML**. Require one to six detail images; thumbnail is optional. Hosted-app, Power Apps, Power BI, desktop/script and access-request controls are deferred. The table below also records behavior for existing legacy catalogue entries.

## Behaviour by type

| Asset type | In-app behaviour | Fallback |
|---|---|---|
| Self-contained HTML file | Render in the full-screen viewer directly from the Dataverse File column | Download the file |
| Hosted web app (URL) | Embed in the viewer if `Allows Embedding`; otherwise open in a new tab immediately | Pop-out, with the `Embed Hint` shown |
| Power Apps / Power BI | Deep-link out in a new tab (embedding is unreliable and auth-stalls inside frames) | Video walkthrough if one exists |
| Video walkthrough | Play inline in the viewer | Download |
| Desktop app or script | Not runnable in-app — show the video and a "request live demo" call to action | Contact the builder |
| Client-ready one-pager / slide | Download | — |

## Rules

- **New submissions require at least one detail image.** Images alone are sufficient; a thumbnail alone is not. Review the complete visual story and confidentiality before publication.
- Uploaded assets live in Dataverse File/Image columns ([ADR-0004](../architecture/decisions/adr-0004-assets-in-dataverse.md)).
- Self-contained HTML renders in a **sandboxed iframe** with a restrictive policy and no same-origin access to the host app; files are librarian-reviewed before publication ([security model](../architecture/security-model.md)).
- Hosted URLs are subject to the periodic link-health check ([content health](../operations/content-health.md)).

In the PoC, PNG/JPG/WebP images are decoded locally (5 MB each). Optional HTML, MP4/WebM and PDF/PPT/PPTX attachments are limited to six files, 25 MB each. Uploaded HTML uses a restrictive CSP and sandbox without same-origin access; network resources are blocked. Media lasts in memory until reload, not in tab storage or Dataverse. These local limits do not configure Dataverse column limits.

## Viewer

Full-screen viewer at `#/s/:id/demo/:assetId` — PoC implementation in [`app/src/views/ViewerView.tsx`](../../app/src/views/ViewerView.tsx). In present mode the viewer is full-bleed with minimal chrome.
