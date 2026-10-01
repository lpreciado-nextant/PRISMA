import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Solution } from "../types";
import { solutionAreas } from "../lib/areas";
import { navigate } from "../lib/router";
import { AreaTag } from "./Badges";
import { FavoriteButton } from "./FavoriteButton";
import { Icon } from "./Icon";
import { Poster } from "./Poster";

const HIDDEN_KEY = "prisma.top10.hidden";
const LIMIT = 10;

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === "true"; } catch { return false; }
}
function writeFlag(key: string, value: boolean) {
  try { localStorage.setItem(key, String(value)); } catch { void 0; }
}

type Favorite = { saved: boolean; pending?: boolean; onToggle: () => void };

/**
 * "Most saved by the team" ranking, Netflix Top 10 style: horizontal cards (the
 * whole 16:9 thumbnail left, category, title, summary and heart right) with a
 * large gradient rank numeral behind each one. Shows the top ten in a carousel.
 * Order comes from the caller.
 */
export function TopTenRow({ solutions, renderPoster, onOpen, favorite }: {
  solutions: Solution[];
  /** Replaces the generated poster, e.g. with a protected Dataverse thumbnail. */
  renderPoster?: (solution: Solution) => ReactNode;
  onOpen?: (solution: Solution) => void;
  /** Heart state for a solution; omit to hide the heart (for example when favorites didn't load). */
  favorite?: (solution: Solution) => Favorite | undefined;
}) {
  // Hidden folds the shelf down to its heading; a per-viewer convenience.
  const [hidden, setHidden] = useState(() => readFlag(HIDDEN_KEY));
  const track = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const shown = solutions.slice(0, LIMIT);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => setEdges({
      start: element.scrollLeft <= 2,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
    });
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); };
  }, [shown.length, hidden]);

  if (solutions.length === 0) return null;

  const toggleHidden = () => { setHidden(!hidden); writeFlag(HIDDEN_KEY, !hidden); };
  const openSolution = (solution: Solution) => onOpen ? onOpen(solution) : navigate(`/s/${solution.id}`);
  const page = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <section aria-labelledby="top-ten-title" className="section-panel section-panel--featured top-shelf animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="eyebrow">Most saved in the Solution Library</p>
          <h2 id="top-ten-title" className="mt-1 text-[clamp(1.3rem,2vw,1.65rem)] leading-none font-extrabold" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.04em", color: "var(--sa-ibo)" }}>
            Top {shown.length}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!hidden && <>
            <ShelfButton label="Previous solutions" icon="chevronLeft" disabled={edges.start} onClick={() => page(-1)} />
            <ShelfButton label="More solutions" icon="chevronRight" disabled={edges.end} onClick={() => page(1)} />
          </>}
          <button type="button" onClick={toggleHidden} aria-expanded={!hidden} aria-controls="top-ten-shelf" className="top-view-all inline-flex items-center gap-1" style={{ color: "var(--ink-2)" }}>
            {hidden ? "Show" : "Hide"}
            <span className={`inline-grid transition-transform duration-300 ${hidden ? "" : "rotate-180"}`}><Icon name="chevronDown" size={14} /></span>
          </button>
        </div>
      </div>

      <ol id="top-ten-shelf" ref={track} hidden={hidden} className="top-ten-track mt-1" aria-label="Most saved solutions, best first">
        {shown.map((solution, index) => {
          const rank = index + 1;
          const area = solutionAreas(solution)[0] ?? solution.specializationArea;
          const heart = favorite?.(solution);
          return (
            <li key={solution.id} className="top-card-item animate-rise" data-wide={rank >= 10 ? "" : undefined} style={{ animationDelay: `${Math.min(index, 9) * 45}ms` } as CSSProperties}>
              <span className="top-rank" aria-hidden="true">{rank}</span>
              <div className="top-card glass-sheen lift group">
                {/* The whole card opens the solution; the heart sits above this stretched button. */}
                <button type="button" onClick={() => openSolution(solution)} className="absolute inset-0 z-[1] cursor-pointer rounded-[inherit]" aria-label={`Number ${rank}: ${solution.name} — ${solution.summary}`} />
                <span className="top-card-image">
                  {renderPoster?.(solution) ?? <Poster id={solution.id} name={solution.name} area={area} src={solution.thumbnail} className="h-full w-full" />}
                </span>
                <span className="top-card-body">
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <AreaTag area={area} size="2xs" />
                    {heart && <FavoriteButton id={solution.id} name={solution.name} className="relative z-[2] -my-1.5 -mr-1 h-8 w-8" saved={heart.saved} pending={heart.pending} onToggle={heart.onToggle} />}
                  </span>
                  <span className="line-clamp-1 text-[15px] leading-snug font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{solution.name}</span>
                  <span className="line-clamp-2 text-[12.5px] leading-snug" style={{ color: "var(--ink-2)" }}>{solution.summary}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ShelfButton({ label, icon, disabled, onClick }: { label: string; icon: "chevronLeft" | "chevronRight"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="glass grid h-9 w-9 cursor-pointer place-items-center rounded-full transition-opacity disabled:cursor-default disabled:opacity-35"
    >
      <Icon name={icon} size={15} />
    </button>
  );
}
