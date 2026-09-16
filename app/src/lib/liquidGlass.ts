/**
 * Runtime halves of the liquid-glass treatment, after
 * https://github.com/rdev/liquid-glass-react — ported natively instead of
 * importing the library, which wraps single fixed widgets and is unmaintained.
 */

/**
 * SVG displacement in a backdrop-filter chain only renders on Chromium (the
 * reference library carries the same caveat). Everywhere else the declaration
 * can invalidate the whole chain and kill the blur, so gate it up front.
 */
export function enableRefraction() {
  const isChromium = /Chrom(e|ium)/.test(navigator.userAgent);
  if (isChromium && CSS.supports("backdrop-filter", "blur(4px) url(#x)")) {
    document.documentElement.classList.add("refract");
  }
}

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
    const el = (lastEvent?.target as Element | null)?.closest?.(".glass-sheen");
    const next = el instanceof HTMLElement ? el : null;
    if (lit && lit !== next) {
      lit.style.removeProperty("--mx");
      lit.style.removeProperty("--my");
    }
    lit = next;
    if (next && lastEvent) {
      const r = next.getBoundingClientRect();
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
