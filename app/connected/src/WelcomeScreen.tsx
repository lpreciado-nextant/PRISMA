import { type PointerEvent } from "react";
import { Icon } from "../../src/components/Icon";

export function WelcomeScreen({ authenticated, present, ready = false, entering = false, onBegin }: {
  authenticated: boolean; present: boolean; ready?: boolean; entering?: boolean; onBegin?: () => void;
}) {
  const status = ready ? (present ? "Your presentation is ready" : "Your catalogue is ready")
    : !authenticated ? "Connecting your workspace" : present ? "Preparing your presentation" : "Preparing your catalogue";
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
      <h1 id="welcome-title">Welcome to <span className="prisma-wordmark">PRISMA</span></h1>
      <p className="welcome-status" role="status" aria-live="polite" aria-atomic="true">{status}{!ready && <span aria-hidden="true">...</span>}</p>
    </div>
    <div className="welcome-connection glass" aria-label="Connection progress">
      <ol className="welcome-steps">
        <li className="welcome-step" aria-current={!authenticated ? "step" : undefined}>
          <span className={`welcome-step-icon${authenticated ? " is-complete" : " is-active"}`} aria-hidden="true"><Icon name={authenticated ? "check" : "shield"} size={16} /></span>
          <span>Workspace<span className="sr-only">{authenticated ? " connected" : " connecting"}</span></span>
        </li>
        <li className="welcome-step" aria-current={authenticated && !ready ? "step" : undefined}>
          <span className={`welcome-step-icon${ready ? " is-complete" : authenticated ? " is-active" : ""}`} aria-hidden="true"><Icon name={ready ? "check" : present ? "present" : "grid"} size={16} /></span>
          <span>{present ? "Presentation" : "Catalogue"}<span className="sr-only">{ready ? " ready" : authenticated ? " preparing" : " waiting"}</span></span>
        </li>
      </ol>
      <div className="welcome-track" aria-hidden="true"><span /></div>
    </div>
    <div className="welcome-action">
      {ready && <button type="button" className="welcome-begin glass" disabled={entering} onClick={onBegin}>
        Begin <Icon name="arrowRight" size={18} />
      </button>}
    </div>
  </section>;
}