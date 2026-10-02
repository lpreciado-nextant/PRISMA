import { useEffect, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";
import { LoadingState } from "../../src/components/LoadingState";
import { ConfirmDialog } from "../../src/components/ConfirmDialog";
import { MySubmissionsView } from "../../src/views/MySubmissionsView";
import { DetailView } from "../../src/views/DetailView";
import { ReviewPanel, ReviewQueue } from "../../src/components/ReviewQueue";
import { reviewChecklist } from "../../src/lib/reviewChecklist";
import type { Solution } from "../../src/types";
import { navigate } from "../../src/lib/router";
import { readAll } from "./catalogue";
import { workflowApi, readRows } from "./dataSource";
import { deleteSubmission, loadSubmissions, mediaAsset, parseSubmission, PUBLICATIONS, submissionSolution, type SubmissionDetail } from "./workflow";
import { loadDraftReferences } from "./drafts";
import { MediaPreview } from "./DraftMediaEditor";
import { PublishedGallery } from "./PublishedView";
import type { MediaItem } from "./media";
import { useMediaAction } from "./useMediaAction";
import { ConnectedSolutionCard } from "./ConnectedSolutionCard";
import { contributorCredit } from "./draftGraph";
import { ProtectedImage } from "./ProtectedImage";

const button = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3 py-2 text-[14px] disabled:opacity-50";
const shell = "mx-auto max-w-[1100px] px-6 py-10";
// Transitions that change what CSMs can see are confirmed first; each key is the plug-in action it sends.
const CONFIRMATIONS = {
  withdraw: { title: "Withdraw submission?", label: "Withdraw & edit", body: "This submission will return to Draft for editing. Any published access will be removed until it is approved again." },
  "request-changes": { title: "Send back for changes?", label: "Send back for changes", body: "It leaves the library and CSMs lose access to it. The owner sees your comments as Changes requested, and it returns to the review queue when they resubmit." },
  retire: { title: "Retire from the library?", label: "Retire from library", body: "It disappears from search and browse and CSMs lose access to it. Nothing is deleted: the owner sees your reason and can update it and resubmit it for approval." },
} as const;

export function SubmissionsView({ review }: { review: boolean }) {
  const [state, setState] = useState<{ entries: { solution: Solution; rowVersion: string; owner?: string; imageCount?: number; attachmentCount?: number }[]; librarian: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const uncertainDeletes = useRef(new Set<string>());
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const timeout = window.setTimeout(() => { controller.abort(); setError(true); }, 20_000);
    void Promise.all([loadSubmissions(workflowApi, review, controller.signal), loadDraftReferences(readRows, controller.signal)]).then(([result, references]) => {
      controller.signal.throwIfAborted();
      const names = Object.fromEntries([...references.areas, ...references.capabilities].map(option => [option.id, option.name]));
      uncertainDeletes.current.clear();
      setState({ entries: result.records.map(record => ({ solution: submissionSolution(record, names), rowVersion: record.core.rowVersion, owner: record.owner, imageCount: record.imageCount, attachmentCount: record.attachmentCount })), librarian: result.librarian });
    }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [review, attempt]);
  if (error || !state) return <section className={shell}>{error ? <div role="alert"><p className="mb-4">{review ? "Review queue unavailable. An explicit PRISMA Librarian role and Dataverse read access are required." : "Submissions unavailable. Check your Dataverse access and connection."}</p><button className={button} onClick={() => { setError(false); setState(null); setAttempt(current => current + 1); }}><Icon name="arrowRight" />Retry</button></div> : <LoadingState variant="page" label={review ? "Loading review queue..." : "Loading submissions..."} />}</section>;
  const open = (solution: Solution) => navigate(solution.publicationStatus === "Draft" ? `/submit?draft=${solution.id}` : `/submission/${solution.id}`);
  const remove = async (id: string) => {
    const entry = state.entries.find(item => item.solution.id === id);
    const controller = lifetime.current;
    if (!entry || !controller || controller.signal.aborted || uncertainDeletes.current.has(id)) throw new Error("Refresh submissions before deleting this record.");
    uncertainDeletes.current.add(id);
    const operation = new AbortController();
    const abort = () => operation.abort();
    controller.signal.addEventListener("abort", abort, { once: true });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        deleteSubmission(workflowApi, { id, rowVersion: entry.rowVersion }, operation.signal),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => { operation.abort(); reject(new Error("Delete timed out.")); }, 30_000); }),
      ]);
      operation.signal.throwIfAborted();
      setState(current => current ? { ...current, entries: current.entries.filter(item => item.solution.id !== id) } : current);
    } catch { throw new Error("Deletion was not confirmed. Cancel and refresh submissions before retrying."); }
    finally { clearTimeout(timeout); controller.signal.removeEventListener("abort", abort); }
  };
  if (!review) return <MySubmissionsView connected entries={state.entries} onOpen={open} onEdit={open} onDelete={remove} renderCard={(solution, index, manage) => <ConnectedSolutionCard solution={solution} index={index} present={false} owned manage={manage} onOpen={() => open(solution)} />} actions={<div className="flex flex-wrap gap-3"><button className={button} onClick={() => { setState(null); setAttempt(current => current + 1); }}><Icon name="refresh" />Refresh submissions</button>{state.librarian && <button className={button} onClick={() => navigate("/review")}><Icon name="shield" />Review queue</button>}</div>} />;
  return <ReviewQueue entries={state.entries} connected />;
}

export function SubmissionView({ id, review }: { id: string; review: boolean }) {
  const [state, setState] = useState<SubmissionDetail | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [namesLoaded, setNamesLoaded] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState("");
  const [cleared, setCleared] = useState(false);
  const [confirmation, setConfirmation] = useState<keyof typeof CONFIRMATIONS | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const mediaAction = useMediaAction(setPreview, { solutionId: id, mode: "submission" });
  const lifetime = useRef<AbortController | null>(null);
  const running = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const timeout = window.setTimeout(() => { controller.abort(); setError("Submission could not be loaded."); }, 20_000);
    void workflowApi.read(id).then(parseSubmission).then(result => {
      controller.signal.throwIfAborted();
      if (result.record.core.id !== id || (review && !result.librarian)) throw new Error("Submission access denied.");
      setState(result);
    }).catch(() => { if (!controller.signal.aborted) setError("Submission unavailable. Check your access and retry."); }).finally(() => window.clearTimeout(timeout));
    const definitions = [
      ["people", "cr6b0_consultantid", "cr6b0_consultantname"], ["projects", "cr6b0_projectid", "cr6b0_projecttitle"],
      ["technologies", "nx_technologyid", "nx_technologyname"], ["industries", "nx_industryid", "nx_industryname"],
      ["areas", "nx_specializationareaid", "nx_specializationareaname"], ["capabilities", "nx_capabilityid", "nx_capabilityname"],
    ] as const;
    void Promise.all(definitions.map(async ([table, primary, label]) => {
      try { return (await readAll(readRows, table, { select: [primary, label, ...(table === "people" ? ["cr6b0_email"] : [])], filter: "statecode eq 0" }, controller.signal)).flatMap(row => {
        const values = row as Record<string, unknown>;
        if (table === "people" && !controller.signal.aborted && typeof values[primary] === "string" && typeof values.cr6b0_email === "string") setEmails(current => ({ ...current, [values[primary] as string]: values.cr6b0_email as string }));
        return typeof values[primary] === "string" && typeof values[label] === "string" ? [[values[primary] as string, values[label] as string]] : [];
      }); } catch { return []; }
    })).then(lists => { if (!controller.signal.aborted) { setNames(Object.fromEntries(lists.flat())); setNamesLoaded(true); } });
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [id, review, attempt]);
  const transition = async (action: string) => {
    const controller = lifetime.current;
    if (!state || !controller || controller.signal.aborted || running.current || uncertain) return;
    running.current = true;
    setBusy(true);
    let expired = false;
    const timeout = window.setTimeout(() => { expired = true; if (!controller.signal.aborted) { setUncertain(true); setBusy(false); setError("Transition was not confirmed. Reopen before retrying."); } }, 30_000);
    try {
      const next = parseSubmission(await workflowApi.transition(id, state.record.core.rowVersion, action, comments, cleared));
      controller.signal.throwIfAborted();
      if (expired) return;
      if (next.record.core.id !== id || next.record.core.rowVersion === state.record.core.rowVersion) throw new Error("Unconfirmed transition.");
      setState(next);
      setError("");
      setComments("");
      setCleared(false);
      if (action === "withdraw") navigate(`/submit?draft=${id}`);
    } catch {
      if (!controller.signal.aborted) { setUncertain(true); setError("Transition was not confirmed. Check required content, uploads, permissions and the saved version, then reopen before retrying."); }
    } finally { window.clearTimeout(timeout); running.current = false; if (!controller.signal.aborted) setBusy(false); }
  };
  const reload = () => { setError(""); setState(null); setNamesLoaded(false); setUncertain(false); setPreview(null); setAttempt(current => current + 1); };
  const core = state?.record.core;
  const status = state?.record.publication;
  const missing = !core || !core.summary.trim() || !core.capabilityId || !core.safetyAcknowledged || (!!core.clientContext.trim() && !core.clientContextRedacted.trim()) || !state?.graph.hours.length || state.graph.hours.some(hours => hours === null) || !state.media.some(item => item.kind === "image" && item.complete) || state.media.some(item => !item.complete);
  if (!state || !core || !namesLoaded || state.record.areaIds.some(area => !["ai", "data", "ibo"].includes(names[area]))) return <section className={shell}><button className={button} onClick={() => navigate(review ? "/review" : "/my-submissions")}><Icon name="chevronLeft" />{review ? "Review queue" : "My submissions"}</button>{error || namesLoaded ? <div role="alert" className="my-6"><p className="mb-3">{error || "Specialization unavailable. Check your reference-data access."}</p><button className={button} onClick={reload}><Icon name="arrowRight" />Reopen</button></div> : <LoadingState variant="page" label="Loading submission..." />}</section>;
  if (preview) return <MediaPreview key={preview.id} item={preview} solutionId={core.id} mode="submission" viewerTitle={core.name} onClose={() => setPreview(null)} />;
  const graph = state.graph.graph;
  const thumbnail = state.media.find(item => item.kind === "thumbnail" && item.complete);
  const solution: Solution = { ...submissionSolution(state.record, names), technologies: graph.technologyIds.map(id => names[id] ?? "Unavailable technology"), industries: graph.industryIds.map(id => names[id] ?? "Unavailable industry"), projects: graph.projectIds.map(id => ({ id, projectName: names[id] ?? `Untitled project (${id.slice(0, 8)})` })), assets: state.media.filter(item => item.kind === "attachment" && item.complete).map(mediaAsset) };
  const effort = { contributors: graph.contributors.map((person, index) => contributorCredit(person, core.maturity, names[person.personId] ?? "Unavailable consultant", state.graph.hours[index], emails[person.personId])), totalHours: state.graph.hours.some(hours => hours === null) ? null : Math.round(state.graph.hours.reduce<number>((total, hours) => total + (hours ?? 0), 0) * 100) / 100 };
  return <DetailView solution={solution} present={false} connected effort={effort} backLabel={review ? "Review queue" : "My submissions"} onBack={() => navigate(review ? "/review" : "/my-submissions")} onEdit={!review && status === 125060003 ? () => navigate(`/submit?draft=${id}`) : undefined}
    poster={thumbnail && <div className="h-full overflow-hidden"><ProtectedImage item={thumbnail} className="h-full w-full object-cover" /></div>}
    imageCount={state.media.filter(item => item.kind === "image" && item.complete).length} gallery={<PublishedGallery media={state.media} />} onAssetOpen={asset => void mediaAction.open(state.media.find(item => item.id === asset.id))} reviewActions={
      <>{review ? <ReviewPanel status={PUBLICATIONS[state.record.publication]} owner={state.record.owner} client={core.clientContext} context={core.clientContextRedacted} feedback={state.record.comments}
        solution={solution} checks={reviewChecklist({
          summary: !!core.summary.trim(), capability: !!core.capabilityId,
          contributors: state.graph.hours.length > 0 && state.graph.hours.every(hours => hours !== null),
          images: state.media.filter(item => item.kind === "image" && item.complete).length, uploadsComplete: state.media.every(item => item.complete),
          safety: core.safetyAcknowledged, anonymized: !core.clientContext.trim() || !!core.clientContextRedacted.trim(),
        })}
        comments={comments} onComments={setComments} cleared={cleared} onCleared={setCleared} busy={busy} locked={uncertain || !state.librarian} canApprove={!missing} notice={mediaAction.message} noticeBusy={mediaAction.downloading}
        error={error && <><p className="mb-3">{error}</p><button className={button} disabled={busy} onClick={reload}><Icon name="arrowRight" />Reopen</button></>}
        onReturn={() => void transition("return")} onApprove={() => void transition("approve")}
        onRequestChanges={state.librarian && status === 125060000 && !uncertain ? () => setConfirmation("request-changes") : undefined}
        onRetire={state.librarian && status === 125060000 && !uncertain ? () => setConfirmation("retire") : undefined}>
      </ReviewPanel> : <section aria-label="Submission status" className="mt-5 border-y border-(--glass-edge) py-5">
        <p className="eyebrow">Contributor workspace</p><h2 className="mt-2 text-[20px]">{PUBLICATIONS[state.record.publication]}</h2>
        {mediaAction.downloading ? <LoadingState className="mt-4" label={mediaAction.message} /> : mediaAction.message && <p className="mt-4 text-[14px] text-(--ink-2)" role={mediaAction.failed ? "alert" : "status"}>{mediaAction.message}</p>}
        {error && <div role="alert" className="my-4"><p className="mb-3">{error}</p><button className={button} disabled={busy} onClick={reload}><Icon name="arrowRight" />Reopen</button></div>}
        {state.record.comments && <section className="my-4 border-l-2 border-(--proto) pl-3"><h3 className="text-[14px] font-semibold">Latest review comments</h3><p className="mt-1 whitespace-pre-wrap break-words text-[14px]">{state.record.comments}</p></section>}
        <p className="mb-4 text-[14px]">{core.safetyAcknowledged ? "Safety acknowledged" : "Safety acknowledgment required"}{state.record.cleared ? " · Cleared for presentation" : ""}</p>
        {missing && status === 125060003 && <p role="status" className="mb-4 text-[14px]">Complete the summary, capability, contributor effort, redacted context when needed, detail images and safety acknowledgment before submitting.</p>}
        <fieldset disabled={busy || uncertain} className="min-w-0 space-y-4">
          {!review && status === 125060003 && <div className="flex flex-wrap gap-3"><button className={button} onClick={() => navigate(`/submit?draft=${id}`)}><Icon name="file" />Edit draft</button><button className={button} disabled={missing} onClick={() => void transition("submit")}><Icon name="check" />Submit for review</button></div>}
          {!review && status !== 125060003 && <button className={button} onClick={() => setConfirmation("withdraw")}><Icon name="file" />Withdraw &amp; edit</button>}
        </fieldset>{busy && <LoadingState className="mt-4" label="Updating submission..." />}
      </section>}
        {confirmation && <ConfirmDialog title={CONFIRMATIONS[confirmation].title} confirmLabel={CONFIRMATIONS[confirmation].label} onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); void transition(confirmation); }}>
          <p className="mb-3 font-semibold text-(--ink)">{core.name}</p>
          <p>{CONFIRMATIONS[confirmation].body}</p>
        </ConfirmDialog>}
      </>
    } />;
}