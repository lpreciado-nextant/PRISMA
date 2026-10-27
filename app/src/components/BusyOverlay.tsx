import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Overlays active right now: the page stays inert until the last one closes. */
let active = 0;
let restoreFocus: HTMLElement | null = null;

/**
 * While a save or a workflow change runs (`label` set), the whole page stops responding: no clicks, keys or focus,
 * so nothing is pressed twice or left half-done. The page goes inert at once; the scrim and its card (the PRISMA
 * emblem and what is happening) appear after a short delay, so quick saves never flash. Focus returns afterwards.
 * Not for page loads, which already show their own loader, or long uploads, which keep their progress and controls.
 */
export function BusyOverlay({ label }: { label?: string }) {
  const busy = !!label;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const root = document.getElementById("root");
    if (active++ === 0 && root) {
      restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      root.inert = true;
      root.setAttribute("aria-busy", "true");
    }
    const timer = window.setTimeout(() => setShown(true), 300);
    return () => {
      window.clearTimeout(timer);
      setShown(false);
      if (--active === 0 && root) {
        root.inert = false;
        root.removeAttribute("aria-busy");
        if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
        restoreFocus = null;
      }
    };
  }, [busy]);
  if (!busy || !shown) return null;
  return createPortal(<div className="busy-overlay">
    <div className="busy-overlay-card glass glass-lite loading-state loading-state--page">
      <div className="loading-emblem" aria-hidden="true">
        <div className="loading-facet loading-facet--back glass glass-lite" /><div className="loading-facet loading-facet--front glass glass-lite" />
        <img src="./prisma-mark-v2.svg" alt="" width={56} height={56} />
      </div>
      <p className="loading-label" role="status" aria-live="polite">{label}</p>
      <div className="loading-rail" data-indeterminate="true" aria-hidden="true"><span /></div>
    </div>
  </div>, document.body);
}
