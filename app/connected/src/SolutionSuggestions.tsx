import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";
import { LoadingState } from "../../src/components/LoadingState";
import { submissionInputClass } from "../../src/components/SubmissionForm";
import { isAddressed, setAddressed, suggestionFeedbackKey, useFeedbackSeen } from "../../src/lib/feedbackSeen";
import { sendSuggestion, SUGGESTION_MAX, type Suggestion, type SuggestionApi, type SuggestionList } from "./suggestions";

export const suggestionButton = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3 py-2 text-[14px] disabled:cursor-default disabled:opacity-40";
const panel = "glass glass-lite rounded-[20px] p-5";

/**
 * Author, date and text of each suggestion. With `canAddress` (the uploader, on their submission page) each has its own
 * "Mark as addressed" check; everyone else (contributors, the librarian) sees its state only. Addressed items stay
 * listed (quieter) under the panel's Addressed filter.
 */
export function SuggestionItems({ suggestions, canAddress = false }: { suggestions: Suggestion[]; canAddress?: boolean }) {
  useFeedbackSeen();
  return <ul className="flex flex-col gap-4">{suggestions.map(item => {
    const key = suggestionFeedbackKey(item.id);
    const done = isAddressed(key);
    return <li key={item.id} className="flex items-start gap-3 border-b border-(--glass-edge) pb-4 last:border-b-0 last:pb-0">
      <div className="min-w-0 flex-1" style={done ? { opacity: 0.7 } : undefined}>
        <p className="text-[12.5px] text-(--ink-3)"><span className="font-semibold text-(--ink-2)">{item.author}</span> · <time dateTime={item.createdOn}>{new Date(item.createdOn).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time></p>
        <p className="mt-1 whitespace-pre-wrap break-words text-[14.5px] text-(--ink)">{item.text}</p>
      </div>
      {canAddress ? <AddressedToggle done={done} onToggle={() => setAddressed(key, !done)} />
        : <span className={`suggestion-state ${done ? "suggestion-state--done" : ""}`}>{done ? "Addressed" : "Pending"}</span>}
    </li>;
  })}</ul>;
}

/** "Mark as addressed" for one feedback item: a quiet check that fills in accent once confirmed (and can be undone). */
export function AddressedToggle({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} aria-pressed={done} title={done ? "Addressed — click to reopen" : "Mark as addressed"}
    className="addressed-toggle inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold">
    <span aria-hidden="true" className="grid size-4 place-items-center rounded-full border">{done && <Icon name="check" size={10} />}</span>
    {done ? "Addressed" : "Mark as addressed"}
  </button>;
}

type View = "pending" | "addressed" | "all";

/**
 * Pending (not yet marked addressed by the uploader), Addressed, or All (the full history). Only the uploader marks
 * them (`canAddress`); contributors and the librarian read them.
 */
export function SuggestionsPanel({ list, canAddress = false }: { list: SuggestionList; canAddress?: boolean }) {
  useFeedbackSeen();
  const pending = list.suggestions.filter(item => !isAddressed(suggestionFeedbackKey(item.id)));
  const [view, setView] = useState<View>(() => pending.length ? "pending" : "all");
  const shown = view === "pending" ? pending : view === "addressed" ? list.suggestions.filter(item => isAddressed(suggestionFeedbackKey(item.id))) : list.suggestions;
  const views: { value: View; label: string; count: number }[] = [{ value: "pending", label: "Pending", count: pending.length }, { value: "addressed", label: "Addressed", count: list.suggestions.length - pending.length }, { value: "all", label: "All", count: list.suggestions.length }];
  // Private team feedback, not part of the solution itself: a blue-tinted sheet (the suggestions colour), like the
  // amber-tinted internal notes, so it never reads as the solution's own content.
  return <section className={`${panel} suggestions-panel`} aria-labelledby="suggestions-heading">
    {/* Heading with its count; who can read it sits apart as a quiet note instead of an "internal only" tag. */}
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
      <h2 id="suggestions-heading" className="flex items-center gap-2 text-[15px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        <Icon name="message" size={16} />Suggestions
        <span className="rounded-full px-2 py-px font-mono text-[11.5px] font-normal" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>{list.suggestions.length}</span>
      </h2>
      <p className="flex items-center gap-1.5 text-[12px] text-(--ink-3)"><Icon name="lock" size={12} />Private · Solution owner, its contributors &amp; Librarian</p>
    </div>
    {list.suggestions.length === 0 ? <p className="text-[14px] text-(--ink-3)">No suggestions from colleagues yet.</p> : <>
      <p className="mb-4 text-[13.5px] text-(--ink-2)">{canAddress
        ? "Review feedback on this solution. Mark suggestions as addressed once reviewed, whether or not you apply the changes."
        : "Feedback on this solution. The owner marks suggestions as addressed from My submissions."}</p>
      {/* What is still to address, what has been, or everything. */}
      <div role="group" aria-label="Show suggestions" className="mb-4 flex flex-wrap gap-1.5">
        {views.map(option => <button key={option.value} type="button" aria-pressed={view === option.value} onClick={() => setView(option.value)} className="area-filter inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[7px] px-2.5 text-[13px]">
          {option.label}<span className="font-mono text-[11px]" style={{ color: "var(--ink-3)" }}>{option.count}</span>
        </button>)}
      </div>
      {shown.length ? <SuggestionItems suggestions={shown} canAddress={canAddress} /> : <p className="text-[14px] text-(--ink-3)">{view === "pending" ? "Nothing pending: every suggestion has been addressed." : "No suggestions addressed yet."}</p>}
    </>}
  </section>;
}
/** The side-column entry point: an action, not metadata, so a dashed accent outline instead of a glass card. */
export function SuggestCard({ sent, focus = false, onOpen }: { sent: boolean; focus?: boolean; onOpen: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (focus) button.current?.focus(); }, [focus]);
  return <div className="flex flex-col gap-3">
    <button ref={button} type="button" onClick={onOpen} className="suggest-card flex cursor-pointer items-start gap-3 rounded-[20px] p-5 text-left">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" }}><Icon name="edit" size={18} /></span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>Suggest an improvement</span>
        <span className="mt-0.5 block text-[13px]" style={{ color: "var(--ink-2)" }}>Have an idea to improve this solution? Share your suggestion with the solution team.</span>
        <span className="mt-1.5 block text-[12px]" style={{ color: "var(--ink-3)" }}>Only the owner, the people credited on this solution and the PRISMA librarian see it, with your name.</span>
      </span>
    </button>
    {sent && <p role="status" className="px-1 text-[13.5px] text-(--ink-2)">Thanks. Your suggestion was sent to the owner, the people credited on this solution and the librarian.</p>}
  </div>;
}

export function SuggestForm({ api, solutionId, onClose, onSent }: { api: SuggestionApi; solutionId: string; onClose: () => void; onSent: () => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // The form opens below the solution details, away from the button: bring it into view and put the cursor in it.
  useEffect(() => {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRef.current?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    textRef.current?.focus({ preventScroll: true });
  }, []);
  const send = async () => {
    setBusy(true); setError("");
    try { await sendSuggestion(api, solutionId, text, new AbortController().signal); onSent(); }
    catch { setError("Your suggestion was not sent. Try again in a moment."); }
    finally { setBusy(false); }
  };
  return <section ref={sectionRef} className={panel} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="text-[16px] font-semibold">Suggest an improvement</h2>
    <p className="mt-1 text-[13px] text-(--ink-2)">Only the owner, the people credited on this solution and the PRISMA librarian see it, with your name.</p>
    <label className="sr-only" htmlFor={`${id}-text`}>Suggestion</label>
    <textarea ref={textRef} id={`${id}-text`} className={`${submissionInputClass} mt-3 min-h-28 resize-y`} maxLength={SUGGESTION_MAX} value={text} onChange={event => setText(event.target.value)} placeholder="What would make this solution better?" disabled={busy} />
    <p className="mt-1 text-right font-mono text-[11px] text-(--ink-3)">{text.length}/{SUGGESTION_MAX}</p>
    {error && <p role="alert" className="mt-2 text-[13px] text-(--proto)">{error}</p>}
    {busy && <LoadingState className="mt-2" label="Sending suggestion..." />}
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-(--accent) px-4 py-2 text-[14px] font-semibold text-(--on-accent) disabled:cursor-default disabled:opacity-40" disabled={busy || !text.trim()} onClick={() => void send()}>Send suggestion</button>
      <button type="button" className={suggestionButton} disabled={busy} onClick={onClose}>Cancel</button>
    </div>
  </section>;
}
