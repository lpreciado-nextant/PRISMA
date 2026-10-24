import type { Solution } from "../types";
import type { KeyboardEvent, ReactNode } from "react";
import { AreaTag, StatusPill, SubmissionStatus } from "./Badges";
import { Icon } from "./Icon";
import { Poster, PosterTint } from "./Poster";
import { navigate } from "../lib/router";
import { isCustomerSuccessLevel } from "../lib/consultantLevel";
import { initials } from "../lib/powerContext";
import { solutionAreas } from "../lib/areas";
import { solutionAge } from "../lib/sort";
import { submissionState } from "../lib/submissionState";
import { FavoriteButton } from "./FavoriteButton";

/**
 * Submission workspace controls. `actions` replace "Open" in the footer; `corner` sits on the image's top-right corner
 * (e.g. Edit on a draft); `onFeedback` adds "View feedback" to a returned card; `unread` (open feedback items) lights
 * the card's edge and shows "N new" until the owner addresses them.
 */
/** `actionNeeded`: the librarian returned it (Changes requested); it outranks `unread` with an amber glow (the band already says so). */
export type CardManagement = { actions: ReactNode; corner?: ReactNode; onFeedback?: () => void; unread?: number; actionNeeded?: boolean };

/** One line of tags that never wraps: each truncates with an ellipsis, then "+N" for the rest. */
function CardTags({ tags, more }: { tags: string[]; more: number }) {
  return <div className={`mt-auto flex h-[30px] min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden pt-1.5 ${tags.length === 1 ? "card-tags--single" : ""}`} style={{ boxSizing: "content-box" }}>
    {tags.map(tag => <span key={tag} title={tag} className="card-tag">{tag}</span>)}
    {more > 0 && <span className="card-tag card-tag--more" title={`${more} more`}>+{more}</span>}
  </div>;
}

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
  const names = present ? [] : contributorNames ?? solution.contributorNames ?? solution.contributors.filter(contributor => !isCustomerSuccessLevel(contributor.builtBy.level)).map(contributor => contributor.builtBy.name);
  const builderNames = names.join(", ");
  const age = solutionAge(solution);
  const publicationStatus = showPublicationStatus && !present ? submissionState(solution) : undefined;
  const managed = !!manage && !present;
  const open = () => onOpen ? onOpen() : navigate(`/s/${solution.id}`);

  // The heart is a sibling of the card, not a child: the card itself is a button. A managed card is not a button;
  // its title's stretched button covers the card and the management controls sit above it.
  return (
    <div className={`card-shell animate-rise relative grid min-w-0 ${managed && manage?.actionNeeded ? "card-unread card-action" : managed && manage?.unread ? "card-unread" : ""}`} style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}>
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
        <PosterTint solution={solution}>
          {poster ?? <Poster
            id={solution.id}
            name={solution.name}
            area={solution.specializationArea}
            src={solution.thumbnail}
            className="h-full w-full"
          />}
        </PosterTint>
        <div className="absolute top-3 left-3">
          <StatusPill status={solution.status} />
        </div>
        {/* Above the title's stretched open button, like the footer controls. */}
        {managed && manage?.corner && <div className="absolute top-3 right-3 z-[2]">{manage.corner}</div>}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-5 pt-4 pb-4">
        {/* Fixed slots: one line of areas, two of title, two of summary, one of tags, so every card lines up. */}
        {/* Several areas use their initials (AI, DS, IBO) so they always fit one line; the full name is in the tooltip. */}
        <div className="flex h-[22px] flex-nowrap gap-1.5 overflow-hidden">{solutionAreas(solution).map((area, _, all) => <AreaTag key={area} area={area} size="xs" short={all.length > 1} />)}</div>

        {/* Title and summary share a fixed block (two lines each), so the summary follows a short title closely. */}
        <div className="card-copy flex flex-col gap-2">
          <h3 className="card-title line-clamp-2 text-[18px] leading-snug font-semibold" style={{ color: "var(--ink)" }}>
            {managed ? (
              <button type="button" className="card-open line-clamp-2 cursor-pointer text-left" onClick={open} aria-label={`${solution.name}${publicationStatus ? ` — ${publicationStatus}` : ""}`}>
                {solution.name}
              </button>
            ) : solution.name}
          </h3>
          <p className="card-summary line-clamp-2 text-[14px] leading-snug" style={{ color: "var(--ink-2)" }}>
            {solution.summary}
          </p>
        </div>

        <CardTags tags={[...solution.capabilities.slice(0, 1), ...solution.technologies.slice(0, 1)]} more={Math.max(0, solution.capabilities.length - 1) + Math.max(0, solution.technologies.length - 1)} />
      </div>

      {publicationStatus && (
        // Only the state that asks the contributor to act takes a tint, so it stands out when scanning the grid.
        <div
          className="flex h-[52px] items-center px-5"
          style={publicationStatus === "Changes requested" ? {
            borderTop: "1px solid color-mix(in srgb, var(--proto) 30%, transparent)",
            boxShadow: "inset 3px 0 0 var(--proto)",
            background: "color-mix(in srgb, var(--proto) 9%, transparent)",
          } : { borderTop: "1px solid var(--glass-edge)" }}
        >
          {/* One line: the state on the left, its one signal on the right (View feedback or new suggestions). */}
          <span className="flex w-full min-w-0 items-center justify-between gap-2">
            <SubmissionStatus state={publicationStatus} />
            {managed && manage?.onFeedback && (publicationStatus === "Changes requested" || publicationStatus === "Retired") ? (
              <button
                type="button"
                onClick={manage.onFeedback}
                aria-label={`View feedback for ${solution.name}`}
                className="card-control inline-flex shrink-0 cursor-pointer items-center gap-1 text-[13px] font-semibold hover:underline"
                style={{ color: "var(--accent)" }}
              >
                View feedback
                <Icon name="arrowRight" size={13} />
              </button>
            ) : managed && !manage?.actionNeeded && !!manage?.unread && <span className="new-feedback shrink-0"><Icon name="message" size={12} />{manage.unread} pending {manage.unread === 1 ? "suggestion" : "suggestions"}</span>}
          </span>
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
