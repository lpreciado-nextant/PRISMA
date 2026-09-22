# Accessibility

**Status:** Partial automated and keyboard/mobile checks completed; manual contrast and screen-reader acceptance pending · **Last updated:** 2026-09-22

PRISMA targets **WCAG 2.1 AA**. This was partially implemented in the HTML prototype and must not regress ("accessible by default", design principle 6).

## Commitments

| Requirement | Detail |
|---|---|
| Keyboard navigation | Every interactive element reachable and operable by keyboard, in a sensible order. The hero flow (search → results → detail → viewer → present) must be completable without a pointer. |
| Visible focus | Focus indicators visible in both light and dark themes, including on glass surfaces. |
| Reduced motion | `prefers-reduced-motion` disables the aurora drift and non-essential transitions. |
| Semantic landmarks | `header` / `nav` / `main` / `aside` landmarks; facet rail as complementary; card grid as a list. |
| Contrast | All text tokens pass AA contrast in both themes — glass translucency must not push text below 4.5:1 (3:1 for large text). |
| Zero-result states | Communicated in text, not colour alone, with an actionable suggestion. |
| Viewer | Sandboxed iframe demos get an accessible title; escape returns focus to the invoking control. |
| Present mode | Mode state announced to assistive tech when toggled; the banner is not the only indicator. |

## Verification checklist (per release)

- [ ] Full keyboard pass of the hero flow
- [ ] Screen-reader pass (NVDA) of library, detail, submit
- [ ] Contrast audit of both themes after any token change
- [x] `prefers-reduced-motion` smoke test (2026-09-22 browser emulation)
- [ ] Focus-visible audit on glass surfaces

## Known gaps

The 2026-09-22 [acceptance pass](../workflows/contribution-and-review.md#eight-area-acceptance-pass) found no axe-core WCAG A/AA violations in light/dark library and identity form, but contrast on glass surfaces remained incomplete and needs manual review. No NVDA pass was performed.

Dialog Cancel initial focus, Tab containment, Escape and focus restoration to a keyboard-activated opener passed. The integrated browser's dispatched clicks do not focus the opener, so that automation cannot by itself prove pointer focus restoration.

Unbroken 100-character solution titles clipped inside mobile cards. Shared card/detail layouts now use `overflow-wrap:anywhere`; recheck measured card scroll width equal to its client width (332px) and title scroll/client width 292px. App content fit 365px, while Power Apps Local Play outer chrome overflowed to 546px in a 390px viewport. Hosted mobile acceptance remains open. Video decode failures now have an accessible error and download fallback in both targets; actual playback remains unverified in the integrated browser.
