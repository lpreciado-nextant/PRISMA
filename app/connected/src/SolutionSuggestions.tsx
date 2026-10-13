import { useId, useState } from "react";
import { Icon } from "../../src/components/Icon";
import { LoadingState } from "../../src/components/LoadingState";
import { submissionInputClass } from "../../src/components/SubmissionForm";
import { sendSuggestion, SUGGESTION_MAX, type SuggestionApi, type SuggestionList } from "./suggestions";

export const suggestionButton = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3 py-2 text-[14px] disabled:cursor-default disabled:opacity-40";
const panel = "glass glass-lite rounded-[20px] p-5";

export function SuggestionsPanel({ list }: { list: SuggestionList }) {
  return <section className={panel} aria-labelledby="suggestions-heading">
    <div className="mb-3 flex items-center gap-2"><Icon name="edit" size={14} /><h2 id="suggestions-heading" className="eyebrow">Suggestions · {list.suggestions.length} · internal only</h2></div>
    {list.suggestions.length === 0 ? <p className="text-[14px] text-(--ink-3)">No suggestions yet. Colleagues who view this solution can send one.</p>
      : <ul className="flex flex-col gap-4">{list.suggestions.map(item => <li key={item.id} className="border-b border-(--glass-edge) pb-4 last:border-b-0 last:pb-0">
        <p className="text-[12.5px] text-(--ink-3)"><span className="font-semibold text-(--ink-2)">{item.author}</span> · <time dateTime={item.createdOn}>{new Date(item.createdOn).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time></p>
        <p className="mt-1 whitespace-pre-wrap break-words text-[14.5px] text-(--ink)">{item.text}</p>
      </li>)}</ul>}
  </section>;
}

export function SuggestForm({ api, solutionId, onClose, onSent }: { api: SuggestionApi; solutionId: string; onClose: () => void; onSent: () => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    setBusy(true); setError("");
    try { await sendSuggestion(api, solutionId, text, new AbortController().signal); onSent(); }
    catch { setError("Your suggestion was not sent. Try again in a moment."); }
    finally { setBusy(false); }
  };
  return <section className={panel} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="text-[16px] font-semibold">Suggest a change</h2>
    <p className="mt-1 text-[13px] text-(--ink-2)">Only the owner, the contributors and the librarian will see it, with your name.</p>
    <label className="sr-only" htmlFor={`${id}-text`}>Suggestion</label>
    <textarea id={`${id}-text`} className={`${submissionInputClass} mt-3 min-h-28 resize-y`} maxLength={SUGGESTION_MAX} value={text} onChange={event => setText(event.target.value)} placeholder="e.g. Add an export to Excel so finance can share the unmatched items." disabled={busy} />
    <p className="mt-1 text-right font-mono text-[11px] text-(--ink-3)">{text.length}/{SUGGESTION_MAX}</p>
    {error && <p role="alert" className="mt-2 text-[13px] text-(--proto)">{error}</p>}
    {busy && <LoadingState className="mt-2" label="Sending suggestion..." />}
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-(--accent) px-4 py-2 text-[14px] font-semibold text-(--on-accent) disabled:cursor-default disabled:opacity-40" disabled={busy || !text.trim()} onClick={() => void send()}>Send</button>
      <button type="button" className={suggestionButton} disabled={busy} onClick={onClose}>Cancel</button>
    </div>
  </section>;
}
