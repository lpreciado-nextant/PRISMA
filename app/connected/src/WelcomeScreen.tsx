import { type PointerEvent, useEffect, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";

// Loading only reports "loading" or "ready", so the beam eases towards 92% of the way and waits there;
// it touches the prism, and the rays fan out, only once the catalogue is actually ready.
const HOLD = 0.92;
const APPROACH_MS = 1200;
const ARRIVE_MS = 380;

export function WelcomeScreen({ authenticated, present, ready = false, entering = false, onBegin }: {
  authenticated: boolean; present: boolean; ready?: boolean; entering?: boolean; onBegin?: () => void;
}) {
  // No visible status text: the beam is the indicator, and this line keeps it announced.
  const status = ready ? (present ? "Presentation ready" : "Catalogue ready")
    : !authenticated ? "Signing you in" : present ? "Preparing your presentation" : "Preparing your catalogue";
  const facetRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const beam = useRef({ start: 0, progress: 0 });
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const line = beamRef.current;
    if (!line) return;
    const draw = (value: number) => { beam.current.progress = value; line.style.setProperty("--welcome-beam", value.toFixed(4)); };
    let id = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No travel: the beam waits near the prism, then shows complete with the rays.
      draw(ready ? 1 : HOLD);
      if (ready) id = requestAnimationFrame(() => setArrived(true));
      return () => cancelAnimationFrame(id);
    }
    const now = performance.now();
    if (!beam.current.start) beam.current.start = now;
    const from = beam.current.progress;
    const step = (time: number) => {
      if (!ready) {
        draw(HOLD * (1 - Math.exp(-(time - beam.current.start) / APPROACH_MS)));
        id = requestAnimationFrame(step);
        return;
      }
      const t = Math.min(1, (time - now) / ARRIVE_MS);
      draw(from + (1 - from) * (1 - (1 - t) ** 3));
      if (t < 1) id = requestAnimationFrame(step);
      else setArrived(true);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [ready]);

  function moveHighlight(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const section = event.currentTarget;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const facet = facetRef.current;
      if (!facet) return;
      const bounds = section.getBoundingClientRect();
      facet.style.setProperty("--welcome-x", `${((clientX - bounds.left) / bounds.width) * 100}%`);
      facet.style.setProperty("--welcome-y", `${((clientY - bounds.top) / bounds.height) * 100}%`);
    });
  }
  function resetHighlight() {
    cancelAnimationFrame(frame.current);
    facetRef.current?.style.removeProperty("--welcome-x");
    facetRef.current?.style.removeProperty("--welcome-y");
  }
  return <section className="welcome-screen" data-ready={ready} data-arrived={arrived} data-entering={entering} aria-labelledby="welcome-title" onPointerMove={moveHighlight} onPointerLeave={resetHighlight}>
    <div className="welcome-stage">
      <div ref={beamRef} className="welcome-beam" aria-hidden="true"><span /></div>
      <div className="welcome-rays" aria-hidden="true"><span className="welcome-fan" /><span /><span /><span /><span /></div>
      <div className="welcome-emblem" aria-hidden="true">
        <div className="welcome-facet welcome-facet-back glass glass-lite" />
        <div ref={facetRef} className="welcome-facet welcome-facet-front glass glass-lite" />
        <img className="welcome-mark" src="./prisma-mark-v2.svg" alt="" width="104" height="104" />
      </div>
    </div>
    <h1 id="welcome-title" className="welcome-title"><span className="prisma-wordmark welcome-wordmark">PRISMA</span></h1>
    <div className="welcome-copy" aria-hidden={!ready}>
      <p className="welcome-headline">Great solutions. One place.</p>
      <p className="welcome-subtitle">Discover what Nextant has built.</p>
    </div>
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{status}</p>
    <div className="welcome-action">
      {ready && <button type="button" className="welcome-begin glass" disabled={entering} onClick={onBegin}>
        Explore the Library <Icon name="arrowRight" size={18} />
      </button>}
    </div>
  </section>;
}
