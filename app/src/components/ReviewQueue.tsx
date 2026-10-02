import { useId, useState, type ReactNode } from "react";
import type { Solution, SpecializationArea } from "../types";
import { AREA_ORDER, AREAS } from "../data/catalogueMetadata";
import { navigate } from "../lib/router";
import { Icon } from "./Icon";
import { LoadingState } from "./LoadingState";
import { SelectPicker } from "./SelectPicker";
import { solutionAreas } from "../lib/areas";
import { submissionState } from "../lib/submissionState";
import type { ReviewCheck } from "../lib/reviewChecklist";
import { AreaTag } from "./Badges";

const filters = ["Pending review", "Changes requested", "Published"] as const;
type Entry = { solution: Solution; owner?: string; imageCount?: number; attachmentCount?: number };
const matches = ({ solution }: Entry, status: string) => submissionState(solution) === status;

type Decision = "publish" | "changes";
const DECISIONS: { value: Decision; title: string; detail: string; icon: "check" | "alert"; color: string }[] = [
  { value: "publish", title: "Ready to publish", detail: "The submission meets the requirements.", icon: "check", color: "var(--live)" },
  { value: "changes", title: "Request changes", detail: "The contributor needs to make updates.", icon: "alert", color: "var(--proto)" },
];
const textArea = "mt-2 block w-full resize-y rounded-lg border border-(--glass-edge) bg-(--ground)/60 px-3 py-2 text-[14px] font-normal";

/**
 * Librarian controls above the submission preview: status, then context, then one decision at a time. Only the chosen
 * decision's controls show. The comment is shared state, as before: required to send back, an optional note on approval
 * (approval replaces the stored feedback, or clears it when blank).
 */
export function ReviewPanel({ status, owner, client, context, feedback, solution, checks, comments, onComments, cleared, onCleared, busy, locked = false, canApprove = true, local = false, notice, noticeBusy = false, error, onReturn, onApprove, defaultDecision, children }: {
  status: string; owner?: string; client?: string; context?: string; feedback?: string;
  /** Classification and resubmission state; omitted, the checklist shows client safety only. */
  solution?: Solution; checks?: ReviewCheck[];
  comments: string; onComments: (value: string) => void;
  cleared: boolean; onCleared: (value: boolean) => void; busy: boolean; locked?: boolean; canApprove?: boolean; local?: boolean;
  notice?: ReactNode; noticeBusy?: boolean; error?: ReactNode; onReturn: () => void; onApprove: () => void; defaultDecision?: Decision; children?: ReactNode;
}) {
  const heading = useId();
  const [decision, setDecision] = useState<Decision | undefined>(defaultDecision);  const disabled = busy || locked;
  const chosen = DECISIONS.find(option => option.value === decision);
  const hint = decision === "changes" ? !comments.trim() && "Add a comment to send this submission back."
    : decision === "publish" ? !canApprove ? "Required content, contributor effort, images and the safety acknowledgment must be complete before approval." : !cleared && "Confirm the review above to publish." : undefined;
  return <>
    <section aria-labelledby={heading} className="relative mt-6 overflow-hidden rounded-[22px] border p-5 sm:p-6"
      style={{ borderColor: "color-mix(in srgb, var(--accent) 34%, transparent)", background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 13%, transparent), color-mix(in srgb, var(--accent) 4%, transparent))" }}>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(90deg, var(--accent), var(--sa-ibo), var(--sa-ai))" }} />

      {/* 1 · Review status */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}><Icon name="shield" size={13} />Librarian review{local && " · local preview"}</p>
          <h2 id={heading} className="mt-2 text-[22px]">{status}</h2>
          {owner && <p className="mt-1 break-all text-[13px] text-(--ink-2)">Submitted by <span className="font-semibold text-(--ink)">{owner}</span></p>}
        </div>
      </div>

      {/* 2 · Review checklist: what the decision rests on, secondary to the status and decision. */}
      <div className="mt-5 rounded-xl border border-(--glass-edge) px-4 pt-4 pb-5 sm:px-5" style={{ background: "color-mix(in srgb, var(--ink) 4%, transparent)" }}>
        <h3 className="eyebrow">Review checklist</h3>
        <div className="mt-3 grid gap-x-8 gap-y-5 text-[13.5px] lg:grid-cols-3">
          {solution && <section aria-label="Classification" className="min-w-0">
            <h4 className="font-semibold">Classification</h4>
            <dl className="mt-1.5 space-y-2">
              <div><dt className="text-[12px] text-(--ink-3)">Specialization areas</dt><dd className="mt-0.5 flex flex-wrap gap-1.5">{solutionAreas(solution).map(area => <AreaTag key={area} area={area} size="xs" />)}</dd></div>
              <div><dt className="text-[12px] text-(--ink-3)">Capability</dt><dd className="break-words">{solution.capabilities[0] ?? <span className="text-(--proto)">No capability</span>}</dd></div>
              <div><dt className="text-[12px] text-(--ink-3)">Status</dt><dd>{solution.status}</dd></div>
            </dl>
          </section>}
          <section aria-label="Client safety" className="min-w-0">
            <h4 className="font-semibold">Client safety</h4>
            {client ? <dl className="mt-1.5 space-y-2">
              <div><dt className="text-[12px] text-(--ink-3)">Internal client</dt><dd className="break-words">{client}</dd></div>
              <div><dt className="text-[12px] text-(--ink-3)">Shown to clients as</dt><dd className="break-words" style={context ? undefined : { color: "var(--proto)" }}>{context || "Not provided"}</dd></div>
            </dl> : <p className="mt-1.5 text-(--ink-2)">No client named; nothing to anonymize.{context && <> Shown to clients as “{context}”.</>}</p>}
          </section>
          {/* Points to verify, as plain bullets: no ticks, so nothing reads as already reviewed. Only a point the record
              does not meet is flagged. */}
          {checks && <section aria-labelledby={`${heading}-points`} className="min-w-0">
            <h4 id={`${heading}-points`} className="font-semibold">Review points</h4>
            <p className="text-[12px] text-(--ink-3)">Verify these items before making your decision.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-(--ink-3)">
              {checks.map(check => <li key={check.label} style={{ color: check.done ? "var(--ink-2)" : "var(--proto)" }}>
                {check.label}{!check.done && <span className="ml-1.5 inline-flex items-center gap-1 text-[12px] font-semibold"><Icon name="alert" size={12} />Missing</span>}
              </li>)}
            </ul>
          </section>}
        </div>
        {feedback && <div className="mt-5 border-l-2 border-(--proto) pl-3">
          <h4 className="text-[13.5px] font-semibold">{status === "Pending review" && solution?.reviewOutcome === "Changes requested" ? "Resubmitted after changes requested" : "Latest review comments"}</h4>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-(--ink-2)">{feedback}</p>
        </div>}
      </div>
      {noticeBusy && typeof notice === "string" ? <LoadingState className="mt-3" label={notice} /> : notice && <div role="status" className="mt-3 text-[14px] text-(--ink-2)">{notice}</div>}

      {/* 3 · Review decision, then only the chosen decision's required action. */}
      {status === "Pending review" && <fieldset disabled={disabled} className="mt-6 min-w-0 border-t border-(--glass-edge) pt-5">
        <legend className="sr-only">Review decision</legend>
        <h3 aria-hidden="true" className="text-[16px] font-semibold">Review decision</h3>
        <div role="radiogroup" aria-label="Review decision" className="mt-3 grid gap-3 sm:grid-cols-2">
          {DECISIONS.map(option => {
            const selected = decision === option.value;
            return <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--accent)"
              style={{ borderColor: selected ? option.color : "var(--glass-edge)", background: selected ? `color-mix(in srgb, ${option.color} 12%, transparent)` : "color-mix(in srgb, var(--ink) 3%, transparent)" }}>
              <input type="radio" name={`${heading}-decision`} value={option.value} checked={selected} onChange={() => setDecision(option.value)} className="sr-only" />
              <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ color: option.color, background: `color-mix(in srgb, ${option.color} 16%, transparent)` }}><Icon name={option.icon} size={18} /></span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold" style={selected ? { color: option.color } : undefined}>{option.title}</span>
                <span className="mt-0.5 block text-[13.5px] text-(--ink-2)">{option.detail}</span>
              </span>
            </label>;
          })}
        </div>

        {chosen && <div className="animate-rise mt-5 rounded-xl border p-4 sm:p-5" style={{ borderColor: `color-mix(in srgb, ${chosen.color} 40%, transparent)`, background: `color-mix(in srgb, ${chosen.color} 6%, transparent)` }}>
          {decision === "changes" ? <label className="block text-[14px] font-semibold">Comments to contributor <span className="font-normal text-(--ink-2)">(required)</span>
            <textarea value={comments} onChange={event => onComments(event.target.value)} maxLength={4000} rows={4} required aria-required="true"
              placeholder="Describe what needs to be updated before this solution can be published." className={textArea} />
          </label> : <>
            <label className="flex items-start gap-3 text-[14px]"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={cleared} onChange={event => onCleared(event.target.checked)} /><span>I confirm that I reviewed the descriptions, contributor effort, screenshots and attachments, and that client-visible content is authorized and anonymized.</span></label>
            <label className="mt-4 block text-[14px] font-semibold">Note to contributor <span className="font-normal text-(--ink-2)">(optional)</span>
              <textarea value={comments} onChange={event => onComments(event.target.value)} maxLength={4000} rows={2} className={textArea} />
              <span className="mt-1 block text-[12.5px] font-normal text-(--ink-3)">Replaces the latest feedback on the record; leave blank to clear it.</span>
            </label>
          </>}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {hint && <p id={`${heading}-hint`} className="mr-auto text-[13px] text-(--ink-2)">{hint}</p>}
            {decision === "changes"
              ? <button type="button" aria-describedby={hint ? `${heading}-hint` : undefined} disabled={!comments.trim() || disabled} onClick={onReturn} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-(--on-accent) disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "var(--proto)" }}><Icon name="chevronLeft" />Send back for changes</button>
              : <button type="button" aria-describedby={hint ? `${heading}-hint` : undefined} disabled={!cleared || !canApprove || disabled} onClick={onApprove} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-(--on-accent) disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "var(--live)" }}><Icon name="check" />Approve &amp; publish</button>}
          </div>
        </div>}
      </fieldset>}
      {busy && <LoadingState className="mt-3" label="Saving review..." />}{error && <div role="alert" className="mt-3">{error}</div>}{children}
    </section>
    {/* Marks where the librarian's controls end and the submitted solution begins. */}
    <div className="mt-8 flex items-center gap-3">
      <p className="eyebrow shrink-0">Submission preview · what the contributor submitted</p>
      <span aria-hidden="true" className="h-px flex-1" style={{ background: "var(--glass-edge)" }} />
    </div>
  </>;
}

export function ReviewQueue({ entries, connected = false }: { entries: Entry[]; connected?: boolean }) {
  const [filter, setFilter] = useState<typeof filters[number]>("Pending review");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<SpecializationArea | "">("");
  const visible = entries.filter(entry => matches(entry, filter))
    .filter(({ solution }) => !area || solutionAreas(solution).includes(area))
    .filter(({ solution, owner }) => `${solution.name} ${solution.summary} ${owner ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
    <p className="eyebrow">Librarian{!connected && " · local preview"}</p><h1 className="mt-2 text-[28px]">Review queue</h1>
    {!connected && <p className="mt-2 text-[14px] text-(--ink-2)">Browser-local records. Review access is simulated; no production permissions or notifications.</p>}
    <div className="mt-6 flex flex-wrap gap-1 border-b border-(--glass-edge)" aria-label="Review status">
      {filters.map(option => <button type="button" key={option} aria-pressed={filter === option} onClick={() => setFilter(option)} className="cursor-pointer border-b-2 px-3 py-3 text-[14px] font-semibold" style={{ borderColor: filter === option ? "var(--accent)" : "transparent", color: filter === option ? "var(--ink)" : "var(--ink-2)" }}>{option}<span className="ml-2 font-mono text-[12px]">{entries.filter(entry => matches(entry, option)).length}</span></button>)}
    </div>
    <div className="my-5 flex flex-wrap gap-4">
      <label className="flex min-w-0 flex-1 basis-64 items-center gap-2 rounded-lg border border-(--glass-edge) px-3"><Icon name="search" /><input type="search" aria-label="Search review queue" placeholder={connected ? "Search submissions" : "Search submissions or owners"} value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px]" /></label>
      <div className="w-full min-w-0 sm:w-[340px]"><SelectPicker label="Specialization area" value={area} options={["", ...AREA_ORDER]} onChange={setArea} getLabel={value => value ? AREAS[value].name : "All specializations"} /></div>
    </div>
    <p className="text-[13px] text-(--ink-2)" role="status">{visible.length} {visible.length === 1 ? "submission" : "submissions"}</p>
    {!visible.length ? <div className="py-16 text-center"><Icon name="check" size={26} className="mx-auto" /><h2 className="mt-4 text-[20px]">{query || area ? "No matching submissions" : filter === "Pending review" ? "Nothing awaiting review" : "No submissions in this status"}</h2></div> : <ul className="mt-3">
      {visible.map(({ solution, owner, imageCount, attachmentCount }) => <li key={solution.id} className="grid min-w-0 gap-4 border-b border-(--glass-edge) py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0"><p className="eyebrow">{solutionAreas(solution).map(value => AREAS[value].name).join(" · ")}</p><h2 className="mt-1 break-words text-[18px] font-semibold">{solution.name || "Untitled solution"}</h2><p className="mt-1 break-words text-[14px] text-(--ink-2)">{solution.summary}</p>
          {(!connected || imageCount !== undefined) && <p className="mt-2 break-all text-[12px] text-(--ink-3)">{[owner, solution.dateAdded, `${imageCount ?? solution.images?.length ?? 0} images`, `${attachmentCount ?? solution.assets.length} attachments`].filter(Boolean).join(" · ")}</p>}
        </div>
        <button type="button" aria-label={`${filter === "Pending review" ? "Review" : "View"} ${solution.name}`} onClick={() => navigate(`/review/${solution.id}`)} className="inline-flex cursor-pointer items-center justify-center gap-2 self-center justify-self-start rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px] font-semibold">{filter === "Pending review" ? "Review submission" : "View status"}<Icon name="arrowRight" /></button>
      </li>)}
    </ul>}
  </section>;
}