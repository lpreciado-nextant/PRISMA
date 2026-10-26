import type { ReactNode } from "react";
import type { Solution } from "../types";
import type { CardManagement } from "./SolutionCard";
import { SubmissionStatus } from "./Badges";
import { Icon } from "./Icon";
import { Poster, PosterTint } from "./Poster";
import { submissionState } from "../lib/submissionState";

/**
 * List-view row for My submissions: the same management as the card (status, new suggestions,
 * View feedback, Edit, •••) on one compact line. The name is the open button, stretched over the row, so the controls
 * sit beside it rather than inside it. A returned row glows amber, one with pending suggestions blue. `poster` replaces
 * the generated poster (the connected app's protected thumbnail).
 */
export function SubmissionRow({ solution, index, manage, onOpen, poster }: { solution: Solution; index: number; manage: CardManagement; onOpen: () => void; poster?: ReactNode }) {
  const state = submissionState(solution);
  const name = solution.name || "Untitled solution";
  const tone = manage.actionNeeded ? "submission-row--changes" : manage.unread ? "submission-row--new" : "";
  const signal = manage.onFeedback
    ? <button type="button" onClick={manage.onFeedback} aria-label={`View feedback for ${name}`} className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold hover:underline" style={{ color: "var(--accent)" }}>View feedback<Icon name="arrowRight" size={13} /></button>
    : !manage.actionNeeded && !!manage.unread && <span className="new-feedback"><Icon name="message" size={12} />{manage.unread} pending {manage.unread === 1 ? "suggestion" : "suggestions"}</span>;
  // Fixed columns from small screens up, so every row lines up: image · name and summary · state · signal · actions.
  return <div className={`submission-row solution-card animate-rise relative grid min-w-0 items-center gap-x-4 gap-y-2 rounded-[16px] p-2.5 pr-3 ${tone}`} style={{ animationDelay: `${Math.min(index, 9) * 30}ms` }}>
    <div className="card-poster aspect-[16/9] w-[104px] shrink-0 overflow-hidden rounded-[10px]">
      <PosterTint solution={solution}>{poster ?? <Poster id={solution.id} name={name} area={solution.specializationArea} src={solution.thumbnail} className="h-full w-full" />}</PosterTint>
    </div>
    <div className="min-w-0">
      <button type="button" className="card-open block max-w-full cursor-pointer truncate text-left text-[15px] font-semibold" onClick={onOpen} aria-label={`${name} — ${state}`}>{name}</button>
      <p className="truncate text-[13px]" style={{ color: "var(--ink-2)" }}>{solution.summary || "No summary yet"}</p>
    </div>
    <div className="submission-row-state"><SubmissionStatus state={state} /></div>
    <div className="submission-row-signal card-control min-w-0">{signal}</div>
    <div className="submission-row-actions card-control flex items-center justify-end gap-2">
      {manage.corner}
      {manage.actions}
    </div>
  </div>;
}
