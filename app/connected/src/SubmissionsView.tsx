import { useEffect, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";
import { LoadingState } from "../../src/components/LoadingState";
import { ConfirmDialog } from "../../src/components/ConfirmDialog";
import { MySubmissionsView, type SuggestionSummary } from "../../src/views/MySubmissionsView";
import { DetailView } from "../../src/views/DetailView";
import { ReviewPanel, ReviewQueue } from "../../src/components/ReviewQueue";
import { outlinedStatusButton, statusButton, subtleStatusButton, SubmissionStatusPanel } from "../../src/components/SubmissionStatusPanel";
import { submissionState } from "../../src/lib/submissionState";
import { reviewChecklist } from "../../src/lib/reviewChecklist";
import { newTechnologies, type NewTechnology } from "../../src/lib/technologyName";
import type { Solution } from "../../src/types";
import { navigate } from "../../src/lib/router";
import { readAll } from "./catalogue";
import { workflowApi, readRows, suggestionApi } from "./dataSource";
import { loadSuggestions, type Suggestion, type SuggestionList } from "./suggestions";
import { feedbackKeys, openFeedback, useFeedbackSeen } from "../../src/lib/feedbackSeen";
import { SuggestionsPanel } from "./SolutionSuggestions";
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
  "request-changes": { title: "Send back to the owner?", label: "Send back to owner", body: "This is not an edit. It leaves the library and CSMs lose access to it; the owner sees your comments as Changes requested and must resubmit it. To fix it yourself, cancel and use Edit solution." },
  retire: { title: "Retire from the library?", label: "Retire from library", body: "It is removed from the Solution Library for good: it disappears from search and browse and CSMs lose access to it. The record is kept, not deleted, and the owner sees your reason." },
} as const;
const UNPUBLISH = { title: "Unpublish to edit?", label: "Unpublish & edit", body: "It leaves the Solution Library and returns to Draft so you can edit it. It is published again once a librarian approves it." };

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
  // Suggestions exist only on published solutions: one read each, in parallel. A failed read just leaves that card out.
  const [suggestionRows, setSuggestionRows] = useState<Record<string, Suggestion[]>>();
  const published = review ? "" : (state?.entries ?? []).filter(entry => entry.solution.publicationStatus === "Published").map(entry => entry.solution.id).join(",");
  useEffect(() => {
    const api = suggestionApi;
    if (!published || !api) return;
    const controller = new AbortController();
    void Promise.all(published.split(",").map(async id => {
      try {
        const { suggestions: rows } = await loadSuggestions(api, id, controller.signal);
        return [[id, rows]] as [string, Suggestion[]][];
      } catch { return [] as [string, Suggestion[]][]; }
    })).then(lists => { if (!controller.signal.aborted) setSuggestionRows(Object.fromEntries(lists.flat())); });
    return () => controller.abort();
  }, [published]);
  // No published solutions: nothing to read, so the Suggestions tab is simply empty.
  const rows: Record<string, Suggestion[]> | undefined = published ? suggestionRows : {};
  const suggestions = rows && Object.fromEntries(Object.entries(rows).map(([id, list]): [string, SuggestionSummary] => [id, { count: list.length, authors: [...new Set(list.map(row => row.author))], ids: list.map(row => row.id) }]));
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
  if (!review) {
    // The Suggestions tab lists the cards with suggestions; each solution shows them inside. Review queue lives in the masthead.
    return <MySubmissionsView connected entries={state.entries} suggestions={suggestions} onOpen={open} onEdit={open} onDelete={remove}
      suggestionsTab={rows && { count: Object.values(rows).reduce((total, list) => total + list.length, 0) }}
      renderCard={(solution, index, manage) => <ConnectedSolutionCard solution={solution} index={index} present={false} owned manage={manage} onOpen={() => open(solution)} />}
      actions={<button type="button" title="Refresh submissions" aria-label="Refresh submissions" className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold hover:bg-(--glass-edge)" style={{ color: "var(--ink-2)" }} onClick={() => { setState(null); setSuggestionRows(undefined); setAttempt(current => current + 1); }}><Icon name="refresh" size={15} />Refresh</button>} />;
  }
  return <ReviewQueue entries={state.entries} connected />;
}

export function SubmissionView({ id, review, technologyUse }: { id: string; review: boolean; technologyUse?: ReadonlyMap<string, string[]> }) {
  const [state, setState] = useState<SubmissionDetail | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [technologyLabels, setTechnologyLabels] = useState<string[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [namesLoaded, setNamesLoaded] = useState(false);
  const [capabilityOwners, setCapabilityOwners] = useState<Record<string, string | null>>();
  const [error, setError] = useState("");
  const [comments, setComments] = useState("");
  const [cleared, setCleared] = useState(false);
  const [confirmation, setConfirmation] = useState<keyof typeof CONFIRMATIONS | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const mediaAction = useMediaAction(setPreview, { solutionId: id, mode: "submission" });
  // Suggestions colleagues sent on this solution, listed below its details. The server returns them only to the owner,
  // contributors and the PRISMA Librarian; anyone else, or a failed read, gets no panel.
  const [suggestionList, setSuggestionList] = useState<SuggestionList | null>(null);
  useEffect(() => {
    const api = suggestionApi;
    if (!api) return;
    const controller = new AbortController();
    // A failed read counts as none, so opening the solution still marks its feedback as read.
    void loadSuggestions(api, id, controller.signal).then(list => { if (!controller.signal.aborted) setSuggestionList(list); })
      .catch(() => { if (!controller.signal.aborted) setSuggestionList({ canRead: false, suggestions: [] }); });
    return () => controller.abort();
  }, [id, attempt]);
  // New feedback stays flagged until the owner confirms reading it here (or from My submissions).
  useFeedbackSeen();
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
    // Capability owners (`nx_capabilityowner`, a consultant lookup) in their own read: a failure only hides the row.
    void readAll(readRows, "capabilities", { select: ["nx_capabilityid", "_nx_capabilityowner_value"], filter: "statecode eq 0" }, controller.signal).then(rows => {
      if (controller.signal.aborted) return;
      setCapabilityOwners(Object.fromEntries(rows.flatMap(row => {
        const values = row as Record<string, unknown>;
        return typeof values.nx_capabilityid === "string" ? [[values.nx_capabilityid, typeof values._nx_capabilityowner_value === "string" ? values._nx_capabilityowner_value : null]] : [];
      })));
    }).catch(() => undefined);
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
  const missing = !core || !core.summary.trim() || !core.whatItDoes.trim() || !core.businessValue.trim() || !core.capabilityId || !core.safetyAcknowledged || (!!core.clientContext.trim() && !core.clientContextRedacted.trim()) || !state?.graph.graph.contributors.length || core.complexityValue == null || !state.media.some(item => item.kind === "image" && item.complete) || state.media.some(item => !item.complete);
  if (!state || !core || !namesLoaded || state.record.areaIds.some(area => !["ai", "data", "ibo"].includes(names[area]))) return <section className={shell}><button className={button} onClick={() => navigate(review ? "/review" : "/my-submissions")}><Icon name="chevronLeft" />{review ? "Review queue" : "My submissions"}</button>{error || namesLoaded ? <div role="alert" className="my-6"><p className="mb-3">{error || "Specialization unavailable. Check your reference-data access."}</p><button className={button} onClick={reload}><Icon name="arrowRight" />Reopen</button></div> : <LoadingState variant="page" label="Loading submission..." />}</section>;
  if (preview) return <MediaPreview key={preview.id} item={preview} solutionId={core.id} mode="submission" viewerTitle={core.name} onClose={() => setPreview(null)} />;
  const graph = state.graph.graph;
  const thumbnail = state.media.find(item => item.kind === "thumbnail" && item.complete);
  const solution: Solution = { ...submissionSolution(state.record, names), technologies: graph.technologyIds.map(id => names[id] ?? "Unavailable technology"), industries: graph.industryIds.map(id => names[id] ?? "Unavailable industry"), projects: graph.projectIds.map(id => ({ id, projectName: names[id] ?? `Untitled project (${id.slice(0, 8)})` })), assets: state.media.filter(item => item.kind === "attachment" && item.complete).map(mediaAsset) };
  const effort = { contributors: graph.contributors.map(person => ({ name: names[person.personId] ?? "Unavailable consultant", email: emails[person.personId], level: levels[person.personId] })) };
  // Shown when there is something to read, or on a published record (where "no suggestions yet" is meaningful).
  // Open feedback items (librarian comment, suggestions), each confirmed on its own; the heading shows a bubble while any is open.
  const openItems = review ? [] : openFeedback(feedbackKeys(solution, suggestionList?.suggestions.map(item => item.id) ?? []));
  const newFeedback = openItems.length > 0;
  // Same withdraw action either way; a published record is described as being unpublished.
  const confirmCopy = confirmation && (confirmation === "withdraw" && status === 125060000 ? UNPUBLISH : CONFIRMATIONS[confirmation]);
  const suggestionsPanel = suggestionList?.canRead && (suggestionList.suggestions.length > 0 || status === 125060000) ? <SuggestionsPanel list={suggestionList} /> : undefined;
  return <DetailView solution={solution} present={false} connected effort={effort} panels={suggestionsPanel} backLabel={review ? "Review queue" : "My submissions"} onBack={() => navigate(review ? "/review" : "/my-submissions")}
    poster={thumbnail && <div className="h-full overflow-hidden"><ProtectedImage item={thumbnail} className="h-full w-full object-cover" /></div>}
    imageCount={state.media.filter(item => item.kind === "image" && item.complete).length} gallery={<PublishedGallery media={state.media} />} onAssetOpen={asset => void mediaAction.open(state.media.find(item => item.id === asset.id))} reviewActions={
      <>{review ? <ReviewPanel status={PUBLICATIONS[state.record.publication]} owner={state.record.owner} client={core.clientContext} context={core.clientContextRedacted} feedback={state.record.comments}
        solution={solution} capabilityOwner={capabilityOwnerName(capabilityOwners, core.capabilityId, names)} checks={reviewChecklist({
          summary: !!core.summary.trim(), story: !!core.whatItDoes.trim() && !!core.businessValue.trim(), capability: !!core.capabilityId,
          contributors: graph.contributors.length > 0, effort: core.complexityValue != null,
          images: state.media.filter(item => item.kind === "image" && item.complete).length, uploadsComplete: state.media.every(item => item.complete),
          safety: core.safetyAcknowledged, anonymized: !core.clientContext.trim() || !!core.clientContextRedacted.trim(),
        })}
        comments={comments} onComments={setComments} cleared={cleared} onCleared={setCleared} busy={busy} locked={uncertain || !state.librarian} canApprove={!missing} notice={mediaAction.message} noticeBusy={mediaAction.downloading}
        error={error && <><p className="mb-3">{error}</p><button className={button} disabled={busy} onClick={reload}><Icon name="arrowRight" />Reopen</button></>}
        onReturn={() => void transition("return")} onApprove={() => void transition("approve")}
        onEdit={state.librarian && state.librarianEdit !== false && (status === 125060000 || status === 125060002) && !uncertain ? () => navigate(`/review/${id}/edit`) : undefined}
        editBlocked={state.librarian && state.librarianEdit === false && (status === 125060000 || status === 125060002) ? "You submitted this solution, so you edit it as its owner: withdraw it from My submissions, then resubmit it." : undefined}
        edit={{ on: state.record.librarianEditedOn, by: state.record.librarianEditedBy, pending: state.record.librarianEditPending === true }}
        onConfirmEdit={state.librarian && status === 125060000 && !uncertain ? () => void transition("confirm-edit") : undefined}
        onRequestChanges={state.librarian && status === 125060000 && !uncertain ? () => setConfirmation("request-changes") : undefined}
        onRetire={state.librarian && status === 125060000 && !uncertain ? () => setConfirmation("retire") : undefined}>
        {technologyUse && <NewTechnologies items={newTechnologies(solution.technologies, new Set([...technologyUse].filter(([, ids]) => ids.some(other => other !== id.toLowerCase())).map(([name]) => name)), technologyLabels)} />}
      </ReviewPanel> : <SubmissionStatusPanel state={submissionState(solution)} feedback={state.record.comments || undefined} edited={state.record.librarianEditedOn}
        badge={newFeedback && <span className="new-feedback">{openItems.length === 1 ? "New feedback" : `${openItems.length} new feedback`}</span>} actions={<fieldset disabled={busy || uncertain} className="flex min-w-0 flex-wrap items-center gap-2.5">
          {status === 125060003 ? <><button type="button" className={outlinedStatusButton} onClick={() => navigate(`/submit?draft=${id}`)}><Icon name="edit" size={16} />Edit draft</button>
            <button type="button" className={statusButton} style={{ background: "var(--accent)", color: "var(--on-accent)" }} disabled={missing} onClick={() => void transition("submit")}><Icon name="check" size={16} />Submit for review</button></>
          : <button type="button" className={subtleStatusButton} onClick={() => setConfirmation("withdraw")}><Icon name="edit" size={15} />{status === 125060000 ? "Unpublish & edit" : "Withdraw & edit"}</button>}
        </fieldset>}>

        {/* Workflow validations are not status: only a missing safety acknowledgment, which blocks submitting, is shown. */}
        {!core.safetyAcknowledged && <p className="mt-3 flex items-center gap-1.5 text-[13px]" style={{ color: "var(--proto)" }}><Icon name="alert" size={14} />Safety acknowledgment required</p>}
        {mediaAction.downloading ? <LoadingState className="mt-4" label={mediaAction.message} /> : mediaAction.message && <p className="mt-4 text-[14px] text-(--ink-2)" role={mediaAction.failed ? "alert" : "status"}>{mediaAction.message}</p>}
        {error && <div role="alert" className="my-4"><p className="mb-3">{error}</p><button className={button} disabled={busy} onClick={reload}><Icon name="arrowRight" />Reopen</button></div>}
        {missing && status === 125060003 && <p role="status" className="mt-3 flex items-start gap-1.5 text-[13px]" style={{ color: "var(--proto)" }}><Icon name="alert" size={14} className="mt-0.5 shrink-0" />Complete the summary, what it does, business value, capability, contributors, complexity, redacted context when needed, detail images and safety acknowledgment before submitting.</p>}
        {busy && <LoadingState className="mt-4" label="Updating submission..." />}
      </SubmissionStatusPanel>}
        {confirmation && confirmCopy && <ConfirmDialog title={confirmCopy.title} confirmLabel={confirmCopy.label} onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); void transition(confirmation); }}>
          <p className="mb-3 font-semibold text-(--ink)">{core.name}</p>
          <p>{confirmCopy.body}</p>
        </ConfirmDialog>}
      </>
    } />;
}
/**
 * The owner of the submission's capability, by name: `null` when the capability names none, `undefined` (row hidden)
 * while unknown — the owners did not load, there is no capability, or the owner is not an active consultant.
 */
function capabilityOwnerName(owners: Record<string, string | null> | undefined, capabilityId: string | undefined, names: Record<string, string>): string | null | undefined {
  if (!owners || !capabilityId || !(capabilityId in owners)) return undefined;
  const owner = owners[capabilityId];
  return owner === null ? null : names[owner];
}

/** New technologies that resemble an existing one: likely duplicates. Nothing renders when there are none. */
function NewTechnologies({ items }: { items: NewTechnology[] }) {
  const suspects = items.filter(item => item.similar.length > 0);
  if (!suspects.length) return null;
  return <section aria-label="Possible duplicate technologies" className="mt-4 rounded-xl border p-4 text-[14px]" style={{ borderColor: "color-mix(in srgb, var(--proto) 40%, transparent)" }}>
    <h3 className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--proto)" }}><Icon name="alert" size={14} />Possible duplicate {suspects.length === 1 ? "technology" : "technologies"}</h3>
    <ul className="mt-2 space-y-1.5">
      {suspects.map(item => <li key={item.name}><span className="font-semibold">{item.name}</span><span className="text-(--ink-2)"> · looks like {item.similar.join(", ")}</span></li>)}
    </ul>
  </section>;
}
