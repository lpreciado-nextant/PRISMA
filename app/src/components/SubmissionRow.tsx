import type { Solution } from "../types";
import type { CardManagement } from "./SolutionCard";
import { SubmissionStatus } from "./Badges";
import { Poster, PosterTint } from "./Poster";
import { submissionState } from "../lib/submissionState";

/**
 * List-view row for My submissions: the same management as the card (status, new suggestions,
 * View feedback, Edit, •••) on one compact line. The name is the open button, stretched over the row, so the controls
 * sit beside it rather than inside it. A returned row takes the amber edge, one with new suggestions the accent.
 */
export function SubmissionRow({ solution, index, manage, onOpen }: { solution: Solution; index: number; manage: CardManagement; onOpen: () => void }) {
  const state = submissionState(solution);
  const name = solution.name || "Untitled solution";
  const tone = manage.actionNeeded ? "submission-row--changes" : manage.unread ? "submission-row--new" : "";
  return <div className={`submission-row solution-card animate-rise relative flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] p-2.5 pr-3 sm:flex-nowrap ${tone}`} style={{ animationDelay: `${Math.min(index, 9) * 30}ms` }}>
    <div className="card-poster aspect-[16/9] w-[104px] shrink-0 overflow-hidden rounded-[10px]">
      <PosterTint solution={solution}><Poster id={solution.id} name={name} area={solution.specializationArea} src={solution.thumbnail} className="h-full w-full" /></PosterTint>
    </div>
    <div className="min-w-0 flex-1 basis-48">
      <button type="button" className="card-open block max-w-full cursor-pointer truncate text-left text-[15px] font-semibold" onClick={onOpen} aria-label={`${name} — ${state}`}>{name}</button>
      <p className="truncate text-[13px]" style={{ color: "var(--ink-2)" }}>{solution.summary || "No summary yet"}</p>
    </div>
    <div className="card-control flex shrink-0 flex-wrap items-center justify-end gap-2">
      <SubmissionStatus state={state} />
      {!manage.actionNeeded && !!manage.unread && <span className="new-feedback"><span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: "var(--accent)" }} />{manage.unread} new {manage.unread === 1 ? "suggestion" : "suggestions"}</span>}
      {manage.onFeedback && <button type="button" onClick={manage.onFeedback} aria-label={`View feedback for ${name}`} className="cursor-pointer text-[13px] font-semibold hover:underline" style={{ color: "var(--accent)" }}>View feedback</button>}
      {manage.corner}
      {manage.actions}
    </div>
  </div>;
}
