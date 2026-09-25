import type { Solution } from "../types";
import type { ReactNode } from "react";
import { AreaTag, Chip, StatusPill } from "./Badges";
import { Icon } from "./Icon";
import { Poster } from "./Poster";
import { navigate } from "../lib/router";
import { initials } from "../lib/powerContext";
import { solutionAreas } from "../lib/areas";
import { FavoriteButton } from "./FavoriteButton";

export function SolutionCard({
  solution,
  present,
  index,
  onOpen,
  showPublicationStatus = false,
  catalogueOnly = false,
  poster,
  contributorNames,
  favoritable = false,
  favorite,
}: {
  solution: Solution;
  present: boolean;
  index: number;
  onOpen?: () => void;
  showPublicationStatus?: boolean;
  catalogueOnly?: boolean;
  poster?: ReactNode;
  contributorNames?: string[];
  /** Shows the favorites heart (hidden in present mode). */
  favoritable?: boolean;
  /** Controls the favorite heart instead of the PoC's local browser-only store. */
  favorite?: { saved: boolean; pending?: boolean; onToggle: () => void };
}) {
  const clientLine = present ? solution.clientContextRedacted : solution.clientContext;
  // Present mode never shows builder names, regardless of what the caller passed.
  const names = present ? [] : contributorNames ?? solution.contributorNames ?? solution.contributors.filter(contributor => contributor.contributorRole !== "CSM").map(contributor => contributor.builtBy.name);
  const builderNames = names.join(", ");
  const publicationStatus = showPublicationStatus && !present
    ? solution.publicationStatus === "Draft" && solution.reviewOutcome === "Changes requested" ? "Changes requested" : solution.publicationStatus
    : undefined;

  // The heart is a sibling of the card, not a child: the card itself is a button.
  return (
    <div className="animate-rise relative grid min-w-0" style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}>
    <article
      className="glass glass-lite glass-sheen lift group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-[22px] [overflow-wrap:anywhere]"
      onClick={() => onOpen ? onOpen() : navigate(`/s/${solution.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (onOpen) onOpen();
          else navigate(`/s/${solution.id}`);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${solution.name} — ${solution.summary}${publicationStatus ? ` — ${publicationStatus}` : ""}`}
    >
      <div className="relative">
        {poster ?? <Poster
          id={solution.id}
          name={solution.name}
          area={solution.specializationArea}
          src={solution.thumbnail}
          className="h-36"
        />}
        <div className="absolute top-3 left-3">
          <StatusPill status={solution.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-1.5">{solutionAreas(solution).map((area) => <AreaTag key={area} area={area} />)}</div>

        <h3 className="text-[19px] leading-snug font-semibold" style={{ color: "var(--ink)" }}>
          {solution.name}
        </h3>

        <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {solution.summary}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {solution.capabilities.slice(0, 2).map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
          {solution.technologies.slice(0, 1).map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
        {publicationStatus && <span className="text-[13px] font-semibold" style={{ color: solution.publicationStatus === "Published" ? "var(--live)" : "var(--proto)" }}>{publicationStatus}</span>}
      </div>

      <div
        className="flex items-center justify-between gap-3 px-5 py-3.5"
        style={{
          borderTop: "1px solid var(--glass-edge)",
          background: "color-mix(in srgb, var(--ink) 4%, transparent)",
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[10px] font-medium"
            style={{
              background: "color-mix(in srgb, var(--accent) 22%, transparent)",
              color: "var(--accent)",
            }}
          >
            {names.length > 1 ? names.length : initials(builderNames)}
          </span>
          <span className="truncate text-[13px]" title={builderNames} style={{ color: "var(--ink-3)" }}>
            {clientLine ?? (builderNames || (catalogueOnly || present ? "Published solution" : "Contributors pending"))}
          </span>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold transition-transform duration-300 group-hover:translate-x-0.5"
          style={{ fontFamily: "var(--font-display)", color: "var(--accent)" }}
        >
          Open
          <Icon name="arrowRight" size={14} />
        </span>
      </div>
    </article>
    {favoritable && !present && <FavoriteButton id={solution.id} name={solution.name} className="absolute top-3 right-3 z-10" saved={favorite?.saved} pending={favorite?.pending} onToggle={favorite?.onToggle} />}
    </div>
  );
}
