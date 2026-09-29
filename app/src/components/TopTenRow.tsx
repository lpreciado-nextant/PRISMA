import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Solution } from "../types";
import { AREAS } from "../data/catalogueMetadata";
import { solutionAreas } from "../lib/areas";
import { navigate } from "../lib/router";
import { AreaTag } from "./Badges";
import { Icon } from "./Icon";
import { Poster } from "./Poster";

const OPEN_KEY = "prisma.top10.open";

function readOpen(): boolean {
  try { return localStorage.getItem(OPEN_KEY) === "true"; } catch { return false; }
}

function accentOf(solution: Solution): string {
  return AREAS[solutionAreas(solution)[0] ?? solution.specializationArea].cssVar;
}

/**
 * "Top 10" shelf: the team's most-saved solutions, best first. Collapsed, it shows
 * the podium as compact pills; open, a horizontal row with rank numerals behind
 * each glass tile. Order comes from the caller; this component never sees how
 * many times a solution was saved. The open state is a per-viewer convenience.
 */
export function TopTenRow({ solutions, renderPoster, onOpen }: {
  solutions: Solution[];
  /** Replaces the generated poster, e.g. with a protected Dataverse thumbnail. */
  renderPoster?: (solution: Solution) => ReactNode;
  onOpen?: (solution: Solution) => void;
}) {
  const [open, setOpen] = useState(readOpen);
  const track = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

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
  }, [solutions.length, open]);

  if (solutions.length === 0) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, String(next)); } catch { void 0; }
  };
  const openSolution = (solution: Solution) => onOpen ? onOpen(solution) : navigate(`/s/${solution.id}`);
  const page = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: smooth ? "smooth" : "auto" });
  };
  const podium = solutions.slice(0, 3);
  const rest = solutions.length - podium.length;

  return (
    <section aria-labelledby="top-ten-title" className="section-panel section-panel--featured animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Most saved by the team</p>
          {/* Solid lavender: the tone the PRISMA wordmark gradient reaches at its final "A". */}
          <h2 id="top-ten-title" className="mt-1.5 text-[clamp(2rem,3.4vw,2.75rem)] leading-none font-extrabold" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.045em", color: "var(--sa-ibo)" }}>
            Top {solutions.length}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {open && <>
            <ShelfButton label="Previous solutions" icon="chevronLeft" disabled={edges.start} onClick={() => page(-1)} />
            <ShelfButton label="More solutions" icon="chevronRight" disabled={edges.end} onClick={() => page(1)} />
          </>}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="top-ten-shelf"
            className="glass inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[13px] font-semibold"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink-2)" }}
          >
            {open ? "Hide" : "Show all"}
            <span className={`inline-grid transition-transform duration-300 ${open ? "rotate-180" : ""}`}><Icon name="chevronDown" size={15} /></span>
          </button>
        </div>
      </div>

      <div id="top-ten-shelf">
        {open ? (
          <ol ref={track} className="top-ten-track mt-2" aria-label="Top solutions, most saved first">
            {solutions.map((solution, index) => {
              const rank = index + 1;
              const area = solutionAreas(solution)[0] ?? solution.specializationArea;
              return (
                <li
                  key={solution.id}
                  className="top-ten-item animate-rise"
                  data-wide={rank >= 10 ? "" : undefined}
                  style={{ "--rank-accent": accentOf(solution), animationDelay: `${Math.min(index, 9) * 45}ms` } as CSSProperties}
                >
                  <span className="top-rank" data-podium={rank <= 3 ? "" : undefined} aria-hidden="true">{rank}</span>
                  <button type="button" onClick={() => openSolution(solution)} className="top-ten-tile glass glass-lite glass-sheen lift group">
                    <span className="sr-only">Number {rank}: </span>
                    <span className="top-ten-poster">
                      {renderPoster?.(solution) ?? <Poster id={solution.id} name={solution.name} area={area} src={solution.thumbnail} className="h-full w-full" />}
                    </span>
                    <span className="flex flex-1 flex-col gap-2 p-4">
                      <span className="flex flex-wrap gap-1.5">{solutionAreas(solution).map((tag) => <AreaTag key={tag} area={tag} size="xs" short />)}</span>
                      <span className="line-clamp-2 text-[16.5px] leading-snug font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{solution.name}</span>
                      <span className="line-clamp-2 text-[13px] leading-snug" style={{ color: "var(--ink-3)" }}>{solution.summary}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <ol className="mt-4 flex flex-wrap items-center gap-2.5" aria-label="Top three solutions">
            {podium.map((solution, index) => (
              <li key={solution.id} className="min-w-0 animate-rise" style={{ "--rank-accent": accentOf(solution), animationDelay: `${index * 45}ms` } as CSSProperties}>
                <button type="button" onClick={() => openSolution(solution)} className="top-pill glass glass-lite lift">
                  <span className="top-pill-rank prism-text" aria-hidden="true">{index + 1}</span>
                  <span className="sr-only">Number {index + 1}: </span>
                  <span className="truncate">{solution.name}</span>
                </button>
              </li>
            ))}
            {rest > 0 && (
              <li>
                <button type="button" onClick={toggle} className="cursor-pointer px-2 font-mono text-[11.5px] tracking-[0.08em] uppercase" style={{ color: "var(--ink-3)" }}>
                  +{rest} more
                </button>
              </li>
            )}
          </ol>
        )}
      </div>
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
      className="glass grid h-10 w-10 cursor-pointer place-items-center rounded-full transition-opacity disabled:cursor-default disabled:opacity-35"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
