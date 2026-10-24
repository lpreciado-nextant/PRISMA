import { useId, type ReactNode } from "react";
import { SUBMISSION_COLOR, type SubmissionState } from "../lib/submissionState";
import { Icon, type IconName } from "./Icon";

const STATES: Record<SubmissionState, { icon: IconName; detail: string; feedback: string }> = {
  Draft: { icon: "file", detail: "Not submitted yet. Finish it and submit it for review.", feedback: "Latest review comments" },
  "Pending review": { icon: "clock", detail: "Waiting for a librarian. Withdraw it if you need to keep editing.", feedback: "Resubmitted after this feedback" },
  "Changes requested": { icon: "alert", detail: "The librarian sent it back. Update it and submit it again.", feedback: "Librarian feedback" },
  Published: { icon: "check", detail: "This solution is available in the Solution Library.", feedback: "Note from the librarian" },
  Retired: { icon: "eyeOff", detail: "Taken out of the library. Nothing was deleted; update it and resubmit it for approval.", feedback: "Reason for retiring" },
};

/**
 * The owner's view of where a submission stands: the state as the heading with its icon, one line of meaning, the
 * actions on the right behind a divider, and the librarian's words underneath. A faint state tint, no extra labels.
 */
export function SubmissionStatusPanel({ state, feedback, edited, feedbackAction, badge, actions, local = false, children }: {
  state: SubmissionState;
  feedback?: string;
  /** Date a librarian last edited the solution (ADR-0013); their explanation is the feedback. Connected only. */
  edited?: string;
  /** Beside the librarian's words, e.g. the owner's "Mark as addressed" check. */
  feedbackAction?: ReactNode;
  /** Beside the state heading, e.g. a "2 new suggestions" bubble. */
  badge?: ReactNode;
  /** Buttons for this state (Edit, Submit, Withdraw), shown on the right. */
  actions?: ReactNode;
  local?: boolean;
  /** Notices, requirements and errors below the header. */
  children?: ReactNode;
}) {
  const heading = useId();
  const color = SUBMISSION_COLOR[state];
  const meta = STATES[state];
  return <section aria-labelledby={heading} className="mt-5 rounded-[18px] border px-4 py-3.5 sm:px-5"
    style={{ borderColor: `color-mix(in srgb, ${color} 30%, transparent)`, background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}><Icon name={meta.icon} size={16} /></span>
        <div className="min-w-0">
          <h2 id={heading} className="flex flex-wrap items-center gap-2 text-[17px] leading-tight font-semibold" style={{ color }}>{state}{badge}</h2>
          <p className="mt-0.5 text-[13.5px] text-(--ink-2)">{meta.detail}{local && <span className="text-(--ink-3)"> · Local preview</span>}</p>
          {edited && <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--accent)" }}><Icon name="edit" size={13} />Edited by the librarian · {edited}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 sm:ml-auto sm:border-l sm:border-(--glass-edge) sm:pl-5">{actions}</div>}
    </div>
    {feedback && <div className="mt-3.5 border-t border-(--glass-edge) pt-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="eyebrow">{meta.feedback}</h3>{feedbackAction}</div>
      <p className="mt-2 border-l-2 pl-3 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words" style={{ borderColor: color }}>{feedback}</p>
    </div>}
    {children}
  </section>;
}

/** Action buttons for the panel: `primary` fills with the given colour, otherwise an outlined button. */
export const statusButton = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40";
export const outlinedStatusButton = `${statusButton} border border-(--glass-edge) bg-(--ground)/50 hover:border-(--accent)/50`;
/** A quiet secondary action (e.g. Unpublish & edit): no fill or border until hovered. */
export const subtleStatusButton = "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold text-(--ink-2) hover:bg-(--glass-edge) hover:text-(--ink) disabled:cursor-not-allowed disabled:opacity-40";
