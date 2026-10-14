# Design system

**Status:** Living, shared loading states aligned across connected and PoC apps; library page, Top 5 shelf, imagery and text-contrast rules; glass rendering budget (refraction removed); collapsible Refine panel on small screens; area-tinted gallery thumbnails; library "Added within" time filter; Demo facet and purpose sections in the Media step and solution page; welcome screen light-refraction loading; quieter library headings, borderless toolbar, scalable, collapsible Refine rail with a mobile drawer and shared control sizes 2026-10-14 · **Last updated:** 2026-10-14
**Reference implementation:** [`app/src/index.css`](../../app/src/index.css) and the component set in [`app/src/components/`](../../app/src/components/)

The HTML prototype established the visual language; the code app PoC evolved it into the **liquid-glass system** and is the current reference. The production app matches the PoC.

## Identity

- **Wordmark:** PRISMA, central to the identity. The name stands for **P**rototypes, **R**eferences, **I**nteractive **S**olutions, **M**odels, **A**utomations. `PrismaAcronym` can spell it out with each initial in the brand lavender; since 2026-10-08 the welcome screen no longer shows it.
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

**Area-tinted gallery thumbnails.** In the grid, list and Top 5 shelf, thumbnails are desaturated under a colour-blend wash of the solution's first specialization area (the one that sets the card colour), so the gallery reads as a few calm hues instead of arbitrary screenshot colours. Hover or keyboard focus restores the original image; the detail page and viewer always show it untinted. Implemented by `PosterTint` in `Poster.tsx` and `.poster-tint` in `index.css`.

## Motion

- Purposeful and short; no decorative animation on the CSM hero path.
- `prefers-reduced-motion` disables non-essential transitions and the loader float.

## Loading states

Both apps use [`LoadingState`](../../app/src/components/LoadingState.tsx) and the shared tokens in [`index.css`](../../app/src/index.css):

- **Page:** compact prism with glass facets, a display heading and an indeterminate rail when loading replaces the main content. Keep existing back navigation available. The initial welcome screen (connected app) remains a separate entry experience: the logo on its glass facets, the large wordmark, then "Great solutions. One place.", "Discover what Nextant has built." and **Explore the Library**. A thin purple beam (`--sa-ibo`) is the only loading indicator: it grows from the screen's left edge towards the prism, eases to about 92% and waits there with a breathing tip, and touches the prism only when the catalogue is actually ready. Then the logo glows once and four rays (`--sa-ibo`, `--sa-ai`, `--accent`, `--sa-data`) fan out from the opposite face over a faint spectrum wedge, settling at low intensity. The copy and button fade up as soon as the catalogue is ready, without waiting for the rays. On Explore the rays open wide and fade under the existing entry flash. There is no visible status text; a screen-reader-only live region says "Signing you in", "Preparing your catalogue" / "Catalogue ready" (present mode: "Preparing your presentation" / "Presentation ready"). Present mode uses the same screen. Reduced motion shows the beam waiting near the prism, then beam and rays complete, with no travel or glow. Connection steps are not shown to people.
- **Media:** small prism and status inside the image or preview bounds. Reserve space and retain viewer controls; do not turn a media wait into a full-page blocker.
- **Inline:** body-sized status with a short rail for saves, reads, buffering and downloads. Known percentages use the shared `ProgressRail`, also used for uploads. Unknown progress never displays a fabricated percentage.

Status text uses a polite live region; page titles retain heading semantics. Progress bars expose measured values and upload finalization/incomplete states. Reduced motion stops decorative movement. Completion and errors replace loading indicators rather than leaving them active. Busy button labels and the draft header's save status stay compact.

## Library page

- **Hero:** the wordmark (no eyebrow since 2026-10-14; "Nextant · Solution Library" now titles the catalogue below); beside it, without a divider and centred in the free space, a three-level block (2026-10-14): the headline "Explore what Nextant has built." (21–24px semibold display, dark blue-grey: 72% `--ink`, 28% `--accent`), the supporting line "Discover solutions across AI, Data, and Operations — ready to support your next client conversation." (15px regular, `--ink-2`). The hero carries no counts (removed 2026-10-14); the catalogue heading shows the solution count instead.
- **Top 5 shelf** (`TopTenRow`): heading "Top 5 Most Saved" (or fewer when fewer are ranked; `.section-title`, 20px semibold `--ink`); "Most popular solutions in the library" is a small tooltip on hovering the heading (`.hover-hint`) and its accessible description. Rank numerals are 6.5rem so the cards lead; each card covers about 40% of its numeral. The shelf's arrows and Hide/Show use the library toolbar's borderless `.toolbar-select` style. Set to five on 2026-10-06 (PR-018); `nx_GetTopFavorites` still returns up to ten and the shelf shows the first five. It sits on the page's own ground, lifted only by a ~4% lavender tint, a hairline edge and a faint shadow, never a separate white box. Identical horizontal cards (a square crop of the thumbnail on the left; on the right the title, up to two balanced lines (`text-wrap: balance`) instead of an ellipsis, level with a small "♥ 12" in the card's top-right corner, and the two-line summary centred in the space below; no area tag, to keep the cards quiet). The heart is `FavoriteButton` `bare`: a 13px heart and an 11px mono count with no circle, filled when the viewer saved it, inside a 32px hit area; the count moves with the viewer's own click until the next ranking read, sized from the shelf width (1–4 cards by container width) so about half of the next card always peeks in past its numeral to signal scrolling, with a large pastel purple-to-blue rank numeral behind each; white cards in the light theme. The whole ranking shows in one carousel; Hide/Show folds it to its heading and a short ranked list of names, each chip a light translucent tint of its solution's area colour (rank in that colour; each opens its solution). Arrows sit upper right. It shows only on the unfiltered library, never in present mode, and hides when nobody has saved anything. How many people saved a ranked solution shows on its detail page, inside the heart as one heart + count chip (`FavoriteButton` `count`) styled like Copy link.
- **Solution Library:** heading row with borderless dropdowns (`.toolbar-select`: a muted "Sort by" / "Added" label, then the value in semibold) for "Newest/Oldest" (creation date) and " Any time / Last 30 days / 3 months / 6 months / 12 months" picker (months are calendar months back from today) that shows how many solutions each window leaves, and a grid/list icon toggle. The facet rail opens with **Demo** ("Demo video", "Interactive demo", with counts; [ADR-0011](../architecture/decisions/adr-0011-asset-purpose.md)) above Capability, Technology, Industry and Target client role. The time window is a real filter: it lives in the URL (`added=30d`), narrows the area and facet counts, hides the Top 3 shelf like any other filter, and the empty state offers "Show any time". Preset windows rather than a slider: one click, exact, keyboard-friendly and fits the toolbar on a phone. The heading, "Nextant · Solution Library" followed by a small neutral count of the visible catalogue's solutions, uses the same `.section-title` as the Top shelf. **Refine rail** (250px, sticky; only the rail scrolls): a collapse icon at the top right of its header hides it. With the rail open, Sort by, Added and the grid/list toggle share the heading's row; collapsed, a second row appears under the heading with a compact **Filters** button (sliders icon, active-count badge, soft `--ink` fill one step above the borderless controls; `.toolbar-filter`) on the left and the other controls on the right; selections persist and the choice is remembered for the session; hidden, the grid widens to 3–4 columns. Each group (Demo, Capability, Technology, Industry, Target client role) shows how many options it offers beside its title, folds open/closed, lists 5 options with "Show N more / Show less", wraps long labels instead of truncating, shows live counts (current search and the other filters), keeps a selected option at 0 rather than dropping it, and Capability and Technology add a search box above 8 options. Below `lg` the rail is a left drawer (modal dialog: Escape closes, focus returns) opened from a toolbar "Filters" button, with "Clear all" and "Show N results". Active filters (facets and the added window) sit above the cards as removable chips with the total, the live result count and **Clear all**. Library controls share one scale: 36px pills for toolbar dropdowns and the grid/list toggle, 32px pills for filter chips, and a solid-accent selected state. The area filter under the search is deliberately different (2026-10-14): text options with no lead-in label, each on a faint ink fill so it reads as a button and left-aligned with the search field (13.5px, quiet counts, zero counts dimmer, no dots), each area with a 7px dot in its own colour (`--sa-*`), the chosen one with a light tint of that colour ("All areas": neutral blue-grey) and a 7px radius (`.area-filter`), no underline or icons, so it never reads as the section tabs. A chosen area's description shows below as one compact note: a 3px bar and faint wash in the area's colour, its name in semibold, then the description; it fits its content and wraps only when the width runs out. The search field above it is a 50px, 12px-radius field in the app's glass: the translucent card surface (`--glass-bg-2`) with a 1px glass border, the accent border on focus, no gradient (`.search-field`); placeholder "Search solutions, business challenges, capabilities, and more..." (search covers name, summary, what it does, business value, capabilities, technologies, industries, client role, client context and contributors). Grid keeps the cards; list uses compact `SolutionRow`s. Sort and layout persist for the session and never affect the Top 3. Present mode shows neither.
- **Area tags** (`AreaTag`): in the dark theme AI is a saturated blue (`--sa-ai` `#6aa5f5`, hue 215) so it never reads as Data's teal, and tags take a richer fill (24%) and edge (48%); text stays at least 4.7:1 on its fill. The light theme keeps 17% / 32%.
- **Solution page side column** (2026-10-14): one card with **Solution overview** (specialization areas, capability, **Capability owner** read from `nx_capability.nx_capabilityowner` as initials + name, "Not assigned" when empty; added date), **Business context** (target role `nx_clientrole`, industries as chips, the internal client `nx_clientcontext` and "Shown to clients as" `nx_clientcontextredacted`) and **Technologies used**, set apart by hairline dividers; then an internal card (no label; present mode drops it) with **Contributors & development effort** (name, directory level, each person's minimum hours, then **Minimum hours invested**, the stored sum, "Minimum recorded development effort for this solution.") and **Associated projects** (`cr6b0_project` N:N); long lists fold after four. **Suggest an improvement** is a dashed-outline action card (`.suggest-card`), not a metadata card. Present mode drops the owner, the internal client, added date, the whole internal card and the suggestion card, and shows the client context as the redacted wording only. The "Client review" row is gone: the header's "Not cleared for presentation" badge already says it.
- **Cards:** 16:9 image, full area names in the `xs` tag size, name, two-line summary, chips. The Top 5 cards show no area tag.

## Imagery

- **Card thumbnails are framed at submission.** `ImageFramer` opens a 16:9 frame (pan by drag or arrows, zoom up to 4x, rule-of-thirds guides) and uploads the framed crop as a JPEG, never upscaled, at most 1920 wide. No framing metadata is stored.
- **Detail hero:** title, tags, heart and summary beside the whole 16:9 thumbnail; stacked on small screens.
- **Screenshots** open in a full-screen `Lightbox`: arrows, arrow keys, swipe, counter, caption, filmstrip, Esc or backdrop to close.

## Present mode treatment

Present mode changes the visual register (see [present mode](../workflows/present-mode.md)): larger type, minimal chrome, no filter rail by default, full-bleed demo viewer, and a persistent, unmistakable mode banner.

## Component inventory (PoC)

| Component | File | Role |
|---|---|---|
| Masthead | `app/src/components/Masthead.tsx` | A slim sticky glass bar: wordmark, **Submit a solution** (accent fill, the primary action), present-mode toggle, theme switch, profile. Below it, on the page and scrolling with it (2026-10-14), section tabs on a hairline: 16px icon + label (Library, **Saved solutions** with a small count and a red heart when any are saved, My submissions (an accent dot while any feedback item is open), Review queue only when the existing librarian check allows it, with an amber badge counting submissions in Pending review, hidden at zero; connected only, re-read on each navigation); muted until hovered, the current one in ink with an accent underline (`.section-nav-link`). Below `sm`, Library and Saved solutions stay and the rest move into a ••• menu. No tabs in present mode or before entry |
| Solution card | `app/src/components/SolutionCard.tsx` | Thumbnail/poster, name, one-liner, status badge, capability chips |
| Facet rail | `app/src/components/FacetRail.tsx` | Additive, collapsible facet groups with live counts, show-more and in-group search; collapsible from its header, reopened from the library toolbar. Below `lg`, `FacetDrawer` replaces it, opened from the library toolbar (badge shows active facet count) |
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
