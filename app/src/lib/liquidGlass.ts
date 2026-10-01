/**
 * Runtime half of the liquid-glass treatment, after
 * https://github.com/rdev/liquid-glass-react — ported natively instead of
 * importing the library, which wraps single fixed widgets and is unmaintained.
 * Its SVG refraction was removed: over the blurred aurora it was invisible, yet
 * it re-ran a displacement filter on every glass panel in every frame.
 */

/**
 * Drives the specular highlight: one delegated, rAF-throttled listener that
 * writes --mx/--my onto the hovered glass panel only, so the sheen follows
 * the pointer like light on a curved surface.
 */
export function initPointerSheen() {
  if (window.matchMedia("(hover: none)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let raf = 0;
  let lastEvent: PointerEvent | null = null;
  let lit: HTMLElement | null = null;

  const apply = () => {
    raf = 0;
    // Only small interactive panels track the pointer: repainting a
    // full-width panel's sheen every mousemove frame is what made the
    // detail page crawl.
    const target = lastEvent?.target as Element | null;
    // The gallery heart is the card's sibling; keep its card lit while on it.
    const el = target?.closest?.(".glass-sheen.lift") ?? target?.closest?.(".card-shell")?.querySelector(".glass-sheen.lift");
    const next = el instanceof HTMLElement ? el : null;
    // Measure before any style write so the read doesn't force a synchronous layout.
    const r = next?.getBoundingClientRect();
    if (lit && lit !== next) {
      lit.style.removeProperty("--mx");
      lit.style.removeProperty("--my");
    }
    lit = next;
    if (next && r && lastEvent) {
      next.style.setProperty("--mx", `${(((lastEvent.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      next.style.setProperty("--my", `${(((lastEvent.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
    }
  };

  document.addEventListener(
    "pointermove",
    (e) => {
      lastEvent = e;
      if (!raf) raf = requestAnimationFrame(apply);
    },
    { passive: true },
  );
}
