import type { Solution } from "../types";
import type { KeyboardEvent, ReactNode } from "react";
import { AreaTag, Chip, StatusPill, SubmissionStatus } from "./Badges";
import { Icon } from "./Icon";
import { Poster } from "./Poster";
import { navigate } from "../lib/router";
import { initials } from "../lib/powerContext";
import { solutionAreas } from "../lib/areas";
import { solutionAge } from "../lib/sort";
import { submissionState } from "../lib/submissionState";
import { FavoriteButton } from "./FavoriteButton";

/** Submission workspace controls. `actions` replace "Open" in the footer; `onFeedback` adds "View feedback" to a returned card. */
export type CardManagement = { actions: ReactNode; onFeedback?: () => void };

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
  manage,
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
  /** Turns the title into the card's open button, so the management controls never nest inside another button. */
  manage?: CardManagement;
}) {
  const clientLine = present ? solution.clientContextRedacted : solution.clientContext;
  // Present mode never shows builder names, regardless of what the caller passed.
  const names = present ? [] : contributorNames ?? solution.contributorNames ?? solution.contributors.filter(contributor => contributor.contributorRole !== "CSM").map(contributor => contributor.builtBy.name);
  const builderNames = names.join(", ");
  const age = solutionAge(solution);
  const publicationStatus = showPublicationStatus && !present ? submissionState(solution) : undefined;
  const managed = !!manage && !present;
  const open = () => onOpen ? onOpen() : navigate(`/s/${solution.id}`);

  // The heart is a sibling of the card, not a child: the card itself is a button. A managed card is not a button;
  // its title's stretched button covers the card and the management controls sit above it.
  return (
    <div className="card-shell animate-rise relative grid min-w-0" style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}>
    <div
      className="solution-card glass glass-lite glass-sheen lift group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-[22px] [overflow-wrap:anywhere]"
      {...(managed ? {} : {
        onClick: open,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        },
        tabIndex: 0,
        role: "button",
        "aria-label": `${solution.name} — ${solution.summary}${publicationStatus ? ` — ${publicationStatus}` : ""}`,
      })}
    >
      {/* 16:9 keeps the image generous and every card the same height; callers' posters fill it. */}
      <div className="card-poster relative aspect-[16/9] overflow-hidden">
        {poster ?? <Poster
          id={solution.id}
          name={solution.name}
          area={solution.specializationArea}
          src={solution.thumbnail}
          className="h-full w-full"
        />}
        <div className="absolute top-3 left-3">
          <StatusPill status={solution.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-5 pt-4 pb-4">
        <div className="flex flex-wrap gap-1.5">{solutionAreas(solution).map((area) => <AreaTag key={area} area={area} size="xs" />)}</div>

        <h3 className="text-[18px] leading-snug font-semibold" style={{ color: "var(--ink)" }}>
          {managed ? (
            <button type="button" className="card-open cursor-pointer text-left" onClick={open} aria-label={`${solution.name}${publicationStatus ? ` — ${publicationStatus}` : ""}`}>
              {solution.name}
            </button>
          ) : solution.name}
        </h3>

        <p className="line-clamp-2 text-[14px] leading-snug" style={{ color: "var(--ink-2)" }}>
          {solution.summary}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
          {solution.capabilities.slice(0, 2).map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
          {solution.technologies.slice(0, 1).map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      </div>

      {publicationStatus && (
        // Only the state that asks the contributor to act takes a tint, so it stands out when scanning the grid.
        <div
          className="flex min-h-[52px] flex-col justify-center gap-1 px-5 py-2.5"
          style={publicationStatus === "Changes requested" ? {
            borderTop: "1px solid color-mix(in srgb, var(--proto) 30%, transparent)",
            boxShadow: "inset 3px 0 0 var(--proto)",
            background: "color-mix(in srgb, var(--proto) 9%, transparent)",
          } : { borderTop: "1px solid var(--glass-edge)" }}
        >
          <SubmissionStatus state={publicationStatus} />
          {managed && manage?.onFeedback && publicationStatus === "Changes requested" && (
            <button
              type="button"
              onClick={manage.onFeedback}
              aria-label={`View feedback for ${solution.name}`}
              className="card-control inline-flex w-fit cursor-pointer items-center gap-1 text-[13px] font-semibold hover:underline"
              style={{ color: "var(--accent)" }}
            >
              View feedback
              <Icon name="arrowRight" size={13} />
            </button>
          )}
        </div>
      )}

      <div
        className="flex items-center justify-between gap-3 px-5 py-3"
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
        <div className="flex shrink-0 items-center gap-3">
          {age && (
            <span
              className="hidden items-center gap-1 font-mono text-[10.5px] sm:inline-flex"
              style={{ color: "var(--ink-3)" }}
              title={age.title}
            >
              <Icon name="clock" size={11} />
              {age.label}
            </span>
          )}
          {managed ? (
            <div className="card-control flex items-center gap-2">{manage?.actions}</div>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform duration-300 group-hover:translate-x-0.5"
              style={{ fontFamily: "var(--font-display)", color: "var(--accent)" }}
            >
              Open
              <Icon name="arrowRight" size={14} />
            </span>
          )}
        </div>
      </div>
    </div>
    {favoritable && !present && <FavoriteButton id={solution.id} name={solution.name} className="card-heart absolute top-3 right-3 z-10" saved={favorite?.saved} pending={favorite?.pending} onToggle={favorite?.onToggle} />}
    </div>
  );
}
