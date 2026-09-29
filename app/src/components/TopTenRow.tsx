import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Solution } from "../types";
import { AREAS } from "../data/catalogueMetadata";
import { solutionAreas } from "../lib/areas";
import { navigate } from "../lib/router";
import { AreaTag } from "./Badges";
import { Icon } from "./Icon";
import { Poster } from "./Poster";

/**
 * "Top 10" shelf: the team's most-saved solutions, best first, as a horizontal
 * row with oversized rank numerals behind each tile. Order comes from the caller;
 * this component never sees how many times a solution was saved.
 */
export function TopTenRow({ solutions, renderPoster, onOpen }: {
  solutions: Solution[];
  /** Replaces the generated poster, e.g. with a protected Dataverse thumbnail. */
  renderPoster?: (solution: Solution) => ReactNode;
  onOpen?: (solution: Solution) => void;
}) {
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
  }, [solutions.length]);

  if (solutions.length === 0) return null;

  const page = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <section aria-labelledby="top-ten-title" className="animate-rise">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Most saved by the team</p>
          <h2 id="top-ten-title" className="mt-1 text-[clamp(1.7rem,2.8vw,2.3rem)] leading-none font-bold" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.035em" }}>
            Top <span className="prisma-wordmark">{solutions.length}</span> in PRISMA
          </h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <ShelfButton label="Previous solutions" icon="chevronLeft" disabled={edges.start} onClick={() => page(-1)} />
          <ShelfButton label="More solutions" icon="chevronRight" disabled={edges.end} onClick={() => page(1)} />
        </div>
      </div>

      <ol ref={track} className="top-ten-track mt-3" aria-label="Top solutions, most saved first">
        {solutions.map((solution, index) => {
          const rank = index + 1;
          const area = solutionAreas(solution)[0] ?? solution.specializationArea;
          return (
            <li
              key={solution.id}
              className="top-ten-item animate-rise"
              data-wide={rank >= 10 ? "" : undefined}
              style={{ "--rank-accent": AREAS[area].cssVar, animationDelay: `${Math.min(index, 9) * 55}ms` } as CSSProperties}
            >
              <span className="top-rank" data-podium={rank <= 3 ? "" : undefined} aria-hidden="true">{rank}</span>
              <button
                type="button"
                onClick={() => onOpen ? onOpen(solution) : navigate(`/s/${solution.id}`)}
                className="top-ten-tile glass glass-lite glass-sheen lift group"
              >
                <span className="sr-only">Number {rank}: </span>
                <span className="block h-[128px] overflow-hidden">
                  {renderPoster?.(solution) ?? <Poster id={solution.id} name={solution.name} area={area} src={solution.thumbnail} className="h-full w-full" />}
                </span>
                <span className="flex flex-1 flex-col gap-2 p-4">
                  <span className="flex flex-wrap gap-1.5">{solutionAreas(solution).slice(0, 2).map((tag) => <AreaTag key={tag} area={tag} />)}</span>
                  <span className="line-clamp-2 text-[16.5px] leading-snug font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{solution.name}</span>
                  <span className="line-clamp-2 text-[13px] leading-snug" style={{ color: "var(--ink-3)" }}>{solution.summary}</span>
                </span>
              </button>
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
      className="glass grid h-10 w-10 cursor-pointer place-items-center rounded-full transition-opacity disabled:cursor-default disabled:opacity-35"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
