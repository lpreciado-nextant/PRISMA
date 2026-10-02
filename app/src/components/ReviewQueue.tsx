import { useId, useState, type ReactNode } from "react";
import type { Solution, SpecializationArea } from "../types";
import { AREA_ORDER, AREAS } from "../data/catalogueMetadata";
import { navigate } from "../lib/router";
import { Icon, type IconName } from "./Icon";
import { LoadingState } from "./LoadingState";
import { SelectPicker } from "./SelectPicker";
import { solutionAreas } from "../lib/areas";
import { submissionState } from "../lib/submissionState";
import type { ReviewCheck } from "../lib/reviewChecklist";
import { AreaTag } from "./Badges";

const filters = ["Pending review", "Changes requested", "Published"] as const;
type Entry = { solution: Solution; owner?: string; imageCount?: number; attachmentCount?: number };
const matches = ({ solution }: Entry, status: string) => submissionState(solution) === status;

type Choice<Value extends string> = { value: Value; title: string; detail: string; icon: IconName; color: string };
type Decision = "publish" | "changes";
const DECISIONS: Choice<Decision>[] = [
  { value: "publish", title: "Ready to publish", detail: "The submission meets the requirements.", icon: "check", color: "var(--live)" },
  { value: "changes", title: "Request changes", detail: "The contributor needs to make updates.", icon: "alert", color: "var(--proto)" },
];
const PUBLISHED_ACTIONS: Choice<"changes" | "retire">[] = [
  { value: "changes", title: "Request changes", detail: "Take it out of the library and send it back to the owner to fix.", icon: "alert", color: "var(--proto)" },
  { value: "retire", title: "Retire from library", detail: "Take it out for good, e.g. obsolete or replaced. Nothing is deleted.", icon: "eyeOff", color: "var(--ink-2)" },
];

/** One option of a decision, as a selectable card backed by a native radio (arrow keys move between options). */
function ChoiceCard<Value extends string>({ name, option, selected, onSelect }: { name: string; option: Choice<Value>; selected: boolean; onSelect: () => void }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--accent)"
    style={{ borderColor: selected ? option.color : "var(--glass-edge)", background: selected ? `color-mix(in srgb, ${option.color} 12%, transparent)` : "color-mix(in srgb, var(--ink) 3%, transparent)" }}>
    <input type="radio" name={name} value={option.value} checked={selected} onChange={onSelect} className="sr-only" />
    <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ color: option.color, background: `color-mix(in srgb, ${option.color} 16%, transparent)` }}><Icon name={option.icon} size={18} /></span>
    <span className="min-w-0">
      <span className="block text-[15px] font-semibold" style={selected ? { color: option.color } : undefined}>{option.title}</span>
      <span className="mt-0.5 block text-[13.5px] text-(--ink-2)">{option.detail}</span>
    </span>
  </label>;
}
const textArea = "mt-2 block w-full resize-y rounded-lg border border-(--glass-edge) bg-(--ground)/60 px-3 py-2 text-[14px] font-normal";

/**
 * Librarian controls above the submission preview: status, then context, then one decision at a time. Only the chosen
 * decision's controls show. The comment is shared state, as before: required to send back, an optional note on approval
 * (approval replaces the stored feedback, or clears it when blank).
 */
export function ReviewPanel({ status, owner, client, context, feedback, solution, checks, comments, onComments, cleared, onCleared, busy, locked = false, canApprove = true, local = false, notice, noticeBusy = false, error, onReturn, onApprove, defaultDecision, onRequestChanges, onRetire, children }: {
  status: string; owner?: string; client?: string; context?: string; feedback?: string;
  /** Classification and resubmission state; omitted, the checklist shows client safety only. */
  solution?: Solution; checks?: ReviewCheck[];
  comments: string; onComments: (value: string) => void;
  cleared: boolean; onCleared: (value: boolean) => void; busy: boolean; locked?: boolean; canApprove?: boolean; local?: boolean;
  notice?: ReactNode; noticeBusy?: boolean; error?: ReactNode; onReturn: () => void; onApprove: () => void; defaultDecision?: Decision;
  /** Offered on a published record when the caller may take it out of the library; both send `comments`. */
  onRequestChanges?: () => void; onRetire?: () => void; children?: ReactNode;
}) {
  const heading = useId();
  const [manage, setManage] = useState<"changes" | "retire" | undefined>();
  const manageOption = PUBLISHED_ACTIONS.find(option => option.value === manage);
  const [decision, setDecision] = useState<Decision | undefined>(defaultDecision);
  const disabled = busy || locked;
  // A returned record is a Draft awaiting its contributor: say so, and show the feedback as what they are working from.
  const returned = !!solution && submissionState(solution) === "Changes requested";
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
          <h2 id={heading} className="mt-2 text-[22px]">{returned ? "Changes requested" : status}</h2>
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
        {feedback && !returned && status !== "Published" && <div className="mt-5 border-l-2 border-(--proto) pl-3">
          <h4 className="text-[13.5px] font-semibold">{status === "Pending review" && solution?.reviewOutcome === "Changes requested" ? "Resubmitted after changes requested" : "Latest review comments"}</h4>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-(--ink-2)">{feedback}</p>
        </div>}
      </div>
      {noticeBusy && typeof notice === "string" ? <LoadingState className="mt-3" label={notice} /> : notice && <div role="status" className="mt-3 text-[14px] text-(--ink-2)">{notice}</div>}

      {/* 3 · Review decision, then only the chosen decision's required action. */}
      {returned && <section aria-labelledby={`${heading}-waiting`} className="mt-6 rounded-xl border p-4 sm:p-5" style={{ borderColor: "color-mix(in srgb, var(--proto) 40%, transparent)", background: "color-mix(in srgb, var(--proto) 7%, transparent)" }}>
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ color: "var(--proto)", background: "color-mix(in srgb, var(--proto) 16%, transparent)" }}><Icon name="clock" size={18} /></span>
          <div className="min-w-0">
            <h3 id={`${heading}-waiting`} className="text-[16px] font-semibold" style={{ color: "var(--proto)" }}>Waiting for corrections</h3>
            <p className="mt-0.5 text-[13.5px] text-(--ink-2)">Sent back to the contributor. It returns to Pending review when they resubmit.</p>
          </div>
        </div>
        {feedback && <div className="mt-4 border-t border-(--glass-edge) pt-4">
          <h4 className="eyebrow">Your feedback</h4>
          <p className="mt-2 border-l-2 border-(--proto) pl-3 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">{feedback}</p>
        </div>}
      </section>}

      {status === "Published" && <section aria-labelledby={`${heading}-live`} className="mt-6 rounded-xl border p-4 sm:p-5" style={{ borderColor: "color-mix(in srgb, var(--live) 40%, transparent)", background: "color-mix(in srgb, var(--live) 7%, transparent)" }}>
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ color: "var(--live)", background: "color-mix(in srgb, var(--live) 16%, transparent)" }}><Icon name="check" size={18} /></span>
          <div className="min-w-0">
            <h3 id={`${heading}-live`} className="text-[16px] font-semibold" style={{ color: "var(--live)" }}>Published</h3>
            <p className="mt-0.5 text-[13.5px] text-(--ink-2)">Live in the library: CSMs can find it and present it.</p>
          </div>
        </div>
        {feedback && <div className="mt-4 border-t border-(--glass-edge) pt-4">
          <h4 className="eyebrow">Your note to the contributor</h4>
          <p className="mt-2 border-l-2 border-(--live) pl-3 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">{feedback}</p>
        </div>}
        {/* Taking a published record out of the library: either back to its owner to fix, or retired for good. Both need
            the words the owner will read; the caller confirms before acting. */}
        {(onRequestChanges || onRetire) && <fieldset disabled={disabled} className="mt-4 min-w-0 border-t border-(--glass-edge) pt-4">
          <legend className="sr-only">Take it out of the library</legend>
          <h4 aria-hidden="true" className="text-[14px] font-semibold">Need to change it?</h4>
          <div role="radiogroup" aria-label="Take it out of the library" className="mt-2.5 grid gap-3 sm:grid-cols-2">
            {PUBLISHED_ACTIONS.filter(option => option.value === "changes" ? onRequestChanges : onRetire).map(option => <ChoiceCard key={option.value} name={`${heading}-published`} option={option} selected={manage === option.value} onSelect={() => setManage(option.value)} />)}
          </div>
          {manageOption && <div className="animate-rise mt-4">
            <label className="block text-[14px] font-semibold">{manage === "changes" ? "Comments to contributor" : "Reason for retiring"} <span className="font-normal text-(--ink-2)">(required)</span>
              <textarea value={comments} onChange={event => onComments(event.target.value)} maxLength={4000} rows={3} required aria-required="true" className={textArea}
                placeholder={manage === "changes" ? "Describe what needs to be updated before it can be published again." : "For example: replaced by a newer version, or no longer offered."} />
            </label>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
              {!comments.trim() && <p id={`${heading}-manage-hint`} className="mr-auto text-[13px] text-(--ink-2)">{manage === "changes" ? "Add a comment so the owner knows what to fix." : "Add the reason the owner will see."}</p>}
              <button type="button" aria-describedby={comments.trim() ? undefined : `${heading}-manage-hint`} disabled={!comments.trim() || disabled} onClick={manage === "changes" ? onRequestChanges : onRetire}
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                style={manage === "changes" ? { background: "var(--proto)", color: "var(--on-accent)" } : { border: "1px solid var(--glass-edge)" }}>
                <Icon name={manageOption.icon} size={16} />{manage === "changes" ? "Send back for changes" : "Retire from library"}
              </button>
            </div>
          </div>}
        </fieldset>}
      </section>}

      {status === "Pending review" && <fieldset disabled={disabled} className="mt-6 min-w-0 border-t border-(--glass-edge) pt-5">
        <legend className="sr-only">Review decision</legend>
        <h3 aria-hidden="true" className="text-[16px] font-semibold">Review decision</h3>
        <div role="radiogroup" aria-label="Review decision" className="mt-3 grid gap-3 sm:grid-cols-2">
          {DECISIONS.map(option => <ChoiceCard key={option.value} name={`${heading}-decision`} option={option} selected={decision === option.value} onSelect={() => setDecision(option.value)} />)}
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

type Sort = "newest" | "oldest";
const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;
/** Same state colours as My submissions: the row's edge says where each record stands. */
const STATE_COLOR: Record<typeof filters[number], string> = { "Pending review": "var(--accent)", "Changes requested": "var(--proto)", Published: "var(--live)" };
/** The record's `yyyy-MM-dd` date, read as a calendar date so no time zone shifts it: "Sep 30" (year only when not current) and the full form. */
function submittedOn(value?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const short = date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
  return { short, full: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), iso: match[0] };
}

export function ReviewQueue({ entries, connected = false }: { entries: Entry[]; connected?: boolean }) {
  const [filter, setFilter] = useState<typeof filters[number]>("Pending review");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<SpecializationArea | "">("");
  const [capability, setCapability] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const inArea = entries.filter(entry => matches(entry, filter)).filter(({ solution }) => !area || solutionAreas(solution).includes(area));
  // Capabilities narrow with the chosen area: only those present among the records the area leaves.
  const capabilities = ["", ...[...new Set(inArea.flatMap(({ solution }) => solution.capabilities))].sort((a, b) => a.localeCompare(b))];
  const chosenCapability = capabilities.includes(capability) ? capability : "";
  const terms = query.trim().toLowerCase();
  const visible = inArea
    .filter(({ solution }) => !chosenCapability || solution.capabilities.includes(chosenCapability))
    .filter(({ solution, owner }) => `${solution.name} ${solution.summary} ${solution.capabilities.join(" ")} ${owner ?? ""}`.toLowerCase().includes(terms))
    // Undated records sort last either way; ties keep a stable alphabetical order.
    .sort((a, b) => {
      const left = a.solution.dateAdded ?? "", right = b.solution.dateAdded ?? "";
      if (left !== right) return !left ? 1 : !right ? -1 : (sort === "newest" ? right.localeCompare(left) : left.localeCompare(right));
      return a.solution.name.localeCompare(b.solution.name);
    });
  const narrowed = !!(terms || area || chosenCapability);
  return <section className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
    <p className="eyebrow">Librarian{!connected && " · local preview"}</p><h1 className="mt-2 text-[28px]">Review queue</h1>
    {!connected && <p className="mt-2 text-[14px] text-(--ink-2)">Browser-local records. Review access is simulated; no production permissions or notifications.</p>}

    {/* Review status */}
    <div className="mt-6 flex flex-wrap gap-1 border-b border-(--glass-edge)" aria-label="Review status">
      {filters.map(option => {
        const active = filter === option;
        return <button type="button" key={option} aria-pressed={active} onClick={() => setFilter(option)} className="-mb-px cursor-pointer border-b-[3px] px-3 py-3 text-[14px] font-semibold transition-colors" style={{ borderColor: active ? "var(--accent)" : "transparent", color: active ? "var(--accent)" : "var(--ink-2)" }}>
          {option}
          <span className="ml-2 rounded-full px-1.5 py-0.5 font-mono text-[11.5px]" style={{ background: active ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "color-mix(in srgb, var(--ink) 7%, transparent)" }}>{entries.filter(entry => matches(entry, option)).length}</span>
        </button>;
      })}
    </div>

    {/* Search & filters: search stays the widest control; area narrows capability. */}
    <div className="mt-5 flex flex-wrap items-center gap-2.5">
      <label className="flex h-9 min-w-0 flex-1 basis-72 items-center gap-2 rounded-[10px] border border-(--glass-edge) px-3" style={{ background: "color-mix(in srgb, var(--ink) 3%, transparent)" }}><Icon name="search" /><input type="search" aria-label="Search review queue" placeholder={connected ? "Search submissions" : "Search submissions or owners"} value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[14px]" /></label>
      <SelectPicker compact label="Specialization area" value={area} options={["", ...AREA_ORDER]} onChange={setArea} getLabel={value => value ? AREAS[value].name : "All areas"} />
      <SelectPicker compact label="Capability" value={chosenCapability} options={capabilities} onChange={setCapability} getLabel={value => value || "All capabilities"} />
      <SelectPicker compact label="Sort" value={sort} options={["newest", "oldest"] as const} onChange={setSort} getLabel={value => value === "newest" ? "Newest first" : "Oldest first"} getButtonLabel={value => `Sort: ${value === "newest" ? "Newest" : "Oldest"}`} />
    </div>

    <p className="mt-4 text-[13px] text-(--ink-2)" role="status">{plural(visible.length, "submission")}</p>
    {!visible.length ? <div className="py-16 text-center"><Icon name="check" size={26} className="mx-auto" /><h2 className="mt-4 text-[20px]">{narrowed ? "No matching submissions" : filter === "Pending review" ? "Nothing awaiting review" : "No submissions in this status"}</h2></div> : <ul className="mt-3 space-y-2.5">
      {visible.map(({ solution, owner, imageCount, attachmentCount }) => {
        const areas = solutionAreas(solution);
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
              {solution.capabilities.map(value => <span key={value} className="inline-flex items-center rounded-full border border-(--glass-edge) px-2 py-0.5 text-[10.5px] font-semibold text-(--ink-2)">{value}</span>)}
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