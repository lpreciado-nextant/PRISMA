import { useId, useState, type CSSProperties, type ReactNode } from "react";
import type { Solution, SpecializationArea } from "../types";
import { AREA_ORDER, AREAS } from "../data/catalogueMetadata";
import { navigate } from "../lib/router";
import { OverflowMenu } from "./OverflowMenu";
import { Icon, type IconName } from "./Icon";
import { LoadingState } from "./LoadingState";
import { SelectPicker } from "./SelectPicker";
import { solutionAreas } from "../lib/areas";
import { submissionState } from "../lib/submissionState";
import type { ReviewCheck } from "../lib/reviewChecklist";
import { AreaTag } from "./Badges";
import { Notice } from "./Notice";

const filters = ["Pending review", "Changes requested", "Published"] as const;
type Entry = { solution: Solution; owner?: string; imageCount?: number; attachmentCount?: number };
const matches = ({ solution }: Entry, status: string) => submissionState(solution) === status;

type Choice<Value extends string> = { value: Value; title: string; detail: string; icon: IconName; color: string };
type Decision = "publish" | "changes";
const DECISIONS: Choice<Decision>[] = [
  { value: "publish", title: "Approve", detail: "The solution is ready for publication.", icon: "check", color: "var(--live)" },
  { value: "changes", title: "Request changes", detail: "Return it to the submitter with required feedback.", icon: "alert", color: "var(--proto)" },
];
/** What the librarian confirms before approving; all are required. Informational to the server, which still checks content. */
const PUBLICATION_CHECKLIST = [
  "Images, screenshots, videos and attachments expose no confidential information, personal data (PII) or sensitive client details.",
  "Client names, logos and identifying details are anonymized, unless publication is explicitly authorized.",
  "Descriptions are accurate, clear, professionally written and free of confidential business information.",
  "Demos, links and supporting documents are appropriate for the intended audience.",
  "Capability, specialization area and other metadata classify the solution correctly.",
] as const;
/** A returned submission needs feedback the submitter can act on, not a one-word note. */
const MIN_CHANGE_COMMENT = 15;
/** Compact secondary buttons for the published row and its Cancel. */
/** The librarian's primary "Edit solution": filled, so it never reads like the take-it-out actions beside it. */
const primaryAction = "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-40";
const compactAction = "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-(--glass-edge) bg-(--ground)/50 px-3 py-1.5 text-[13.5px] font-semibold text-(--ink-2) hover:text-(--ink) disabled:cursor-not-allowed disabled:opacity-40";

/** One option of a decision, as a selectable card backed by a native radio (arrow keys move between options). */
function ChoiceCard<Value extends string>({ name, option, selected, onSelect }: { name: string; option: Choice<Value>; selected: boolean; onSelect: () => void }) {
  // Unselected, it takes a hint of its own colour on hover, so the choice reads before it is made.
  return <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--accent) ${selected ? "" : "border-(--glass-edge) bg-(--ink)/3 hover:border-[color-mix(in_srgb,var(--choice)_55%,transparent)] hover:bg-[color-mix(in_srgb,var(--choice)_8%,transparent)]"}`}
    style={selected ? { borderColor: option.color, background: `color-mix(in srgb, ${option.color} 12%, transparent)` } : { "--choice": option.color } as CSSProperties}>
    <input type="radio" name={name} value={option.value} checked={selected} onChange={onSelect} className="sr-only" />
    <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ color: option.color, background: `color-mix(in srgb, ${option.color} 16%, transparent)` }}><Icon name={option.icon} size={16} /></span>
    <span className="min-w-0">
      <span className="block text-[15px] font-semibold" style={selected ? { color: option.color } : undefined}>{option.title}</span>
      <span className="mt-0.5 block text-[13.5px] text-(--ink-2)">{option.detail}</span>
    </span>
  </label>;
}
/** The review panel's inner sections: one subtle border each, so overview, checklist and decision read apart. */
const reviewSection = "mt-5 rounded-xl border border-(--glass-edge) px-4 py-4 sm:px-5";
function OverviewRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-[12px] text-(--ink-3)">{label}</dt><dd className="mt-0.5 break-words">{children}</dd></div>;
}
const textArea = "mt-2 block w-full resize-y rounded-lg border border-(--glass-edge) bg-(--ground)/60 px-3 py-2 text-[14px] font-normal";

/**
 * Librarian controls above the submission preview: status, Solution overview, Publication checklist, then one decision at
 * a time. Approval needs required content and every checklist item confirmed (sent as the client-safety clearance);
 * sending back needs a comment of at least MIN_CHANGE_COMMENT characters. The comment is shared state: an optional note
 * on approval (approval replaces the stored feedback, or clears it when blank). Transitions are unchanged.
 *
 * Connected librarians can also edit the solution (ADR-0013). After a real edit the comment becomes required: on
 * approval for a pending record, or through "Confirm changes" for a published one, which repeats the checklist.
 */
export function ReviewPanel({ status, owner, client, context, feedback, solution, capabilityOwner, checks, comments, onComments, cleared, onCleared, busy, locked = false, canApprove = true, local = false, notice, noticeBusy = false, error, onReturn, onApprove, defaultDecision, onRequestChanges, onRetire, onEdit, editBlocked, edit, onConfirmEdit, children }: {
  status: string; owner?: string; client?: string; context?: string; feedback?: string;
  /** The capability's owner from `nx_capability.nx_capabilityowner`: a name, `null` when none is assigned, omitted when unknown. */
  capabilityOwner?: string | null;
  /** Classification and resubmission state; omitted, the checklist shows client safety only. */
  solution?: Solution; checks?: ReviewCheck[];
  comments: string; onComments: (value: string) => void;
  cleared: boolean; onCleared: (value: boolean) => void; busy: boolean; locked?: boolean; canApprove?: boolean; local?: boolean;
  notice?: ReactNode; noticeBusy?: boolean; error?: ReactNode; onReturn: () => void; onApprove: () => void; defaultDecision?: Decision;
  /** Offered on a published record when the caller may take it out of the library; both send `comments`. */
  onRequestChanges?: () => void; onRetire?: () => void;
  /** Opens the librarian editor for a pending or published record. */
  onEdit?: () => void;
  /** Why Edit is not offered, e.g. the librarian's own solution, which they edit as its owner. */
  editBlocked?: string;
  /** The last librarian edit: when, by whom, and whether the owner has been told yet (`pending`). */
  edit?: { on?: string; by?: string; pending: boolean };
  /** Confirms a published record's unexplained edit with the checklist and the comment. */
  onConfirmEdit?: () => void;
  children?: ReactNode;
}) {
  const heading = useId();
  const [manage, setManage] = useState<"changes" | "retire" | undefined>();
  const [decision, setDecision] = useState<Decision | undefined>(defaultDecision);
  const disabled = busy || locked;
  // A returned record is a Draft awaiting its contributor: say so, and show the feedback as what they are working from.
  const returned = !!solution && submissionState(solution) === "Changes requested";
  const chosen = DECISIONS.find(option => option.value === decision);
  const missingChecks = checks?.filter(check => !check.done) ?? [];
  // Every checklist item must be confirmed; together they are the approval's client-safety clearance.
  const [confirmed, setConfirmed] = useState<boolean[]>(() => PUBLICATION_CHECKLIST.map(() => cleared));
  const confirm = (index: number, value: boolean) => {
    const next = confirmed.map((item, position) => position === index ? value : item);
    setConfirmed(next);
    onCleared(next.every(Boolean));
  };
  const remaining = confirmed.filter(item => !item).length;
  const commentReady = comments.trim().length >= MIN_CHANGE_COMMENT;
  const hint = decision === "changes" ? !commentReady && `Explain what needs to be corrected (at least ${MIN_CHANGE_COMMENT} characters).`
    : decision === "publish" ? !canApprove ? "Add the missing content before approving." : !cleared && `Confirm the publication checklist to approve (${remaining} of ${PUBLICATION_CHECKLIST.length} left).` : undefined;
  const pending = status === "Pending review";
  // A real edit must be explained to the owner: required approval note, or Confirm changes on a published record.
  const explain = !!edit?.pending;
  const publishedEdit = explain && status === "Published" && !!onConfirmEdit;
  const explained = !explain || !!comments.trim();
  const approveHint = explain && decision === "publish" && !comments.trim() ? "You edited this solution. Tell the contributor what you changed and why." : hint;
  return <>
    <section aria-labelledby={heading} className="relative mt-6 overflow-hidden rounded-[22px] border p-5 sm:p-6"
      style={{ borderColor: "color-mix(in srgb, var(--accent) 34%, transparent)", background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 13%, transparent), color-mix(in srgb, var(--accent) 4%, transparent))" }}>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(90deg, var(--accent), var(--sa-ibo), var(--sa-ai))" }} />

      {/* 1 · Review status */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}><Icon name="shield" size={13} />Librarian review{local && " · local preview"}</p>
          <h2 id={heading} className="mt-2 text-[22px]">{returned ? "Changes requested" : status}</h2>
        </div>
        {onEdit && status !== "Published" && <button type="button" disabled={disabled} onClick={onEdit} className={primaryAction} style={{ background: "var(--accent)", color: "var(--on-accent)" }}><Icon name="edit" size={14} />Edit solution</button>}
      </div>
      {!onEdit && editBlocked && <p className="mt-2 flex items-start gap-1.5 text-[13px] text-(--ink-2)"><Icon name="edit" size={13} className="mt-0.5 shrink-0" />{editBlocked}</p>}

      {/* 2 · Solution overview: who and what, from the record's own fields; nothing invented when a value is missing. */}
      <section aria-labelledby={`${heading}-overview`} className={reviewSection}>
        <h3 id={`${heading}-overview`} className="eyebrow">Solution overview</h3>
        <dl className="mt-3 grid gap-x-8 gap-y-3 text-[13.5px] sm:grid-cols-2">
          {solution && <OverviewRow label="Capability">{solution.capabilities[0] ?? <span className="text-(--proto)">Not set</span>}</OverviewRow>}
          {capabilityOwner !== undefined && <OverviewRow label="Capability owner">{capabilityOwner ?? <span className="text-(--ink-3)">Not assigned</span>}</OverviewRow>}
          {solution && <OverviewRow label={solutionAreas(solution).length > 1 ? "Specialization areas" : "Specialization area"}>
            <span className="flex flex-wrap gap-1.5">{solutionAreas(solution).map(area => <AreaTag key={area} area={area} size="xs" />)}</span>
          </OverviewRow>}
          {owner && <OverviewRow label="Submitted by"><span className="break-all">{owner}</span></OverviewRow>}
          {/* Client wording only when the record names a client or a client-facing context; the librarian may read both. */}
          {(client || context) && <OverviewRow label="Client">
            {client && <>{client} <span className="text-(--ink-3)">→ shown as</span> </>}
            <span style={context ? undefined : { color: "var(--proto)" }}>{context ? `“${context}”` : "not provided"}</span>
          </OverviewRow>}
          {edit?.on && <OverviewRow label="Last librarian edit">{edit.by || "Librarian"} · {edit.on}{explain && <span style={{ color: "var(--proto)" }}> · not explained to the owner yet</span>}</OverviewRow>}
        </dl>
        {feedback && !returned && status !== "Published" && <div className="mt-4 border-l-2 border-(--proto) pl-3">
          <h4 className="text-[13.5px] font-semibold">{pending && solution?.reviewOutcome === "Changes requested" ? "Resubmitted after changes requested" : "Latest review comments"}</h4>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-(--ink-2)">{feedback}</p>
        </div>}
      </section>

      {/* 3 · Publication checklist (pending review only): required content first, then what the librarian confirms. */}
      {(pending || publishedEdit) && <section aria-labelledby={`${heading}-checklist`} className={reviewSection}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id={`${heading}-checklist`} className="eyebrow">Publication checklist</h3>
          <span className="font-mono text-[11px] text-(--ink-3)">{PUBLICATION_CHECKLIST.length - remaining} / {PUBLICATION_CHECKLIST.length} confirmed</span>
        </div>
        {missingChecks.length > 0 && <div role="status" className="mt-3 rounded-lg border px-3 py-2 text-[13px]" style={{ color: "var(--proto)", borderColor: "color-mix(in srgb, var(--proto) 35%, transparent)" }}>
          <p className="flex items-center gap-1.5 font-semibold"><Icon name="alert" size={13} />Missing content</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{missingChecks.map(check => <li key={check.label}>{check.label}</li>)}</ul>
        </div>}
        <fieldset disabled={disabled} className="mt-3 min-w-0">
          <legend className="sr-only">Confirm each item before approving</legend>
          <ul className="space-y-2">
            {PUBLICATION_CHECKLIST.map((item, index) => <li key={item}>
              <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-snug">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-(--accent)" checked={confirmed[index]} onChange={event => confirm(index, event.target.checked)} />
                <span style={{ color: confirmed[index] ? "var(--ink)" : "var(--ink-2)" }}>{item}</span>
              </label>
            </li>)}
          </ul>
        </fieldset>
        {children}
      </section>}
      {!pending && !publishedEdit && children}
      {noticeBusy && typeof notice === "string" ? <LoadingState className="mt-3" label={notice} /> : notice && <div role="status" className="mt-3 text-[14px] text-(--ink-2)">{notice}</div>}

      {/* 3 · Review decision, then only the chosen decision's required action. */}
      {returned && <section aria-labelledby={`${heading}-waiting`} className="mt-6 rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--glass-edge)", background: "color-mix(in srgb, var(--ink) 4%, transparent)" }}>
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ color: "var(--ink-2)", background: "color-mix(in srgb, var(--ink) 8%, transparent)" }}><Icon name="clock" size={18} /></span>
          <div className="min-w-0">
            <h3 id={`${heading}-waiting`} className="text-[16px] font-semibold text-(--ink)">Waiting for corrections</h3>
            <p className="mt-0.5 text-[13.5px] text-(--ink-2)">Sent back to the contributor. It returns to Pending review when they resubmit.</p>
          </div>
        </div>
        {feedback && <div className="mt-4 border-t border-(--glass-edge) pt-4">
          <h4 className="eyebrow">Your feedback</h4>
          <p className="mt-2 border-l-2 border-(--ink-3) pl-3 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">{feedback}</p>
        </div>}
      </section>}

      {/* Published: one compact row (status left, actions right). An action's form opens below only once chosen. */}
      {status === "Published" && <section aria-labelledby={`${heading}-live`} className="mt-5 rounded-xl border px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--live) 35%, transparent)", background: "color-mix(in srgb, var(--live) 6%, transparent)" }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full" style={{ color: "var(--live)", background: "color-mix(in srgb, var(--live) 16%, transparent)" }}><Icon name="check" size={14} /></span>
            <p className="min-w-0"><span id={`${heading}-live`} className="text-[15px] font-semibold" style={{ color: "var(--live)" }}>Published</span>
              <span className="text-[13.5px] text-(--ink-2)">{publishedEdit ? " · Left out of present mode until you confirm your changes." : " · Available in the Solution Library."}</span></p>
          </div>
          {!publishedEdit && onEdit && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button type="button" disabled={disabled} onClick={onEdit} className={primaryAction} style={{ background: "var(--accent)", color: "var(--on-accent)" }}><Icon name="edit" size={14} />Edit solution</button>
            {(onRequestChanges || onRetire) && <OverflowMenu label="More actions: take it out of the library" items={[
              ...(onRequestChanges ? [{ label: "Send back to owner…", icon: "chevronLeft" as const, onSelect: () => { onComments(""); setManage("changes"); } }] : []),
              ...(onRetire ? [{ label: "Retire from library…", icon: "eyeOff" as const, onSelect: () => { onComments(""); setManage("retire"); } }] : []),
            ]} />}
          </div>}
          {!publishedEdit && !onEdit && (onRequestChanges || onRetire) && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {onRequestChanges && <button type="button" disabled={disabled} aria-expanded={manage === "changes"} aria-controls={`${heading}-manage`} onClick={() => { onComments(""); setManage(manage === "changes" ? undefined : "changes"); }} className={compactAction} style={manage === "changes" ? { color: "var(--proto)", borderColor: "color-mix(in srgb, var(--proto) 45%, transparent)" } : undefined}><Icon name="alert" size={14} />Request changes</button>}
            {onRetire && <button type="button" disabled={disabled} aria-expanded={manage === "retire"} aria-controls={`${heading}-manage`} onClick={() => { onComments(""); setManage(manage === "retire" ? undefined : "retire"); }} className={compactAction} style={manage === "retire" ? { color: "var(--ink)", borderColor: "var(--ink-3)" } : undefined}><Icon name="eyeOff" size={14} />Retire</button>}
          </div>}
        </div>
        {publishedEdit && <fieldset disabled={disabled} className="animate-rise mt-3 min-w-0 border-t border-(--glass-edge) pt-3">
          <legend className="text-[15px] font-semibold">Confirm your changes</legend>
          <p className="mt-1 text-[13.5px] text-(--ink-2)">Confirm the publication checklist above, then tell the owner what you changed and why. They read it in My submissions.</p>
          <label className="mt-3 block text-[14px] font-semibold">What you changed and why <span className="font-normal text-(--ink-2)">(required)</span>
            <textarea value={comments} onChange={event => onComments(event.target.value)} maxLength={4000} rows={3} required aria-required="true" className={textArea}
              placeholder="For example: “Removed the client name from the title and shortened the summary so it fits the card.”" />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            {(!cleared || !canApprove || !comments.trim()) && <p id={`${heading}-confirm-hint`} className="mr-auto text-[13px] text-(--ink-2)">{!canApprove ? "Add the missing content before confirming." : !cleared ? `Confirm the publication checklist (${remaining} of ${PUBLICATION_CHECKLIST.length} left).` : "Tell the owner what you changed and why."}</p>}
            <button type="button" aria-describedby={cleared && canApprove && comments.trim() ? undefined : `${heading}-confirm-hint`} disabled={!cleared || !canApprove || !comments.trim() || disabled} onClick={onConfirmEdit}
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-semibold text-(--on-accent) disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "var(--live)" }}><Icon name="check" size={15} />Confirm changes</button>
          </div>
        </fieldset>}
        {feedback && !manage && !publishedEdit && <p className="mt-2.5 border-l-2 border-(--live) pl-3 text-[13.5px] whitespace-pre-wrap break-words text-(--ink-2)"><span className="font-semibold text-(--ink)">Your note to the contributor: </span>{feedback}</p>}
        {manage && <fieldset id={`${heading}-manage`} disabled={disabled} className="animate-rise mt-3 min-w-0 border-t border-(--glass-edge) pt-3">
          <legend className="sr-only">{manage === "changes" ? "Request changes" : "Retire from the library"}</legend>
          {/* One line on what each action means, so the two read differently. */}
          <p className="text-[13.5px] text-(--ink-2)">{manage === "changes"
            ? onEdit ? "This is not an edit: it leaves the library, and the owner must make the changes and resubmit. To fix it yourself, cancel and use Edit solution." : "Use this when something must be fixed. It leaves the library until the owner corrects it and resubmits it for review."
            : "Use this when the solution is obsolete or replaced. It is removed from the Solution Library for good; the record is kept, not deleted, and the owner sees your reason."}</p>
          {/* Both transitions send the words the owner will read (the plug-in requires them); the caller confirms first. */}
          <label className="mt-3 block text-[14px] font-semibold">{manage === "changes" ? "What needs to be corrected" : "Reason for retiring"} <span className="font-normal text-(--ink-2)">(required)</span>
            <textarea value={comments} onChange={event => onComments(event.target.value)} maxLength={4000} rows={3} required aria-required="true" className={textArea}
              placeholder={manage === "changes" ? "Describe what needs to be updated before it can be published again." : "For example: replaced by a newer version, or no longer offered."} />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            {!comments.trim() && <p id={`${heading}-manage-hint`} className="mr-auto text-[13px] text-(--ink-2)">{manage === "changes" ? "Add a comment so the owner knows what to fix." : "Add the reason the owner will see."}</p>}
            <button type="button" onClick={() => { onComments(""); setManage(undefined); }} className={compactAction}>Cancel</button>
            <button type="button" aria-describedby={comments.trim() ? undefined : `${heading}-manage-hint`} disabled={!comments.trim() || disabled} onClick={manage === "changes" ? onRequestChanges : onRetire}
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              style={manage === "changes" ? { background: "var(--proto)", color: "var(--on-accent)" } : { background: "var(--ink)", color: "var(--ground)" }}>
              <Icon name={manage === "changes" ? "chevronLeft" : "eyeOff"} size={15} />{manage === "changes" ? "Send back for changes" : "Retire from library"}
            </button>
          </div>
        </fieldset>}
      </section>}

      {/* 4 · Review decision: one choice, then only its required input. */}
      {pending && <fieldset disabled={disabled} className={`${reviewSection} min-w-0`}>
        <legend className="sr-only">Review decision</legend>
        <h3 aria-hidden="true" className="eyebrow">Review decision</h3>
        <div role="radiogroup" aria-label="Review decision" className="mt-3 grid gap-3 sm:grid-cols-2">
          {DECISIONS.map(option => <ChoiceCard key={option.value} name={`${heading}-decision`} option={onEdit && option.value === "changes" ? { ...option, detail: "The submitter makes the changes and resubmits. To fix it yourself, use Edit solution." } : option} selected={decision === option.value} onSelect={() => setDecision(option.value)} />)}
        </div>

        {chosen && <div className="animate-rise mt-4 rounded-xl border p-4" style={{ borderColor: `color-mix(in srgb, ${chosen.color} 40%, transparent)`, background: `color-mix(in srgb, ${chosen.color} 6%, transparent)` }}>
          {decision === "changes" ? <label className="block text-[14px] font-semibold">What needs to be corrected <span className="font-normal text-(--ink-2)">(required)</span>
            <textarea value={comments} onChange={event => onComments(event.target.value)} maxLength={4000} rows={4} required aria-required="true" minLength={MIN_CHANGE_COMMENT}
              placeholder="Name each item to fix, e.g. “Blur the client logo in screenshot 2 and replace the client name in the summary.”" className={textArea} />
          </label> : <>
            {explain ? <label className="block text-[14px] font-semibold">What you changed and why <span className="font-normal text-(--ink-2)">(required, you edited this solution)</span>
              <textarea value={comments} onChange={event => onComments(event.target.value)} maxLength={4000} rows={3} required aria-required="true" className={textArea}
                placeholder="For example: “Removed the client name from the title and shortened the summary so it fits the card.”" />
            </label> : <label className="block text-[14px] font-semibold">Note to the submitter <span className="font-normal text-(--ink-2)">(optional)</span>
              <textarea value={comments} onChange={event => onComments(event.target.value)} maxLength={4000} rows={2} className={textArea} />            </label>}
          </>}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {approveHint && <p id={`${heading}-hint`} className="mr-auto text-[13px] text-(--ink-2)">{approveHint}</p>}
            {decision === "changes"
              ? <button type="button" aria-describedby={approveHint ? `${heading}-hint` : undefined} disabled={!commentReady || disabled} onClick={onReturn} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-(--on-accent) disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "var(--proto)" }}><Icon name="chevronLeft" />Send back for changes</button>
              : <button type="button" aria-describedby={approveHint ? `${heading}-hint` : undefined} disabled={!cleared || !canApprove || !explained || disabled} onClick={onApprove} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-(--on-accent) disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "var(--live)" }}><Icon name="check" />Approve &amp; publish</button>}
          </div>
        </div>}
      </fieldset>}
      {busy && <LoadingState className="mt-3" label="Saving review..." />}{error && <div role="alert" className="mt-3">{error}</div>}
    </section>
    {/* Marks where the librarian's controls end and the submitted solution begins. */}
    <div className="mt-8 flex items-center gap-3">
      <p className="eyebrow shrink-0">Submission preview · what the contributor submitted</p>
      <span aria-hidden="true" className="h-px flex-1" style={{ background: "var(--glass-edge)" }} />
    </div>
  </>;
}

type Sort = "newest" | "oldest";
/** The compact toolbar look, with room for long area and capability names and the arrow kept at the right edge. */
const filterButton = "toolbar-control flex h-9 cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3.5 text-left text-[13px] font-semibold outline-none";
const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;
/**
 * The row's edge says where each record stands, from the librarian's side: amber is reserved for "your turn" (the
 * Pending review count, as on the masthead tab), so a record sent back, now waiting on its contributor, is neutral.
 * My submissions keeps amber for Changes requested, because there it is the contributor's turn.
 */
const STATE_COLOR: Record<typeof filters[number], string> = { "Pending review": "var(--accent)", "Changes requested": "var(--ink-3)", Published: "var(--live)" };
/** One line under the tabs on what the open tab holds, in the colour of whose turn it is (amber: yours). */
const TAB_NOTICE: Record<typeof filters[number], { icon: IconName; tone: string; title: string; text: (connected: boolean) => string }> = {
  "Pending review": { icon: "clock", tone: "var(--proto)", title: "Your turn", text: () => "Submissions waiting for your review. Approve them, or send them back with what to fix." },
  "Changes requested": { icon: "users", tone: "var(--ink-3)", title: "Waiting for contributors", text: () => "You sent these back. They return to Pending review when the contributor resubmits; nothing to do for now." },
  Published: { icon: "check", tone: "var(--live)", title: "In the library", text: connected => connected ? "Live for everyone. Use Edit solution to fix something yourself, or the ••• menu to take one out." : "Live for everyone in this local preview." },
};
/** The record's `yyyy-MM-dd` date, read as a calendar date so no time zone shifts it: "Sep 30" (year only when not current) and the full form. */
function submittedOn(value?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const short = date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
  return { short, full: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), iso: match[0] };
}

/** An area librarian's review scope, by name: the areas they manage and the capabilities they own there. */
export type ReviewScope = { areas: SpecializationArea[]; capabilities: string[] };
type ScopeView = "area" | "mine";
const SCOPE_VIEW_KEY = "prisma.review.scope-view";
/** The scope view survives opening a submission and coming back; unavailable storage falls back to the whole area. */
function readScopeView(): ScopeView {
  try { return sessionStorage.getItem(SCOPE_VIEW_KEY) === "mine" ? "mine" : "area"; } catch { return "area"; }
}

/**
 * `capabilityAreas` maps a capability's name to the specialization area it belongs to. A solution's area here is its
 * main capability's area (its first area when the capability has none), and the capability filter lists only the
 * chosen area's capabilities; choosing a capability chooses its area.
 *
 * `scope` (an area librarian): the queue is already limited to their areas, so the Area filter gives way to "Reviewing
 * …" and a choice between the whole area and the capabilities they own. It only filters what is shown; what they may
 * review stays with the server. Without it (a global librarian) Area and Capability filter the whole queue.
 */
export function ReviewQueue({ entries, connected = false, capabilityAreas = {}, scope }: { entries: Entry[]; connected?: boolean; capabilityAreas?: Readonly<Record<string, SpecializationArea>>; scope?: ReviewScope }) {
  const [filter, setFilter] = useState<typeof filters[number]>("Pending review");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<SpecializationArea | "">("");
  const [capability, setCapability] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [scopeView, setScopeView] = useState<ScopeView>(readScopeView);
  const view: ScopeView = scope ? scopeView : "area";
  const mainArea = (solution: Solution): SpecializationArea | undefined => capabilityAreas[solution.capabilities[0] ?? ""] ?? solutionAreas(solution)[0];
  // Scope and area first: they decide which capabilities can be chosen.
  const inScope = ({ solution }: Entry, viewing = view, chosenArea = area) => (viewing !== "mine" || !!scope?.capabilities.includes(solution.capabilities[0] ?? ""))
    && (!chosenArea || mainArea(solution) === chosenArea);
  // Only capabilities with records in the open tab, within the scope and area (A–Z): every option leads somewhere.
  const capabilityOptions = (viewing: ScopeView, chosenArea: SpecializationArea | "") =>
    ["", ...[...new Set(entries.filter(entry => matches(entry, filter) && inScope(entry, viewing, chosenArea)).flatMap(({ solution }) => solution.capabilities.slice(0, 1)))].sort((a, b) => a.localeCompare(b))];
  const capabilities = capabilityOptions(view, area);
  const chosenCapability = capabilities.includes(capability) ? capability : "";
  const chooseCapability = (value: string) => {
    setCapability(value);
    const owner = capabilityAreas[value];
    if (value && owner && !scope) setArea(owner);
  };
  // A new scope or area drops a capability it no longer offers.
  const chooseArea = (value: SpecializationArea | "") => {
    setArea(value);
    if (!capabilityOptions(view, value).includes(capability)) setCapability("");
  };
  const chooseView = (value: ScopeView) => {
    setScopeView(value);
    try { sessionStorage.setItem(SCOPE_VIEW_KEY, value); } catch { void 0; }
    if (!capabilityOptions(value, area).includes(capability)) setCapability("");
  };
  const terms = query.trim().toLowerCase();
  // Scope, area, capability and search apply to every tab, so each tab's count matches what it lists.
  const shown = (entry: Entry) => inScope(entry) && (!chosenCapability || entry.solution.capabilities[0] === chosenCapability)
    && `${entry.solution.name} ${entry.solution.summary} ${entry.solution.capabilities.join(" ")} ${entry.owner ?? ""}`.toLowerCase().includes(terms);
  const counts = Object.fromEntries(filters.map(option => [option, entries.filter(entry => matches(entry, option) && shown(entry)).length])) as Record<typeof filters[number], number>;
  const visible = entries.filter(entry => matches(entry, filter) && shown(entry))
    // Undated records sort last either way; ties keep a stable alphabetical order.
    .sort((a, b) => {
      const left = a.solution.dateAdded ?? "", right = b.solution.dateAdded ?? "";
      if (left !== right) return !left ? 1 : !right ? -1 : (sort === "newest" ? right.localeCompare(left) : left.localeCompare(right));
      return a.solution.name.localeCompare(b.solution.name);
    });
  const narrowed = !!(terms || area || chosenCapability);
  // Clear all: back to the whole tab (search, area and capability); the sort order stays.
  const clearAll = () => { setQuery(""); setArea(""); setCapability(""); };
  const clearButton = <button type="button" onClick={clearAll} className="cursor-pointer text-[13px] font-semibold" style={{ color: "var(--accent)" }}>Clear all</button>;
  return <section className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
    <p className="eyebrow">Librarian{!connected && " · local preview"}</p><h1 className="mt-2 text-[28px]">Review queue</h1>
    {!connected && <p className="mt-2 text-[14px] text-(--ink-2)">Browser-local records. Review access is simulated; no production permissions or notifications.</p>}

    {/* Review status */}
    <div className="mt-6 flex flex-wrap gap-1 border-b border-(--glass-edge)" aria-label="Review status">
      {filters.map(option => {
        const active = filter === option;
        return <button type="button" key={option} aria-pressed={active} onClick={() => setFilter(option)} className="-mb-px cursor-pointer border-b-[3px] px-3 py-3 text-[14px] font-semibold transition-colors" style={{ borderColor: active ? "var(--accent)" : "transparent", color: active ? "var(--accent)" : "var(--ink-2)" }}>
          {option}
          {/* Pending review is the librarian's to-do: its count is amber like the masthead's Review queue badge. */}
          <span className="ml-2 rounded-full px-1.5 py-0.5 font-mono text-[11.5px]" style={option === "Pending review" && counts[option] > 0
            ? { color: "color-mix(in srgb, var(--proto) 85%, var(--ink))", background: "color-mix(in srgb, var(--proto) 20%, transparent)" }
            : { background: active ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "color-mix(in srgb, var(--ink) 7%, transparent)" }}>{counts[option]}</span>
        </button>;
      })}
    </div>

    <div className="mt-4"><Notice icon={TAB_NOTICE[filter].icon} tone={TAB_NOTICE[filter].tone} title={TAB_NOTICE[filter].title}>{TAB_NOTICE[filter].text(connected)}</Notice></div>

    {/* An area librarian's scope: which area, then the whole area or only the capabilities they own. */}
    {scope && <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-[14px] text-(--ink-2)">Reviewing
        {scope.areas.map(value => <span key={value} className="inline-flex items-center gap-1.5 font-semibold text-(--ink)"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: AREAS[value].cssVar }} />{AREAS[value].name}</span>)}
      </p>
      <div className="view-toggle view-toggle--text" role="group" aria-label="Review scope">
        <button type="button" aria-pressed={view === "area"} onClick={() => chooseView("area")}>All in my area</button>
        <button type="button" aria-pressed={view === "mine"} onClick={() => chooseView("mine")}>My capability</button>
      </div>
    </div>}

    {/* Search & filters: search stays the widest control; area narrows capability, and a capability sets its area. */}
    <div className={`${scope ? "mt-3" : "mt-5"} flex flex-wrap items-center gap-2.5`}>
      <label className="flex h-9 min-w-0 flex-1 basis-72 items-center gap-2 rounded-[10px] border border-(--glass-edge) px-3" style={{ background: "color-mix(in srgb, var(--ink) 3%, transparent)" }}><Icon name="search" /><input type="search" aria-label="Search review queue" placeholder={connected ? "Search submissions" : "Search submissions or owners"} value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[14px]" /></label>
      {!scope && <SelectPicker compact label="Specialization area" value={area} options={["", ...AREA_ORDER]} onChange={chooseArea} getLabel={value => value ? AREAS[value].name : "All areas"} buttonClassName={`${filterButton} min-w-[200px]`} />}
      <SelectPicker compact label="Capability" value={chosenCapability} options={capabilities} onChange={chooseCapability} getLabel={value => value || "All capabilities"} getHint={value => { const owner = capabilityAreas[value]; return value && owner && !area && (!scope || scope.areas.length > 1) ? AREAS[owner].short : ""; }} buttonClassName={`${filterButton} min-w-[240px]`} />
      <SelectPicker compact label="Sort" value={sort} options={["newest", "oldest"] as const} onChange={setSort} getLabel={value => value === "newest" ? "Newest first" : "Oldest first"} getButtonLabel={value => `Sort: ${value === "newest" ? "Newest" : "Oldest"}`} />
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-3"><p className="text-[13px] text-(--ink-2)" role="status">{plural(visible.length, "submission")}</p>{narrowed && visible.length > 0 && clearButton}</div>
    {!visible.length ? <div className="py-16 text-center"><Icon name="check" size={26} className="mx-auto" /><h2 className="mt-4 text-[20px]">{narrowed ? "No matching submissions" : filter === "Pending review" ? "Nothing awaiting review" : "No submissions in this status"}</h2>{narrowed && <div className="mt-3">{clearButton}</div>}</div> : <ul className="mt-3 space-y-2.5">
      {visible.map(({ solution, owner, imageCount, attachmentCount }) => {
        // The main area and the main capability, as the form classifies them.
        const primary = mainArea(solution);
        const areas = primary ? [primary] : [];
        // The review state tints the row's edge only; the area keeps its own chip colour and the card stays neutral.
        const tint = STATE_COLOR[filter];
        const date = submittedOn(solution.dateAdded);
        const counts = !connected || imageCount !== undefined;
        return <li key={solution.id} className="group relative grid min-w-0 gap-4 overflow-hidden rounded-2xl border border-(--glass-edge) py-4 pr-5 pl-6 transition duration-200 hover:-translate-y-0.5 hover:border-(--accent)/40 hover:shadow-lg sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${tint} 9%, transparent), color-mix(in srgb, var(--ink) 3%, transparent) 45%)` }}>
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: tint }} />
          {date && <time dateTime={date.iso} title={`Submitted ${date.full}`} className="absolute top-3 right-4 font-mono text-[11px] text-(--ink-3)"><span className="sr-only">Submitted </span>{date.short}</time>}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 pr-20 sm:pr-0">
              {areas.map(value => <AreaTag key={value} area={value} size="xs" />)}
              {solution.capabilities.slice(0, 1).map(value => <span key={value} className="inline-flex items-center rounded-full border border-(--glass-edge) px-2 py-0.5 text-[10.5px] font-semibold text-(--ink-2)">{value}</span>)}
            </div>
            <h2 className="mt-2 break-words text-[17px] leading-snug font-semibold">{solution.name || "Untitled solution"}</h2>
            {solution.summary && <p className="mt-0.5 line-clamp-2 break-words text-[14px] text-(--ink-2)">{solution.summary}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-(--ink-3)">
              {[owner && <span key="owner" className="break-all font-semibold text-(--ink-2)">{owner}</span>,
                counts && <span key="images">{plural(imageCount ?? solution.images?.length ?? 0, "image")}</span>,
                counts && <span key="files">{plural(attachmentCount ?? solution.assets.length, "attachment")}</span>,
              ].filter(Boolean).flatMap((item, index) => index ? [<span key={`dot-${index}`} aria-hidden="true">·</span>, item] : [item])}
            </p>
          </div>
          <button type="button" aria-label={`${filter === "Pending review" ? "Review" : "View"} ${solution.name}`} onClick={() => navigate(`/review/${solution.id}`)}
            className="inline-flex cursor-pointer items-center justify-center gap-2 self-center justify-self-start rounded-lg border border-(--accent)/40 px-4 py-2.5 text-[14px] font-semibold text-(--accent) transition-colors group-hover:border-(--accent) group-hover:bg-(--accent) group-hover:text-(--on-accent) focus-visible:bg-(--accent) focus-visible:text-(--on-accent)">
            {filter === "Pending review" ? "Review submission" : "View status"}<Icon name="arrowRight" />
          </button>
        </li>;
      })}
    </ul>}
  </section>;
}