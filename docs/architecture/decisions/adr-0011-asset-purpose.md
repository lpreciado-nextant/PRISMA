# ADR-0011 — Asset purpose on demo assets

**Status:** Accepted. Column created in `PRISMA_Dev` 2026-10-06; plug-in (`b613493`) deployed and connected app (`6d39c65`) published 2026-10-06; verified by the user with a new solution. No backfill: existing rows are test data to be deleted.
**Date:** 2026-10-06
**Last updated:** 2026-10-06

## Context

CSMs asked for a library filter for solutions "with a demo", and in practice mean a **demo video** a CSM can play for a client. The data cannot answer that today:

- `nx_demoasset.nx_assettype` records the **format** (self-contained HTML, video, one-pager/slide, hosted URL, Power Apps, Power BI, desktop), set by the media plug-in from the file's MIME type. Every uploaded video becomes "Video walkthrough", whether it is a client demo or a supporting recording.
- The submit form has one "Attach additional media" box for videos, HTML, documents and links. The only notion of a "main demo" is a hint ("the first file is shown as the main demo"), i.e. sort order.
- `nx_GetCatalogueGraph` returns no media information, so the library has nothing to filter on.

A solution may legitimately have several demo videos, so "one demo video per solution" was rejected. Format alone cannot say what a file is *for* (a video can be supporting material; an HTML file can be a one-pager).

## Decision

- Add a local choice column **`nx_demoasset.nx_assetpurpose`** (Asset Purpose), optional at the Dataverse level, no default:
  `125060000` Demo video · `125060001` Interactive demo · `125060002` Supporting material.
  `nx_assettype` keeps describing the format; purpose and format are independent.
- **The contributor never picks purpose from a per-file dropdown.** The Media step is split into three sections (Demo videos · Interactive demo · Supporting material); the section a file is added to sets its purpose, and each section limits formats: Demo videos accept MP4/WebM (any number); Interactive demo accepts HTML and link types; Supporting material accepts PDF/PPT/PPTX and videos.
- The media plug-in sets the **format default on every new attachment** (upload or link), so new rows are never empty and the published app keeps working before it learns about purpose. A client may choose another purpose in the link payload or the media metadata save (`purpose`, optional); the plug-in accepts it only where the format allows: a demo video must be a video, an interactive demo HTML or a link, and anything may be supporting material. No extra submission rule is needed. Purpose is client-safe and is returned on each attachment snapshot (`purpose`), so it reaches drafts, published detail and present mode. No Custom API parameters change.
- `nx_GetCatalogueGraph` returns `demoVideos` and `interactiveDemos` per solution (with `purposes: true`), counted from the demo assets the caller can read, so the library can offer a **Demo video** filter (at least one) and later an Interactive demo filter, in present mode too. Rows without a stored purpose count by their format default.
- **No backfill.** The rows that existed when the column was created are test data the team will delete; until then they count by their format default. `MediaWriteGuard` is unchanged: purpose, like every media field, changes only through the PRISMA media APIs (direct grid edits stay blocked, even for administrators).

## Consequences

- The filter and the detail page can say exactly what a CSM will get, and "demo" stops meaning "whatever was first".
- Rollout order is fixed: column (done) → plug-in (signed deploy) → connected app. An app that sends purpose before the plug-in accepts it would have its saves rejected. The plug-in alone changes nothing visible: the published app ignores the new fields.
- Purpose is a new contributor obligation; the sectioned form keeps it implicit, so no extra clicks on the common path.
- Mixed-purpose cases (a video that is both demo and training) take one purpose; revisit if contributors repeatedly misfile.
