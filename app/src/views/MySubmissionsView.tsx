import { useRef, useState } from "react";
import type { Solution } from "../types";
import { SolutionCard } from "../components/SolutionCard";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { navigate } from "../lib/router";

export function MySubmissionsView({ entries, onDelete, connected = false, onOpen, onEdit, actions, renderCard }: { entries: { solution: Solution }[]; onDelete?: (id: string) => Promise<void>; connected?: boolean; onOpen?: (solution: Solution) => void; onEdit?: (solution: Solution) => void; actions?: React.ReactNode; renderCard?: (solution: Solution, index: number) => React.ReactNode }) {
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
    </div> : <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(({ solution }, index) => <article key={solution.id} className="min-w-0">
        {renderCard ? renderCard(solution, index) : <SolutionCard solution={{ ...solution, name: solution.name || "Untitled solution", summary: solution.summary || "No summary yet" }} present={false} index={index} showPublicationStatus onOpen={onOpen ? () => onOpen(solution) : solution.publicationStatus === "Draft" ? () => navigate(`/submit/${solution.id}`) : undefined} />}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          <button className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: "var(--glass-edge)" }} onClick={() => onEdit ? onEdit(solution) : navigate(`/submit/${solution.id}`)}><Icon name="file" />{connected && solution.publicationStatus !== "Draft" ? "View submission" : "Edit submission"}</button>
          {onDelete && <button type="button" aria-label={`Delete ${solution.name}`} title="Delete submission" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border" style={{ borderColor: "var(--glass-edge)", color: "var(--ink-2)" }} onClick={() => { setDeleteError(""); setDeleteTarget(solution); }}><Icon name="trash" /></button>}
        </div>
        {solution.reviewComments && <div className="mt-3 border-l-2 pl-3" style={{ borderColor: "var(--proto)" }}><h2 className="text-[13px] font-semibold">Librarian feedback</h2><p className="mt-1 whitespace-pre-wrap break-words text-[14px]" style={{ color: "var(--ink-2)" }}>{solution.reviewComments}</p></div>}
      </article>)}
    </div>}
    {deleteTarget && <ConfirmDialog title="Delete submission?" confirmLabel={deleting ? "Deleting..." : "Delete submission"} busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete}>
      <p className="break-words text-[14px]">Permanently delete "{deleteTarget.name}" and its attached media from {connected ? "Dataverse" : "this browser"}? This cannot be undone.{deleteTarget.publicationStatus === "Published" ? " It will also be removed from the library and published access revoked." : ""}</p>
      {deleteError && <p role="alert" className="mt-3 text-[14px]">{deleteError}</p>}
    </ConfirmDialog>}
  </div>;
}