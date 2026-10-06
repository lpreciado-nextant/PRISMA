import { useId, type ReactNode } from "react";
import { SUBMISSION_COLOR, type SubmissionState } from "../lib/submissionState";
import { Icon, type IconName } from "./Icon";

const STATES: Record<SubmissionState, { icon: IconName; detail: string; feedback: string }> = {
  Draft: { icon: "file", detail: "Not submitted yet. Finish it and submit it for review.", feedback: "Latest review comments" },
  "Pending review": { icon: "clock", detail: "Waiting for a librarian. Withdraw it if you need to keep editing.", feedback: "Resubmitted after this feedback" },
  "Changes requested": { icon: "alert", detail: "The librarian sent it back. Update it and submit it again.", feedback: "Librarian feedback" },
  Published: { icon: "check", detail: "Live in the library: CSMs can find it and present it.", feedback: "Note from the librarian" },
  Retired: { icon: "eyeOff", detail: "Taken out of the library. Nothing was deleted; update it and resubmit it for approval.", feedback: "Reason for retiring" },
};

/**
 * The owner's view of where a submission stands, in the review panel's idiom: the state colour tints the card, the
 * actions sit on the right, and the librarian's words follow underneath.
 */
export function SubmissionStatusPanel({ state, feedback, actions, local = false, children }: {
  state: SubmissionState;
  feedback?: string;
  /** Buttons for this state (Edit, Submit, Withdraw), shown on the right. */
  actions?: ReactNode;
  local?: boolean;
  /** Notices, requirements and errors below the header. */
  children?: ReactNode;
}) {
  const heading = useId();
  const color = SUBMISSION_COLOR[state];
  const meta = STATES[state];
  return <section aria-labelledby={heading} className="relative mt-5 overflow-hidden rounded-[22px] border p-5 sm:p-6"
    style={{ borderColor: `color-mix(in srgb, ${color} 34%, transparent)`, background: `linear-gradient(180deg, color-mix(in srgb, ${color} 12%, transparent), color-mix(in srgb, ${color} 3%, transparent))` }}>
    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-1 basis-72 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}><Icon name={meta.icon} size={19} /></span>
        <div className="min-w-0">
          <p className="eyebrow">Your submission{local && " · local preview"}</p>
          <h2 id={heading} className="mt-1 text-[20px] font-semibold" style={{ color }}>{state}</h2>
          <p className="mt-0.5 text-[13.5px] text-(--ink-2)">{meta.detail}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 sm:ml-auto">{actions}</div>}
    </div>
    {feedback && <div className="mt-5 border-t border-(--glass-edge) pt-4">
      <h3 className="eyebrow">{meta.feedback}</h3>
      <p className="mt-2 border-l-2 pl-3 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words" style={{ borderColor: color }}>{feedback}</p>
    </div>}
    {children}
  </section>;
}

/** Action buttons for the panel: `primary` fills with the given colour, otherwise an outlined button. */
export const statusButton = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40";
export const outlinedStatusButton = `${statusButton} border border-(--glass-edge) bg-(--ground)/50 hover:border-(--accent)/50`;
