# Discovery & presentation — the CSM hero flow

**Status:** Aligned with client-safe review and minimum-hours effort; presentation download added; CSM derived from the consultant level (2026-10-08); download theme menu with hints, confirmation and retry (2026-10-14); redesigned Dark and Light templates (2026-10-22, not published) · **Last updated:** 2026-10-22
**Source:** [End-to-end design §3.2](../design/end-to-end-design.md#32-discovery--presentation-the-csm-path)
**Measure:** problem statement → presentable demo in **under two minutes**, unaided (G1). Anything that adds a click to this path needs to earn it.

## Flow

```mermaid
flowchart LR
    A[Land on library] --> B[Search box]
    A --> C[Browse by specialization tabs]
    B --> D[Results grid + facet rail]
    C --> D
    D --> E[Solution detail]
    E --> F[Open demo in viewer]
    E --> G[Download one-pager]
    E --> H[Request live demo]
    F --> I[Present mode]
    E --> I
```

## Search

- Fast and forgiving; results update as the CSM types.
- Matches across: name, summary, what-it-does, business value, all builder names, tags, and the editorial `Search Keywords` field.
- **Zero-result states** suggest relaxing the most restrictive active facet rather than showing an empty page.

## Facets

- Filter by: specialization area, capability, technology and industry; solution-status facets are planned. Present eligibility is enforced before search, not a user-selectable sharing facet.
- Additive, live counts, individually removable as chips.
- Active filter state is reflected in the in-app URL hash. In the published app the player hides that hash, so views are shared as play links carrying `?route=` ([ADR-0003](../architecture/decisions/adr-0003-hash-routing.md)); solution detail pages have **Copy link**.

## Browse

For CSMs who don't yet know what they're looking for: three specialization-area tabs, each with a short framing note and a visual card grid. Cards carry a thumbnail (or generated poster), name, one-liner, specialization colour coding, status badge, and capability chips — enough to triage without clicking.

## Solution detail

The CSM's briefing document:

- What it does and business value
- Everyone who built it, with individual contact paths
- The client/context it came from
- Tags and the asset list ([demo assets](demo-assets.md))
- Total calculated effort hours, summed across contributors; not elapsed deployment time
- Per-person minimum hours and total effort, omitted in present mode ([effort contract](../data_model/SchemaV2.md#nx_solutioncontributor--builders-and-effort))
- Internal-only content (library notes) — visible to internal viewers, **never in present mode**

From here: open the demo in the viewer, download the one-pager, download a presentation, [request a live demo](demo-requests.md), or enter [present mode](present-mode.md).

### Download presentation

Connected PRISMA only. **Download presentation** sits beside Copy link on a published solution and builds a six-slide PRISMA × Nextant `.pptx` from the solution's own fields; the CSM picks the Dark or Light template from a small menu (Dark "best on screens and video calls", Light "best for projectors and print"; the last choice, else the app's theme, comes first as Suggested and is remembered in the browser; a note says the deck is client-safe). The button shows progress, then "Downloaded" with the file name, or the error with **Try again** (2026-10-14). Field-to-slide mapping and limits: [`tools/pptx-template/PRISMA_Field_Map.md`](../../tools/pptx-template/PRISMA_Field_Map.md).

- Offered only for published solutions with Client review = Cleared, and never in present mode.
- Never exports effort (complexity or hours), builder names, projects or library notes. The CSM (the contributor whose consultant-directory level, `cr6b0_consultantlevel`, names customer success) is the only person named, with the presenter (the signed-in user).
- Built in the browser: the deck module, JSZip and the chosen template load only on click, so the hero flow carries no extra weight. Images come through the protected media path; WebP/AVIF are redrawn as PNG.
- The design (2026-10-22) is the deck Juliana reworked in PowerPoint, in Dark and a derived Light version. Text that would overflow its box shrinks (down to 50–60% of the template size); a long description shrinks together with the business value so neither reaches the footer.
- Slide 4 shows every specialization area, the capability, the industries, the **redacted** client context (never `clientContext`) and the technologies; an empty industry or client context disappears with its label, and with neither the technologies move up.
- Every slide carries speaker notes built from the same fields; slide 5's notes list each demo's full link to paste if a button does not open. Slide 6's "Explore the Library" opens the library, and the contact (the CSM, else the presenter) shows initials, name and email.
- Slide 5 lists demo videos (up to 3), interactive demos (up to 2) and supporting material (up to 3) as rows under a heading per kind: one column at the design's spacing when they fit, otherwise one column per kind. A kind with nothing is dropped; with no demos at all the slide asks for a live walkthrough.
- Each row's button says what it does: PLAY ↗ (video), OPEN ↗ (HTML, links) or DOWNLOAD ↓ (any other file); the title links too. A file is never linked directly, since that would put a storage URL in the deck; its link opens the PRISMA viewer with `?download=1`, which starts the download once on arrival (the viewer's Download button stays for a blocked one).
- Demo rows link back to the demo in PRISMA, so they need a Nextant sign-in; the deck is for presenting live, not for sending to clients as a standalone demo. Demo titles use the caption or the file name without its extension until a title field exists ([Q19](../delivery/decision-log.md)).

## PoC mapping

| Piece | File |
|---|---|
| Search | [`app/src/lib/search.ts`](../../app/src/lib/search.ts) |
| URL filter state | [`app/src/lib/router.ts`](../../app/src/lib/router.ts) |
| Grid, tabs, facets, zero-result | [`app/src/views/LibraryView.tsx`](../../app/src/views/LibraryView.tsx) |
| Detail | [`app/src/views/DetailView.tsx`](../../app/src/views/DetailView.tsx) |
