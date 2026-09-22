import { useId, useState, type ReactNode } from "react";
import type { Solution, SpecializationArea } from "../types";
import { AREA_ORDER, AREAS } from "../data/catalogueMetadata";
import { navigate } from "../lib/router";
import { Icon } from "./Icon";
import { LoadingState } from "./LoadingState";
import { SelectPicker } from "./SelectPicker";

const filters = ["Pending review", "Changes requested", "Published"] as const;
type Entry = { solution: Solution; owner?: string; imageCount?: number; attachmentCount?: number };
const matches = ({ solution }: Entry, status: string) => status === "Changes requested"
  ? solution.publicationStatus === "Draft" && solution.reviewOutcome === status : solution.publicationStatus === status;

export function ReviewPanel({ status, owner, client, context, feedback, comments, onComments, cleared, onCleared, busy, locked = false, canApprove = true, local = false, notice, noticeBusy = false, error, onReturn, onApprove, children }: {
  status: string; owner?: string; client?: string; context?: string; feedback?: string; comments: string; onComments: (value: string) => void;
  cleared: boolean; onCleared: (value: boolean) => void; busy: boolean; locked?: boolean; canApprove?: boolean; local?: boolean;
  notice?: ReactNode; noticeBusy?: boolean; error?: ReactNode; onReturn: () => void; onApprove: () => void; children?: ReactNode;
}) {
  const heading = useId();
  return <section aria-labelledby={heading} className="mt-5 border-y border-(--glass-edge) py-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Librarian{local && " · local preview"}</p><h2 id={heading} className="mt-2 text-[20px]">{status}</h2></div>{owner && <p className="break-all text-[13px] text-(--ink-2)">Submitted by {owner}</p>}</div>
    <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2"><div className="min-w-0"><dt className="font-semibold">Client (internal)</dt><dd className="mt-1 break-words text-(--ink-2)">{client || "No client"}</dd></div><div className="min-w-0"><dt className="font-semibold">Presentation context</dt><dd className="mt-1 break-words text-(--ink-2)">{context || "Not provided"}</dd></div></dl>
    {noticeBusy && typeof notice === "string" ? <LoadingState className="mt-3" label={notice} /> : notice && <div role="status" className="mt-3 text-[14px] text-(--ink-2)">{notice}</div>}
    {feedback && <div className="mt-4 border-l-2 border-(--proto) pl-3"><h3 className="text-[14px] font-semibold">Latest review comments</h3><p className="mt-1 whitespace-pre-wrap break-words text-[14px]">{feedback}</p></div>}
    {status === "Pending review" && <fieldset disabled={busy || locked} className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
      <label className="block text-[14px] font-semibold">Comments to contributor <span className="font-normal text-(--ink-2)">(required when returning)</span><textarea value={comments} onChange={event => onComments(event.target.value)} maxLength={4000} rows={3} className="mt-2 block w-full resize-y rounded-lg border border-(--glass-edge) bg-transparent px-3 py-2 font-normal" /></label>
      <div className="flex min-w-0 flex-col justify-between gap-5"><label className="flex items-start gap-3 text-[14px]"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={cleared} onChange={event => onCleared(event.target.checked)} /><span>I have reviewed the descriptions, contributor effort, screenshots and all attachments. Client-visible content is authorized and anonymized.</span></label>
        <div className="flex flex-wrap gap-3"><button type="button" disabled={!comments.trim() || busy || locked} onClick={onReturn} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"><Icon name="chevronLeft" />Return for changes</button><button type="button" disabled={!cleared || !canApprove || busy || locked} onClick={onApprove} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-(--accent) px-4 py-2.5 text-[14px] font-semibold text-(--on-accent) disabled:cursor-not-allowed disabled:opacity-40"><Icon name="check" />Approve &amp; publish</button></div>
      </div>
    </fieldset>}
    {busy && <LoadingState className="mt-3" label="Saving review..." />}{error && <div role="alert" className="mt-3">{error}</div>}{children}
  </section>;
}

export function ReviewQueue({ entries, connected = false }: { entries: Entry[]; connected?: boolean }) {
  const [filter, setFilter] = useState<typeof filters[number]>("Pending review");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<SpecializationArea | "">("");
  const visible = entries.filter(entry => matches(entry, filter))
    .filter(({ solution }) => !area || solution.specializationArea === area)
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
        <div className="min-w-0"><p className="eyebrow">{AREAS[solution.specializationArea].name}</p><h2 className="mt-1 break-words text-[18px] font-semibold">{solution.name || "Untitled solution"}</h2><p className="mt-1 break-words text-[14px] text-(--ink-2)">{solution.summary}</p>
          {(!connected || imageCount !== undefined) && <p className="mt-2 break-all text-[12px] text-(--ink-3)">{[owner, solution.dateAdded, `${imageCount ?? solution.images?.length ?? 0} images`, `${attachmentCount ?? solution.assets.length} attachments`].filter(Boolean).join(" · ")}</p>}
        </div>
        <button type="button" aria-label={`${filter === "Pending review" ? "Review" : "View"} ${solution.name}`} onClick={() => navigate(`/review/${solution.id}`)} className="inline-flex cursor-pointer items-center justify-center gap-2 self-center justify-self-start rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px] font-semibold">{filter === "Pending review" ? "Review submission" : "View status"}<Icon name="arrowRight" /></button>
      </li>)}
    </ul>}
  </section>;
}