import { type PointerEvent } from "react";
import { Icon } from "../../src/components/Icon";
import { PrismaAcronym } from "../../src/components/PrismaAcronym";

export function WelcomeScreen({ authenticated, present, ready = false, entering = false, onBegin }: {
  authenticated: boolean; present: boolean; ready?: boolean; entering?: boolean; onBegin?: () => void;
}) {
  // One friendly line for people; the old Workspace/Catalogue steps were a debugging aid.
  const status = ready ? (present ? "Your presentation is ready" : "Your catalogue is ready")
    : !authenticated ? "Signing you in" : present ? "Preparing your presentation" : "Preparing your catalogue";
  function moveHighlight(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--welcome-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    event.currentTarget.style.setProperty("--welcome-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  }
  function resetHighlight(event: PointerEvent<HTMLElement>) {
    event.currentTarget.style.removeProperty("--welcome-x");
    event.currentTarget.style.removeProperty("--welcome-y");
  }
  return <section className="welcome-screen" data-ready={ready} aria-labelledby="welcome-title" onPointerMove={moveHighlight} onPointerLeave={resetHighlight}>
    <div className="welcome-emblem" aria-hidden="true">
      <div className="welcome-facet welcome-facet-back glass" />
      <div className="welcome-facet welcome-facet-front glass" />
      <img className="welcome-mark" src="./prisma-mark-v2.svg" alt="" width="104" height="104" />
    </div>
    <div className="welcome-copy">
      <p className="welcome-overline">Nextant's solution library</p>
      <h1 id="welcome-title"><span className="welcome-hello">Welcome to</span> <span className="prisma-wordmark welcome-wordmark">PRISMA</span></h1>
      <PrismaAcronym className="welcome-acronym" />
    </div>
    <div className="welcome-loading">
      <div className="welcome-track" aria-hidden="true"><span /></div>
      <p className="welcome-status" role="status" aria-live="polite" aria-atomic="true">{status}{!ready && <span aria-hidden="true">...</span>}</p>
    </div>
    <div className="welcome-action">
      {ready && <button type="button" className="welcome-begin glass" disabled={entering} onClick={onBegin}>
        Begin <Icon name="arrowRight" size={18} />
      </button>}
    </div>
  </section>;
}