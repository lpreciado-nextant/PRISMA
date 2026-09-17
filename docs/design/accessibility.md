# Accessibility

**Status:** Living · **Last updated:** 2026-09-17

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
- [ ] `prefers-reduced-motion` smoke test
- [ ] Focus-visible audit on glass surfaces

## Known gaps

_Track gaps here as they are found; none logged yet._
