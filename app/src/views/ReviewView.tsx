import { useState } from "react";
import { Icon } from "../components/Icon";
import { AREA_ORDER, AREAS } from "../data/solutions";
import { REVIEW_COMMENT_LIMIT, type SubmissionEntry } from "../lib/submissions";
import { navigate } from "../lib/router";
import { DetailView } from "./DetailView";

type ReviewFilter = "Pending review" | "Changes requested" | "Published";
const FILTERS: ReviewFilter[] = ["Pending review", "Changes requested", "Published"];

function matches(entry: SubmissionEntry, filter: ReviewFilter): boolean {
  return filter === "Changes requested"
    ? entry.solution.publicationStatus === "Draft" && entry.solution.reviewOutcome === "Changes requested"
    : entry.solution.publicationStatus === filter;
}

export function ReviewView({ entries, selectedId, onDecision }: {
  entries: SubmissionEntry[];
  selectedId?: string;
  onDecision: (id: string, decision: "publish" | "return", comments: string, clientSafe: boolean) => Promise<void>;
}) {
  const [filter, setFilter] = useState<ReviewFilter>("Pending review");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [comments, setComments] = useState("");
  const [clientSafe, setClientSafe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = entries.find((entry) => entry.solution.id === selectedId);
  const decide = async (decision: "publish" | "return") => {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await onDecision(selected.solution.id, decision, comments, clientSafe);
      setNotice(decision === "publish" ? "Published in the local library." : "Returned to the contributor with your comments.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the review. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (selectedId) {
    if (!selected || selected.solution.publicationStatus === "Draft") return <div className="mx-auto max-w-[1340px] px-6 py-10">
      <button type="button" onClick={() => navigate("/review")} className="inline-flex cursor-pointer items-center gap-2 text-[14px]"><Icon name="chevronLeft" />Review queue</button>
      <h1 className="mt-6 text-[26px]">{selected ? selected.solution.reviewOutcome === "Changes requested" ? "Changes requested" : "Draft" : "Submission unavailable"}</h1>
      <p role="status" className="mt-3">{selected ? "This submission is with its contributor for editing." : "This submission is no longer available for review."}</p>
      {selected?.solution.reviewComments && <p className="mt-4 whitespace-pre-wrap break-words border-l-2 pl-4" style={{ borderColor: "var(--proto)" }}>{selected.solution.reviewComments}</p>}
    </div>;

    return <DetailView solution={selected.solution} present={false} onBack={() => navigate("/review")} backLabel="Review queue" assetBasePath={`/review/${selected.solution.id}`} reviewActions={
      <section aria-labelledby="review-heading" className="mt-5 border-y py-5" style={{ borderColor: "var(--glass-edge)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="eyebrow">Librarian · local preview</p><h2 id="review-heading" className="mt-2 text-[20px]">{selected.solution.publicationStatus}</h2></div>
          <p className="break-all text-[13px]" style={{ color: "var(--ink-2)" }}>Submitted by {selected.owner}</p>
        </div>
        <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2">
          <div className="min-w-0"><dt className="font-semibold">Client (internal)</dt><dd className="mt-1 break-words" style={{ color: "var(--ink-2)" }}>{selected.solution.clientContext || "No client"}</dd></div>
          <div className="min-w-0"><dt className="font-semibold">Presentation context</dt><dd className="mt-1 break-words" style={{ color: "var(--ink-2)" }}>{selected.solution.clientContextRedacted || "Not provided"}</dd></div>
        </dl>
        {notice && <p role="status" className="mt-3">{notice}</p>}
        {selected.solution.reviewComments && <div className="mt-4 border-l-2 pl-3" style={{ borderColor: "var(--proto)" }}><h3 className="text-[14px] font-semibold">Latest review comments</h3><p className="mt-1 whitespace-pre-wrap break-words text-[14px]">{selected.solution.reviewComments}</p></div>}
        {selected.solution.publicationStatus === "Pending review" && <fieldset disabled={saving} className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
          <label className="block text-[14px] font-semibold">Comments to contributor <span className="font-normal" style={{ color: "var(--ink-2)" }}>(required when returning)</span>
            <textarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength={REVIEW_COMMENT_LIMIT} rows={3} className="mt-2 block w-full resize-y rounded-lg border bg-transparent px-3 py-2 font-normal" style={{ borderColor: "var(--glass-edge)" }} />
          </label>
          <div className="flex min-w-0 flex-col justify-between gap-5">
            <label className="flex items-start gap-3 text-[14px]">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={clientSafe} onChange={(event) => setClientSafe(event.target.checked)} />
              <span>I have reviewed the descriptions, contributor effort, screenshots and all attachments. Client-visible content is authorized and anonymized.</span>
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={!comments.trim() || saving} onClick={() => void decide("return")} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: "var(--glass-edge)" }}><Icon name="chevronLeft" />Return for changes</button>
              <button type="button" disabled={!clientSafe || saving} onClick={() => void decide("publish")} className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--on-accent)" }}><Icon name="check" />Approve & publish</button>
            </div>
          </div>
          {saving && <p role="status">Saving review...</p>}
          {error && <p role="alert">{error}</p>}
        </fieldset>}
      </section>
    } />;
  }

  const visible = entries.filter((entry) => matches(entry, filter))
    .filter((entry) => !area || entry.solution.specializationArea === area)
    .filter((entry) => `${entry.solution.name} ${entry.solution.summary} ${entry.owner}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <div className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
    <p className="eyebrow">Librarian · local preview</p>
    <h1 className="mt-2 text-[28px]">Review queue</h1>
    <p className="mt-2 text-[14px]" style={{ color: "var(--ink-2)" }}>Browser-local records. Review access is simulated; no production permissions or notifications.</p>
    <div className="mt-6 flex flex-wrap gap-1 border-b" style={{ borderColor: "var(--glass-edge)" }} aria-label="Review status">
      {FILTERS.map((option) => <button type="button" key={option} aria-pressed={filter === option} onClick={() => setFilter(option)} className="cursor-pointer border-b-2 px-3 py-3 text-[14px] font-semibold" style={{ borderColor: filter === option ? "var(--accent)" : "transparent", color: filter === option ? "var(--ink)" : "var(--ink-2)" }}>{option} <span className="ml-2 font-mono text-[12px]">{entries.filter((entry) => matches(entry, option)).length}</span></button>)}
    </div>
    <div className="my-5 flex flex-wrap gap-4">
      <label className="flex min-w-0 flex-1 basis-64 items-center gap-2 rounded-lg border px-3" style={{ borderColor: "var(--glass-edge)" }}><Icon name="search" /><input type="search" aria-label="Search review queue" placeholder="Search submissions or owners" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px]" /></label>
      <select aria-label="Specialization area" value={area} onChange={(event) => setArea(event.target.value)} className="max-w-full rounded-lg border bg-(--ground) px-3 py-2 text-[14px]" style={{ borderColor: "var(--glass-edge)" }}><option value="">All specializations</option>{AREA_ORDER.map((id) => <option key={id} value={id}>{AREAS[id].name}</option>)}</select>
    </div>
    <p className="text-[13px]" role="status" style={{ color: "var(--ink-2)" }}>{visible.length} {visible.length === 1 ? "submission" : "submissions"}</p>
    {!visible.length ? <div className="py-16 text-center"><Icon name="check" size={26} className="mx-auto" /><h2 className="mt-4 text-[20px]">{query || area ? "No matching submissions" : filter === "Pending review" ? "Nothing awaiting review" : "No submissions in this status"}</h2></div> : <ul className="mt-3">
      {visible.map(({ owner, solution }) => <li key={solution.id} className="grid min-w-0 gap-4 border-b py-5 sm:grid-cols-[minmax(0,1fr)_auto]" style={{ borderColor: "var(--glass-edge)" }}>
        <div className="min-w-0"><p className="eyebrow">{AREAS[solution.specializationArea].name}</p><h2 className="mt-1 break-words text-[18px] font-semibold">{solution.name || "Untitled solution"}</h2><p className="mt-1 break-words text-[14px]" style={{ color: "var(--ink-2)" }}>{solution.summary}</p><p className="mt-2 break-all text-[12px]" style={{ color: "var(--ink-3)" }}>{owner} · {solution.dateAdded} · {solution.images?.length ?? 0} images · {solution.assets.length} attachments</p></div>
        <button type="button" aria-label={`${filter === "Pending review" ? "Review" : "View"} ${solution.name}`} onClick={() => navigate(`/review/${solution.id}`)} className="inline-flex cursor-pointer items-center justify-center gap-2 self-center justify-self-start rounded-lg border px-4 py-2.5 text-[14px] font-semibold" style={{ borderColor: "var(--glass-edge)" }}>{filter === "Pending review" ? "Review submission" : "View status"}<Icon name="arrowRight" /></button>
      </li>)}
    </ul>}
  </div>;
}