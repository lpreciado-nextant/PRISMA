import type { ReactNode } from "react";
import type { Solution } from "../types";
import { AreaTag, Chip, StatusPill } from "./Badges";
import { Icon } from "./Icon";
import { Poster, PosterTint } from "./Poster";
import { FavoriteButton } from "./FavoriteButton";
import { navigate } from "../lib/router";
import { solutionAreas } from "../lib/areas";
import { solutionAge } from "../lib/sort";

/**
 * List-view row for the library: the same solution as a compact horizontal line
 * (thumbnail, areas, name, summary, maturity, capability) for faster scanning.
 * The heart is a sibling of the row, not a child: the row itself is a button. It tops a compact right rail with
 * the age beneath it; the rail lets clicks through to the row except on the heart. The whole row opens, so no arrow.
 */
export function SolutionRow({ solution, present, index, onOpen, poster, favoritable = false, favorite }: {
  solution: Solution;
  present: boolean;
  index: number;
  onOpen?: () => void;
  poster?: ReactNode;
  favoritable?: boolean;
  favorite?: { saved: boolean; pending?: boolean; onToggle: () => void };
}) {
  const open = () => onOpen ? onOpen() : navigate(`/s/${solution.id}`);
  const showHeart = favoritable && !present;
  const age = solutionAge(solution);
  return (
    <div className="animate-rise relative min-w-0" style={{ animationDelay: `${Math.min(index, 9) * 30}ms` }}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${solution.name} — ${solution.summary}`}
        onClick={open}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }}
        className="solution-row solution-card glass glass-lite lift group flex min-w-0 cursor-pointer items-center gap-4 rounded-[16px] p-2.5 pr-14 [overflow-wrap:anywhere]"
      >
        <div className="card-poster aspect-[16/9] w-[132px] shrink-0 overflow-hidden rounded-[10px]">
          <PosterTint solution={solution}>
            {poster ?? <Poster id={solution.id} name={solution.name} area={solution.specializationArea} src={solution.thumbnail} className="h-full w-full" />}
          </PosterTint>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">{solutionAreas(solution).map((area) => <AreaTag key={area} area={area} size="xs" />)}</div>
          <h3 className="mt-1.5 truncate text-[16px] leading-snug font-semibold" style={{ color: "var(--ink)" }}>{solution.name}</h3>
          <p className="truncate text-[13.5px]" style={{ color: "var(--ink-2)" }}>{solution.summary}</p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 md:flex">
          <StatusPill status={solution.status} />
          {solution.capabilities[0] && <Chip>{solution.capabilities[0]}</Chip>}
        </div>
      </div>
      <div className={`pointer-events-none absolute right-2.5 z-10 flex w-9 flex-col items-center gap-1.5 ${showHeart ? "top-2.5" : "inset-y-0 justify-center"}`}>
        {showHeart && <FavoriteButton id={solution.id} name={solution.name} className="pointer-events-auto" saved={favorite?.saved} pending={favorite?.pending} onToggle={favorite?.onToggle} />}
        {age && (
          <span
            className="hidden items-center gap-0.5 font-mono text-[10.5px] whitespace-nowrap sm:inline-flex"
            style={{ color: "var(--ink-3)" }}
            title={age.title}
          >
            <Icon name="clock" size={10} />
            {age.label}
          </span>
        )}
      </div>
    </div>
  );
}
