import { useEffect, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";
import { LoadingState } from "../../src/components/LoadingState";
import { ConfirmDialog } from "../../src/components/ConfirmDialog";
import { MySubmissionsView } from "../../src/views/MySubmissionsView";
import { DetailView } from "../../src/views/DetailView";
import { ReviewPanel, ReviewQueue } from "../../src/components/ReviewQueue";
import { outlinedStatusButton, statusButton, SubmissionStatusPanel } from "../../src/components/SubmissionStatusPanel";
import { submissionState } from "../../src/lib/submissionState";
import { reviewChecklist } from "../../src/lib/reviewChecklist";
import { newTechnologies, type NewTechnology } from "../../src/lib/technologyName";
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

export function SubmissionView({ id, review, technologyUse }: { id: string; review: boolean; technologyUse?: ReadonlyMap<string, string[]> }) {
  const [state, setState] = useState<SubmissionDetail | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [technologyLabels, setTechnologyLabels] = useState<string[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [levels, setLevels] = useState<Record<string, string>>({});
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
      try { return (await readAll(readRows, table, { select: [primary, label, ...(table === "people" ? ["cr6b0_email", "cr6b0_consultantlevel"] : [])], filter: "statecode eq 0" }, controller.signal)).flatMap(row => {
        const values = row as Record<string, unknown>;
        if (table === "people" && !controller.signal.aborted && typeof values[primary] === "string" && typeof values.cr6b0_email === "string") setEmails(current => ({ ...current, [values[primary] as string]: values.cr6b0_email as string }));
        if (table === "people" && !controller.signal.aborted && typeof values[primary] === "string" && typeof values.cr6b0_consultantlevel === "string" && values.cr6b0_consultantlevel.trim()) setLevels(current => ({ ...current, [values[primary] as string]: (values.cr6b0_consultantlevel as string).trim() }));
        return typeof values[primary] === "string" && typeof values[label] === "string" ? [[values[primary] as string, values[label] as string]] : [];
      }); } catch { return []; }
    })).then(lists => { if (!controller.signal.aborted) { setNames(Object.fromEntries(lists.flat())); setTechnologyLabels(lists[2].map(([, label]) => label)); setNamesLoaded(true); } });
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
  const missing = !core || !core.summary.trim() || !core.whatItDoes.trim() || !core.businessValue.trim() || !core.capabilityId || !core.safetyAcknowledged || (!!core.clientContext.trim() && !core.clientContextRedacted.trim()) || !state?.graph.hours.length || state.graph.hours.some(hours => hours === null) || !state.media.some(item => item.kind === "image" && item.complete) || state.media.some(item => !item.complete);
  if (!state || !core || !namesLoaded || state.record.areaIds.some(area => !["ai", "data", "ibo"].includes(names[area]))) return <section className={shell}><button className={button} onClick={() => navigate(review ? "/review" : "/my-submissions")}><Icon name="chevronLeft" />{review ? "Review queue" : "My submissions"}</button>{error || namesLoaded ? <div role="alert" className="my-6"><p className="mb-3">{error || "Specialization unavailable. Check your reference-data access."}</p><button className={button} onClick={reload}><Icon name="arrowRight" />Reopen</button></div> : <LoadingState variant="page" label="Loading submission..." />}</section>;
  if (preview) return <MediaPreview key={preview.id} item={preview} solutionId={core.id} mode="submission" viewerTitle={core.name} onClose={() => setPreview(null)} />;
  const graph = state.graph.graph;
  const thumbnail = state.media.find(item => item.kind === "thumbnail" && item.complete);
  const solution: Solution = { ...submissionSolution(state.record, names), technologies: graph.technologyIds.map(id => names[id] ?? "Unavailable technology"), industries: graph.industryIds.map(id => names[id] ?? "Unavailable industry"), projects: graph.projectIds.map(id => ({ id, projectName: names[id] ?? `Untitled project (${id.slice(0, 8)})` })), assets: state.media.filter(item => item.kind === "attachment" && item.complete).map(mediaAsset) };
  const effort = { contributors: graph.contributors.map((person, index) => ({ name: names[person.personId] ?? "Unavailable consultant", hours: state.graph.hours[index], email: emails[person.personId], level: levels[person.personId] })), totalHours: state.graph.hours.some(hours => hours === null) ? null : Math.round(state.graph.hours.reduce<number>((total, hours) => total + (hours ?? 0), 0) * 100) / 100 };
  return <DetailView solution={solution} present={false} connected effort={effort} backLabel={review ? "Review queue" : "My submissions"} onBack={() => navigate(review ? "/review" : "/my-submissions")}
    poster={thumbnail && <div className="h-full overflow-hidden"><ProtectedImage item={thumbnail} className="h-full w-full object-cover" /></div>}
    imageCount={state.media.filter(item => item.kind === "image" && item.complete).length} gallery={<PublishedGallery media={state.media} />} onAssetOpen={asset => void mediaAction.open(state.media.find(item => item.id === asset.id))} reviewActions={
      <>{review ? <ReviewPanel status={PUBLICATIONS[state.record.publication]} owner={state.record.owner} client={core.clientContext} context={core.clientContextRedacted} feedback={state.record.comments}
        solution={solution} checks={reviewChecklist({
          summary: !!core.summary.trim(), story: !!core.whatItDoes.trim() && !!core.businessValue.trim(), capability: !!core.capabilityId,
          contributors: state.graph.hours.length > 0 && state.graph.hours.every(hours => hours !== null),
          images: state.media.filter(item => item.kind === "image" && item.complete).length, uploadsComplete: state.media.every(item => item.complete),
          safety: core.safetyAcknowledged, anonymized: !core.clientContext.trim() || !!core.clientContextRedacted.trim(),
        })}
        comments={comments} onComments={setComments} cleared={cleared} onCleared={setCleared} busy={busy} locked={uncertain || !state.librarian} canApprove={!missing} notice={mediaAction.message} noticeBusy={mediaAction.downloading}
        error={error && <><p className="mb-3">{error}</p><button className={button} disabled={busy} onClick={reload}><Icon name="arrowRight" />Reopen</button></>}
        onReturn={() => void transition("return")} onApprove={() => void transition("approve")}
        onRequestChanges={state.librarian && status === 125060000 && !uncertain ? () => setConfirmation("request-changes") : undefined}
        onRetire={state.librarian && status === 125060000 && !uncertain ? () => setConfirmation("retire") : undefined}>
        {technologyUse && <NewTechnologies items={newTechnologies(solution.technologies, new Set([...technologyUse].filter(([, ids]) => ids.some(other => other !== id.toLowerCase())).map(([name]) => name)), technologyLabels)} />}
      </ReviewPanel> : <SubmissionStatusPanel state={submissionState(solution)} feedback={state.record.comments || undefined} actions={<fieldset disabled={busy || uncertain} className="flex min-w-0 flex-wrap items-center gap-2.5">
          {status === 125060003 ? <><button type="button" className={outlinedStatusButton} onClick={() => navigate(`/submit?draft=${id}`)}><Icon name="edit" size={16} />Edit draft</button>
            <button type="button" className={statusButton} style={{ background: "var(--accent)", color: "var(--on-accent)" }} disabled={missing} onClick={() => void transition("submit")}><Icon name="check" size={16} />Submit for review</button></>
          : <button type="button" className={outlinedStatusButton} onClick={() => setConfirmation("withdraw")}><Icon name="edit" size={16} />Withdraw &amp; edit</button>}
        </fieldset>}>
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-(--ink-2)">
          <span className="inline-flex items-center gap-1.5" style={core.safetyAcknowledged ? undefined : { color: "var(--proto)" }}><Icon name={core.safetyAcknowledged ? "shield" : "alert"} size={14} />{core.safetyAcknowledged ? "Safety acknowledged" : "Safety acknowledgment required"}</span>
          {state.record.cleared && <><span aria-hidden="true">·</span><span>Cleared for presentation</span></>}
        </p>
        {mediaAction.downloading ? <LoadingState className="mt-4" label={mediaAction.message} /> : mediaAction.message && <p className="mt-4 text-[14px] text-(--ink-2)" role={mediaAction.failed ? "alert" : "status"}>{mediaAction.message}</p>}
        {error && <div role="alert" className="my-4"><p className="mb-3">{error}</p><button className={button} disabled={busy} onClick={reload}><Icon name="arrowRight" />Reopen</button></div>}
        {missing && status === 125060003 && <p role="status" className="mt-3 flex items-start gap-1.5 text-[13px]" style={{ color: "var(--proto)" }}><Icon name="alert" size={14} className="mt-0.5 shrink-0" />Complete the summary, what it does, business value, capability, contributor effort, redacted context when needed, detail images and safety acknowledgment before submitting.</p>}
        {busy && <LoadingState className="mt-4" label="Updating submission..." />}
      </SubmissionStatusPanel>}
        {confirmation && <ConfirmDialog title={CONFIRMATIONS[confirmation].title} confirmLabel={CONFIRMATIONS[confirmation].label} onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); void transition(confirmation); }}>
          <p className="mb-3 font-semibold text-(--ink)">{core.name}</p>
          <p>{CONFIRMATIONS[confirmation].body}</p>
        </ConfirmDialog>}
      </>
    } />;
}
/** Technologies on this submission that no other published solution uses: new names a reviewer checks for duplicates. */
function NewTechnologies({ items }: { items: NewTechnology[] }) {
  if (!items.length) return null;
  return <section aria-label="New technologies" className="mt-4 rounded-xl border border-(--glass-edge) p-4 text-[14px]">
    <h3 className="font-semibold">New {items.length === 1 ? "technology" : "technologies"}</h3>
    <p className="mt-1 text-[13px] text-(--ink-2)">No other published solution uses {items.length === 1 ? "this" : "these"} yet. If one repeats an existing technology, request changes and name the existing one.</p>
    <ul className="mt-2 space-y-1.5">
      {items.map(item => <li key={item.name}><span className="font-semibold">{item.name}</span>{item.similar.length > 0
        ? <span style={{ color: "var(--proto)" }}> · similar to {item.similar.join(", ")}</span>
        : <span className="text-(--ink-2)"> · no similar technology found</span>}</li>)}
    </ul>
  </section>;
}
