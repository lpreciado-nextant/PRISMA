import { useRef, useState } from "react";
import type { Solution } from "../types";
import { SolutionCard, type CardManagement } from "../components/SolutionCard";
import { Chip } from "../components/Badges";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OverflowMenu } from "../components/OverflowMenu";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { navigate } from "../lib/router";
import { submissionState } from "../lib/submissionState";

const FILTERS = ["All", "Draft", "Pending review", "Changes requested", "Published"] as const;
type Filter = typeof FILTERS[number];
const matches = (solution: Solution, filter: Filter) => filter === "All" || submissionState(solution) === filter;

export function MySubmissionsView({ entries, onDelete, connected = false, onOpen, onEdit, actions, renderCard }: { entries: { solution: Solution }[]; onDelete?: (id: string) => Promise<void>; connected?: boolean; onOpen?: (solution: Solution) => void; onEdit?: (solution: Solution) => void; actions?: React.ReactNode; renderCard?: (solution: Solution, index: number, manage: CardManagement) => React.ReactNode }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [feedbackTarget, setFeedbackTarget] = useState<Solution | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Solution | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const newSubmissionRef = useRef<HTMLButtonElement>(null);
  const confirmDelete = async () => {
    if (!deleteTarget || deleting || !onDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
      newSubmissionRef.current?.focus();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete the submission. Try again.");
    } finally {
      setDeleting(false);
    }
  };
  const edit = (solution: Solution) => onEdit ? onEdit(solution) : navigate(`/submit/${solution.id}`);
  // Connected Pending review and Published records are not edited in place: they are withdrawn from their submission page.
  const editable = (solution: Solution) => !connected || solution.publicationStatus === "Draft";
  const manage = (solution: Solution): CardManagement => {
    const name = solution.name || "Untitled solution";
    return {
      // Returned and retired records both carry the librarian's words the owner needs to act on.
      onFeedback: ["Changes requested", "Retired"].includes(submissionState(solution)) && solution.reviewComments ? () => setFeedbackTarget(solution) : undefined,
      actions: <>
        {editable(solution) && <button type="button" aria-label={`Edit ${name}`} onClick={() => edit(solution)} className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1 text-[13px] font-semibold" style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}><Icon name="edit" size={14} />Edit</button>}
        {onDelete && <OverflowMenu label={`More actions for ${name}`} items={[{ label: "Delete submission", icon: "trash", onSelect: () => { setDeleteError(""); setDeleteTarget(solution); } }]} />}
      </>,
    };
  };
  const count = (option: Filter) => entries.filter(({ solution }) => matches(solution, option)).length;
  const visible = entries.filter(({ solution }) => matches(solution, filter));
  return <div className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={{ borderColor: "var(--glass-edge)" }}>
      <div>
        <p className="eyebrow">Contributor workspace</p>
        <h1 className="mt-2 text-[26px]">My submissions</h1>
        {!connected && <p className="mt-2 text-[14px]" style={{ color: "var(--ink-2)" }}>Saved in this browser only. No Dataverse records or notifications.</p>}
      </div>
      {actions}
      <button ref={newSubmissionRef} className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }} onClick={() => navigate("/submit")}><Icon name="plus" />New submission</button>
    </div>
    {!entries.length ? <div className="py-20 text-center">
      <h2 className="text-[20px]">No submissions yet</h2>
      <p className="mt-2" style={{ color: "var(--ink-2)" }}>No saved drafts or submitted solutions.</p>
    </div> : <>
      <div role="group" aria-label="Filter by status" className="mt-5 flex flex-wrap items-center gap-2">
        {FILTERS.map(option => {
          const total = count(option);
          return <Chip key={option} active={filter === option} pressed={filter === option} onClick={() => setFilter(option)}>
            {option === "Changes requested" && total > 0 && filter !== option && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--proto)" }} />}
            {option}
            <span className="font-mono text-[11px] opacity-75">{total}</span>
          </Chip>;
        })}
      </div>
      {!visible.length ? <div className="py-16 text-center">
        <h2 className="text-[20px]">No submissions in this status</h2>
        <button type="button" className="mt-3 cursor-pointer text-[14px] font-semibold" style={{ color: "var(--accent)" }} onClick={() => setFilter("All")}>Show all submissions</button>
      </div> : <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map(({ solution }, index) => <article key={solution.id} className="min-w-0">
          {renderCard ? renderCard(solution, index, manage(solution)) : <SolutionCard solution={{ ...solution, name: solution.name || "Untitled solution", summary: solution.summary || "No summary yet" }} present={false} index={index} showPublicationStatus manage={manage(solution)} onOpen={onOpen ? () => onOpen(solution) : solution.publicationStatus === "Draft" ? () => navigate(`/submit/${solution.id}`) : undefined} />}
        </article>)}
      </div>}
    </>}
    {feedbackTarget && <FeedbackPanel name={feedbackTarget.name || "Untitled solution"} feedback={feedbackTarget.reviewComments ?? ""} retired={feedbackTarget.publicationStatus === "Retired"} onClose={() => setFeedbackTarget(null)} onEdit={editable(feedbackTarget) ? () => { const target = feedbackTarget; setFeedbackTarget(null); edit(target); } : undefined} />}
    {deleteTarget && <ConfirmDialog title="Delete submission?" confirmLabel={deleting ? "Deleting..." : "Delete submission"} busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete}>
      <p className="break-words text-[14px]">Permanently delete "{deleteTarget.name}" and its attached media from {connected ? "Dataverse" : "this browser"}? This cannot be undone.{deleteTarget.publicationStatus === "Published" ? " It will also be removed from the library and published access revoked." : ""}</p>
      {deleteError && <p role="alert" className="mt-3 text-[14px]">{deleteError}</p>}
    </ConfirmDialog>}
  </div>;
}
