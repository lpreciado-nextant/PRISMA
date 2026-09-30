# Design system

**Status:** Living, shared loading states aligned across connected and PoC apps; library page, Top 3 shelf, imagery and text-contrast rules; glass rendering budget (refraction removed) · **Last updated:** 2026-09-30
**Reference implementation:** [`app/src/index.css`](../../app/src/index.css) and the component set in [`app/src/components/`](../../app/src/components/)

The HTML prototype established the visual language; the code app PoC evolved it into the **liquid-glass system** and is the current reference. The production app matches the PoC.

## Identity

- **Wordmark:** PRISMA, central to the identity. The name stands for **P**rototypes, **R**eferences, **I**nteractive **S**olutions, **M**odels, **A**utomations; the welcome screen spells it out under the wordmark (`PrismaAcronym`), with each initial in the brand lavender.
- **Mark gradient:** `--prism-1` to `--prism-5` (gold, mauve, lavender, blue, teal) are the colours of the PRISMA mark, with deeper stops in the light theme. The Top 3 numerals use their own pastel pair, `--rank-from` (purple) and `--rank-to` (blue).
- **Brand base:** steel blue `#1C567C` (from the Nextant wordmark).
- **Per-specialization accents** — each Specialization Area carries its own accent colour, applied to cards, tabs, chips, and generated poster placeholders:
  - AI & Automation
  - Data Solutions
  - Intelligent Business Operations

## Typography

| Role | Family |
|---|---|
| Display / headings | Schibsted Grotesk |
| Body | Source Sans 3 |
| Mono (metadata, keys) | IBM Plex Mono |

Schibsted Grotesk ships weights 400 to 900; the heavy weights carry the wordmark, rank numerals and generated posters, so they are never synthesized. The connected app bundles every family and weight through Fontsource (the host CSP allows same-origin fonts only); the PoC requests the same weights from Google Fonts. See the CSP note in the [app README](../../app/README.md) before adding a family or weight.

## Surface language — liquid glass

Translucent frosted surfaces over an aurora ground:

- Cards, rails, and the masthead are glass panels — blur, low-alpha fill, fine border highlight.
- The background is a static aurora (three blurred colour fields and a faint grid). It does not animate: every blurred panel above it would re-filter on each frame.
- Depth comes from layered translucency, not drop shadows alone.

**Rendering budget.** Each `backdrop-filter` is a GPU pass that re-runs whenever anything behind or under the surface changes (scrolling, hover, a floating animation). So:

- `.glass` (blur and saturate) is kept for surfaces that something can pass behind or that sit on imagery: the sticky masthead, the present banner, dialogs, the lightbox, favorite hearts and status pills on thumbnails, plus the search field, area tabs and facet rail, where the saturated tint is visible.
- `.glass-lite` has no backdrop filter. Use it for surfaces that sit only on the static ground (the card grid, list rows, detail sections, form steps, the viewer frame) and for anything that animates continuously, such as the floating loader and welcome facets.
- No SVG filters in `backdrop-filter`. An SVG displacement ("refraction") was removed on 2026-09-30: it was not visible over the blurred aurora, yet in headless Edge with a software renderer (a weak-GPU stand-in, 1440×900) hovering across the card grid ran at 12 frames per second with it and 39 without, and the page loader at 25 and 60. Making the floating loader facets `.glass-lite` then cut the loader's GPU load from 50% to 11%.

## Themes

Light and dark themes are both first-class. Theme logic lives in [`app/src/lib/theme.ts`](../../app/src/lib/theme.ts). All colour tokens must pass contrast in both themes.

**Text contrast.** Secondary (`--ink-2`) and tertiary (`--ink-3`) text are grey, not black, but always pass WCAG AA: light `#3b4852` (7.9:1 or more) and `#56646f` (5.1:1 or more) on the ground and cards; dark `#b8c4ce` (10.4:1) and `#909eaa` (6.8:1). Keep new greys at or above these ratios.

**White screenshots in the light theme.** A white thumbnail on a white card dissolves, so in the light theme catalogue cards take a pale steel-blue sheet, and every card, list-row and Top 3 image has a hairline edge and a faint inner ring. The dark theme keeps its dark glass.

## Motion

- Purposeful and short; no decorative animation on the CSM hero path.
- `prefers-reduced-motion` disables non-essential transitions and the loader float.

## Loading states

Both apps use [`LoadingState`](../../app/src/components/LoadingState.tsx) and the shared tokens in [`index.css`](../../app/src/index.css):

- **Page:** compact prism with glass facets, a display heading and an indeterminate rail when loading replaces the main content. Keep existing back navigation available. The initial welcome screen remains a separate entry experience: "Welcome to" above a large wordmark and its meaning, then one slim rail and one status line ("Signing you in", "Preparing your catalogue", "Your catalogue is ready"). Begin appears only when the catalogue is ready. Connection steps are not shown to people.
- **Media:** small prism and status inside the image or preview bounds. Reserve space and retain viewer controls; do not turn a media wait into a full-page blocker.
- **Inline:** body-sized status with a short rail for saves, reads, buffering and downloads. Known percentages use the shared `ProgressRail`, also used for uploads. Unknown progress never displays a fabricated percentage.

Status text uses a polite live region; page titles retain heading semantics. Progress bars expose measured values and upload finalization/incomplete states. Reduced motion stops decorative movement. Completion and errors replace loading indicators rather than leaving them active. Busy button labels and the draft header's save status stay compact.

## Library page

- **Hero:** eyebrow on its own row, then the wordmark beside "Nextant's solutions across AI, Data and Operations, with demos ready for your next client conversation.", top-aligned with it. Under the line, live counts from the visible catalogue: solutions, specialization areas and technologies.
- **Top 3 shelf** (`TopTenRow`): eyebrow "Most saved in the Solution Library" over the heading "Top 3". It sits on the page's own ground, lifted only by a ~4% lavender tint, a hairline edge and a faint shadow, never a separate white box. Identical horizontal cards (a square crop of the thumbnail, category, title, summary, heart), 350px wide, with a large pastel purple-to-blue rank numeral behind each; white cards in the light theme. "View all" shows the rest of the ranking (up to 10, and the heading becomes "Top 10") in the same carousel; Hide/Show folds it to its heading. Arrows sit upper right. It shows only on the unfiltered library, never in present mode, and hides when nobody has saved anything.
- **Solution Library:** heading row with a compact "Sort by: Newest/Oldest" (creation date) and a grid/list icon toggle. The heading shares the Top 3 heading's type and lavender (`--sa-ibo`, extra bold, the same size). Grid keeps the cards; list uses compact `SolutionRow`s. Sort and layout persist for the session and never affect the Top 3. Present mode shows neither.
- **Cards:** 16:9 image, full area names in the `xs` tag size, name, two-line summary, chips. The Top 3 uses short area names (AI, DS, IBO) where space is tight.

## Imagery

- **Card thumbnails are framed at submission.** `ImageFramer` opens a 16:9 frame (pan by drag or arrows, zoom up to 4x, rule-of-thirds guides) and uploads the framed crop as a JPEG, never upscaled, at most 1920 wide. No framing metadata is stored.
- **Detail hero:** title, tags, heart and summary beside the whole 16:9 thumbnail; stacked on small screens.
- **Screenshots** open in a full-screen `Lightbox`: arrows, arrow keys, swipe, counter, caption, filmstrip, Esc or backdrop to close.

## Present mode treatment

Present mode changes the visual register (see [present mode](../workflows/present-mode.md)): larger type, minimal chrome, no filter rail by default, full-bleed demo viewer, and a persistent, unmistakable mode banner.

## Component inventory (PoC)

| Component | File | Role |
|---|---|---|
| Masthead | `app/src/components/Masthead.tsx` | Wordmark, search, present-mode toggle, theme switch |
| Solution card | `app/src/components/SolutionCard.tsx` | Thumbnail/poster, name, one-liner, status badge, capability chips |
| Facet rail | `app/src/components/FacetRail.tsx` | Additive facets with live counts, removable chips |
| Poster | `app/src/components/Poster.tsx` | Generated per-specialization placeholder for records without a thumbnail |
| Badges | `app/src/components/Badges.tsx` | Maturity status, specialization and tag chips |
| Present banner | `app/src/components/PresentBanner.tsx` | Persistent present-mode indicator |
| Background | `app/src/components/Background.tsx` | Aurora ground |
| Top 3 shelf | `app/src/components/TopTenRow.tsx` | Most-saved ranking carousel with rank numerals |
| Solution row | `app/src/components/SolutionRow.tsx` | List-view line for the library |
| Select picker | `app/src/components/SelectPicker.tsx` | Themed dropdown; `compact` for toolbars |
| Image framer | `app/src/components/ImageFramer.tsx` | 16:9 thumbnail pan and zoom before upload |
| Lightbox | `app/src/components/Lightbox.tsx` | Full-screen screenshot viewer |
| PRISMA acronym | `app/src/components/PrismaAcronym.tsx` | The name spelled out under the wordmark |
