# Design system

**Status:** Living · **Last updated:** 2026-09-17
**Reference implementation:** [`app/src/index.css`](../../app/src/index.css) and the component set in [`app/src/components/`](../../app/src/components/)

The HTML prototype established the visual language; the code app PoC evolved it into the **liquid-glass system** and is the current reference. The production app matches the PoC.

## Identity

- **Wordmark:** PRISMA, central to the identity.
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

> Fonts currently load from Google Fonts. If the tenant enforces a strict CSP, self-host all three families (noted as a soft dependency in the [app README](../../app/README.md)).

## Surface language — liquid glass

Translucent refractive surfaces over an aurora ground:

- Cards, rails, and the masthead are glass panels — blur, low-alpha fill, fine border highlight.
- The background is a slow-moving aurora gradient; it must respect `prefers-reduced-motion`.
- Depth comes from layered translucency, not drop shadows alone.

## Themes

Light and dark themes are both first-class. Theme logic lives in [`app/src/lib/theme.ts`](../../app/src/lib/theme.ts). All colour tokens must pass contrast in both themes.

## Motion

- Purposeful and short; no decorative animation on the CSM hero path.
- `prefers-reduced-motion` disables the aurora drift and non-essential transitions.

## Present mode treatment

Present mode changes the visual register (see [present mode](../workflows/present-mode.md)): larger type, minimal chrome, no filter rail by default, full-bleed demo viewer, and a persistent, unmistakable mode banner.

## Component inventory (PoC)

| Component | File | Role |
|---|---|---|
| Masthead | `app/src/components/Masthead.tsx` | Wordmark, search, present-mode toggle, theme switch |
| Solution card | `app/src/components/SolutionCard.tsx` | Thumbnail/poster, name, one-liner, status badge, capability chips |
| Facet rail | `app/src/components/FacetRail.tsx` | Additive facets with live counts, removable chips |
| Poster | `app/src/components/Poster.tsx` | Generated per-specialization placeholder for records without a thumbnail |
| Badges | `app/src/components/Badges.tsx` | Status and shareability badges |
| Present banner | `app/src/components/PresentBanner.tsx` | Persistent present-mode indicator |
| Background | `app/src/components/Background.tsx` | Aurora ground |
