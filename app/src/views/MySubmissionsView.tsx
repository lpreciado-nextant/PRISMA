import { useEffect, useRef, useState } from "react";
import type { Solution } from "../types";
import type { SubmissionEntry } from "../lib/submissions";
import { SolutionCard } from "../components/SolutionCard";
import { Icon } from "../components/Icon";
import { navigate } from "../lib/router";

export function MySubmissionsView({ entries, onDelete }: { entries: SubmissionEntry[]; onDelete: (id: string) => Promise<void> }) {
  const [deleteTarget, setDeleteTarget] = useState<Solution | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const newSubmissionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (deleteTarget) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [deleteTarget]);
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(deleteTarget.id);
      dialogRef.current?.close();
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
        <p className="mt-2 text-[14px]" style={{ color: "var(--ink-2)" }}>Saved in this browser only. No Dataverse records or notifications.</p>
      </div>
      <button ref={newSubmissionRef} className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }} onClick={() => navigate("/submit")}><Icon name="plus" />New submission</button>
    </div>
    {!entries.length ? <div className="py-20 text-center">
      <h2 className="text-[20px]">No submissions yet</h2>
      <p className="mt-2" style={{ color: "var(--ink-2)" }}>No saved drafts or submitted solutions.</p>
    </div> : <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(({ solution }, index) => <article key={solution.id} className="min-w-0">
        <SolutionCard solution={{ ...solution, name: solution.name || "Untitled solution", summary: solution.summary || "No summary yet" }} present={false} index={index} showPublicationStatus onOpen={solution.publicationStatus === "Draft" ? () => navigate(`/submit/${solution.id}`) : undefined} />
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          <button className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: "var(--glass-edge)" }} onClick={() => navigate(`/submit/${solution.id}`)}><Icon name="file" />Edit submission</button>
          <button type="button" aria-label={`Delete ${solution.name}`} title="Delete submission" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border" style={{ borderColor: "var(--glass-edge)", color: "var(--ink-2)" }} onClick={() => { setDeleteError(""); setDeleteTarget(solution); }}><Icon name="trash" /></button>
        </div>
        {solution.reviewComments && <div className="mt-3 border-l-2 pl-3" style={{ borderColor: "var(--proto)" }}><h2 className="text-[13px] font-semibold">Librarian feedback</h2><p className="mt-1 whitespace-pre-wrap break-words text-[14px]" style={{ color: "var(--ink-2)" }}>{solution.reviewComments}</p></div>}
      </article>)}
    </div>}
    <dialog ref={dialogRef} aria-labelledby="delete-submission-title" aria-describedby="delete-submission-description" onCancel={(event) => { if (deleting) event.preventDefault(); else setDeleteTarget(null); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!deleting) setDeleteTarget(null); } }} className="m-auto w-[calc(100%-2rem)] max-w-[440px] rounded-lg border p-6 shadow-2xl backdrop:bg-black/50" style={{ background: "var(--ground)", color: "var(--ink)", borderColor: "var(--glass-edge)" }}>
      <h2 id="delete-submission-title" className="text-[20px] font-semibold">Delete submission?</h2>
      <p id="delete-submission-description" className="mt-3 break-words text-[14px]" style={{ color: "var(--ink-2)" }}>Permanently delete "{deleteTarget?.name}" and its attached media from this browser? This cannot be undone.{deleteTarget?.publicationStatus === "Published" ? " It will also be removed from the library." : ""}</p>
      {deleteError && <p role="alert" className="mt-3 text-[14px]">{deleteError}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" autoFocus disabled={deleting} onClick={() => setDeleteTarget(null)} className="cursor-pointer rounded-lg border px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: "var(--glass-edge)" }}>Cancel</button>
        <button type="button" disabled={deleting} onClick={() => void confirmDelete()} className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "var(--ink)", color: "var(--ground)" }}><Icon name="trash" />{deleting ? "Deleting..." : "Delete submission"}</button>
      </div>
    </dialog>
  </div>;
}