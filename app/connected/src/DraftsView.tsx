import { useEffect, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";
import { ConfirmDialog } from "../../src/components/ConfirmDialog";
import { TagPicker } from "../../src/components/TagPicker";
import { SolutionCard } from "../../src/components/SolutionCard";
import { Field, StepShell, SubmissionSteps, SubmissionFooter, SubmissionSuccess, SubmissionSafety, IdentityFields, StoryFields, SubmissionReview, submissionInputClass as inputClass } from "../../src/components/SubmissionForm";
import type { Solution } from "../../src/types";
import { guardNavigation, navigate, replaceQuery } from "../../src/lib/router";
import { AREAS } from "../../src/data/catalogueMetadata";
import { DraftGraphEditor } from "./DraftGraphEditor";
import { DraftMediaEditor } from "./DraftMediaEditor";
import { draftApi, graphApi, mediaApi, readRows, workflowApi } from "./dataSource";
import { coreFields, EMPTY_DRAFT, loadDraftReferences, MATURITY_OPTIONS, type CoreDraft, type DraftReferences, type SavedDraft } from "./drafts";
import { contributorEffort, emptyGraph, graphPayload, initialContributor, isEmptyContributor, persistDraftGraph, loadGraphReferences, type GraphReferences, type DraftGraph } from "./draftGraph";
import { createTechnology, parseSubmission, type SubmissionDetail } from "./workflow";
import { hasCaptionChanges, saveMediaCaptions, type MediaItem } from "./media";
import { parseRecovery, recoveryKey, recoveryPayload } from "./draftRecovery";
import { ProtectedImage } from "./ProtectedImage";

type LoadState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; revision: number; detail?: SubmissionDetail; references: DraftReferences; graphReferences: GraphReferences };
const buttonClass = "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-(--glass-edge) px-4 py-2 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-50";

function areaName(name: string) {
  return name === "ai" || name === "data" || name === "ibo" ? AREAS[name].name : name;
}

export function DraftsView({ draftId, owner }: { draftId?: string; owner: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const createdId = useRef<string | undefined>(undefined);
  const revision = useRef(0);
  useEffect(() => {
    if (draftId && draftId === createdId.current) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => { controller.abort(); setState({ kind: "error" }); }, 20_000);
    void Promise.all([draftId ? workflowApi.read(draftId).then(parseSubmission) : undefined, loadDraftReferences(readRows, controller.signal), loadGraphReferences(readRows, controller.signal)])
      .then(([detail, references, graphReferences]) => {
        controller.signal.throwIfAborted();
        if (detail && (detail.record.core.id !== draftId || detail.record.publication !== 125060003)) throw new Error("Draft unavailable.");
        createdId.current = undefined;
        setState({ kind: "ready", revision: ++revision.current, detail, references, graphReferences });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ kind: "error" }); })
      .finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [attempt, draftId]);
  const retry = () => { createdId.current = undefined; setState({ kind: "loading" }); setAttempt(current => current + 1); };

  return <section className="mx-auto w-full max-w-[980px] px-4 pt-8 pb-24 sm:px-6">
    {state.kind === "loading" ? <p role="status">Loading submission...</p>
      : state.kind === "error" ? <div role="alert"><h1 className="text-[28px] font-semibold">Draft unavailable</h1><p className="my-4 text-(--ink-2)">Check your Dataverse access and connection. Only your Draft submissions can be edited.</p><button className={buttonClass} onClick={retry}><Icon name="arrowRight" />Retry</button></div>
      : <DraftEditor key={state.revision} owner={owner} initial={state.detail} references={state.references} graphReferences={state.graphReferences} onReload={retry} onCreated={id => { createdId.current = id; replaceQuery("/submit", { draft: id }); }} />}
  </section>;
}

function DraftEditor({ initial, references, graphReferences: initialGraphReferences, onReload, onCreated, owner }: { initial?: SubmissionDetail; references: DraftReferences; graphReferences: GraphReferences; onReload: () => void; onCreated: (id: string) => void; owner: string }) {
  const [graphReferences, setGraphReferences] = useState(initialGraphReferences);
  const [draft, setDraft] = useState<CoreDraft>(() => coreFields(initial?.record.core ?? { ...EMPTY_DRAFT, areaId: references.areas.find(option => option.name === "ai")?.id ?? "" }));
  const [saved, setSaved] = useState<SavedDraft | undefined>(initial?.record.core);
  const [graph, setGraph] = useState<DraftGraph>(() => initial?.graph.graph ?? initialContributor(initialGraphReferences, owner));
  const [baseline, setBaseline] = useState<DraftGraph>(() => initial?.graph.graph ?? emptyGraph());
  const [media, setMedia] = useState<MediaItem[]>(initial?.media ?? []);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const captionsDirty = hasCaptionChanges(media, captions);
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(initial?.record.core.safetyAcknowledged ?? false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmation, setConfirmation] = useState<"leave" | "reopen" | null>(null);
  const [hours, setHours] = useState<(number | null)[]>(initial?.graph.hours ?? []);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaPending, setMediaPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "uncertain">("idle");
  const saving = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const [recovery, setRecovery] = useState(() => {
    try { const text = sessionStorage.getItem(recoveryKey(owner, initial?.record.core.id)); return text ? parseRecovery(text, owner, initial?.record.core.id) : null; } catch { return null; }
  });
  const [recoveryError, setRecoveryError] = useState(false);
  const [pendingHash, setPendingHash] = useState<string | null>(null);
  const allowedNavigation = useRef(false);
  const recoverySuppressed = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(coreFields(saved ?? EMPTY_DRAFT)) || graphPayload(graph) !== graphPayload(baseline);
  const clearRecovery = () => { try { sessionStorage.removeItem(recoveryKey(owner, saved?.id)); sessionStorage.removeItem(recoveryKey(owner)); } catch { setRecoveryError(true); } };
  useEffect(() => {
    if (recovery || recoverySuppressed.current) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || recoverySuppressed.current) return;
      const key = recoveryKey(owner, saved?.id);
      if ((dirty || status === "saving" || status === "uncertain") && !submitted) sessionStorage.setItem(key, recoveryPayload(owner, saved?.id, saved?.rowVersion, draft, graph, step, status === "saving" || status === "uncertain"));
      else sessionStorage.removeItem(key);
    }).catch(() => { if (active) setRecoveryError(true); });
    return () => { active = false; };
  }, [owner, saved, draft, graph, step, dirty, recovery, status, submitted]);
  useEffect(() => {
    return guardNavigation(next => {
      if (allowedNavigation.current) { allowedNavigation.current = false; return true; }
      if (dirty || captionsDirty || mediaBusy || mediaPending || status === "saving" || status === "uncertain" || recovery) {
        setPendingHash(next);
        return false;
      }
      return true;
    });
  }, [dirty, captionsDirty, mediaBusy, mediaPending, status, recovery]);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!dirty && !captionsDirty && status !== "saving" && !mediaBusy && !mediaPending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, captionsDirty, status, mediaBusy, mediaPending]);
  const change = <Field extends keyof CoreDraft>(field: Field, value: CoreDraft[Field]) => {
    setDraft(current => ({ ...current, safetyAcknowledged: field === "safetyAcknowledged" ? current.safetyAcknowledged : false, [field]: value }));
    if (status === "saved") setStatus("idle");
  };
  const changeGraph = (next: DraftGraph) => { setGraph(next); change("safetyAcknowledged", false); };
  const addTechnology = async (name: string) => {
    const controller = lifetime.current;
    if (!controller || !saved || saving.current || status === "uncertain" || mediaBusy) throw new Error("Draft unavailable.");
    saving.current = true;
    setStatus("saving");
    const operation = new AbortController();
    const abort = () => operation.abort();
    controller.signal.addEventListener("abort", abort, { once: true });
    const timeout = window.setTimeout(() => { operation.abort(); if (!controller.signal.aborted) setStatus("uncertain"); }, 60_000);
    try {
      const next = await persistDraftGraph(draftApi, graphApi, draft, saved, graph, baseline, operation.signal, (core, confirmed) => { setSaved(core); setBaseline(confirmed); });
      const created = await createTechnology(workflowApi, next.core, name, operation.signal);
      const core = { ...next.core, rowVersion: created.rowVersion, safetyAcknowledged: false };
      setSaved(core);
      setDraft(coreFields(core));
      setBaseline(next.graph);
      setGraph({ ...next.graph, technologyIds: [...new Set([...next.graph.technologyIds, created.option.id])] });
      setGraphReferences(current => ({ ...current, technologies: [...(current.technologies ?? []).filter(option => option.id !== created.option.id), created.option].sort((left, right) => left.name.localeCompare(right.name)) }));
      setStatus("idle");
    } catch (error) { if (!controller.signal.aborted) setStatus("uncertain"); throw error; }
    finally { clearTimeout(timeout); controller.signal.removeEventListener("abort", abort); saving.current = false; }
  };
  const persist = async (action: "continue" | "close" | "submit") => {
    const controller = lifetime.current;
    if (!controller || saving.current || status === "uncertain" || mediaBusy || mediaPending) return;
    if (step === 0 && action === "continue") { setStep(1); return; }
    saving.current = true;
    setStatus("saving");
    const operation = new AbortController();
    const abort = () => operation.abort();
    controller.signal.addEventListener("abort", abort, { once: true });
    const timeout = window.setTimeout(() => {
      operation.abort();
      if (!controller.signal.aborted) setStatus("uncertain");
    }, 60_000);
    try {
      let checkpoint = saved;
      let fields = draft;
      if (captionsDirty) {
        if (!checkpoint) throw new Error("Save the draft before editing captions.");
        const confirmed = await saveMediaCaptions(mediaApi, checkpoint, media, captions, operation.signal);
        if (confirmed) {
          checkpoint = { ...checkpoint, rowVersion: confirmed.rowVersion, safetyAcknowledged: false };
          fields = { ...draft, safetyAcknowledged: false };
          setSaved(checkpoint);
          setDraft(fields);
          setMedia(confirmed.media);
          setCaptions({});
        }
      }
      const next = await persistDraftGraph(draftApi, graphApi, fields, checkpoint, graph, baseline, operation.signal, (core, confirmedGraph) => {
        setSaved(core);
        setBaseline(confirmedGraph);
        if (!saved) { allowedNavigation.current = true; onCreated(core.id); }
      });
      controller.signal.throwIfAborted();
      operation.signal.throwIfAborted();
      setSaved(next.core);
      setDraft(coreFields(next.core));
      setGraph(next.graph);
      setBaseline(next.graph);
      setCaptions({});
      clearRecovery();
      if (action === "continue" && step === 4) {
        const detail = parseSubmission(await workflowApi.read(next.core.id));
        operation.signal.throwIfAborted();
        if (detail.record.core.id !== next.core.id || detail.record.core.rowVersion !== next.core.rowVersion) throw new Error("Draft changed before review.");
        setHours(detail.graph.hours);
        setMedia(detail.media);
      }
      if (action === "submit") {
        const result = parseSubmission(await workflowApi.transition(next.core.id, next.core.rowVersion, "submit", "", false));
        operation.signal.throwIfAborted();
        if (result.record.core.id !== next.core.id || result.record.publication !== 125060002 || result.record.core.rowVersion === next.core.rowVersion) throw new Error("Unconfirmed submission.");
        setSaved(result.record.core);
        setSubmitted(true);
      } else if (action === "close") { recoverySuppressed.current = true; allowedNavigation.current = true; navigate("/my-submissions"); }
      else { setStep(current => Math.min(current + 1, 5)); window.scrollTo({ top: 0, behavior: "instant" }); }
      setStatus("saved");
    } catch {
      if (!controller.signal.aborted) setStatus("uncertain");
    } finally {
      window.clearTimeout(timeout);
      controller.signal.removeEventListener("abort", abort);
      saving.current = false;
    }
  };
  const reopen = () => {
    recoverySuppressed.current = true;
    clearRecovery();
    allowedNavigation.current = true;
    setConfirmation(null);
    if (saved) onReload();
    else navigate("/my-submissions");
  };
  const hints = {
    name: "Give the solution a short, recognizable product name.",
    summary: `Describe who it helps and what it achieves in one sentence. ${draft.summary.length}/200 characters.`,
    whatItDoes: "Describe the main actions a user takes and the results they see.",
    businessValue: "Explain the business problem and the benefit of solving it; include measured results only when known.",
    useCase: "Describe the scenario where this solution is useful.",
    clientContext: "Optional. Client and engagement name for internal discovery only; never included in present mode.",
    clientContextRedacted: "Client-visible context without names or identifying details. Leave empty if this work has no client.",
  };
  const field = (key: "name" | "summary" | "whatItDoes" | "businessValue" | "useCase" | "clientContext" | "clientContextRedacted", label: string, multiline = false) => <Field label={label} hint={hints[key]} required={key === "name" || key === "summary" || (key === "clientContextRedacted" && !!draft.clientContext.trim())}>{multiline
    ? <textarea className={inputClass} rows={4} maxLength={key === "whatItDoes" || key === "businessValue" ? 4000 : 200} value={draft[key]} onChange={event => change(key, event.target.value)} />
    : <input className={inputClass} required={key === "name"} maxLength={key === "name" ? 100 : 200} value={draft[key]} onChange={event => change(key, event.target.value)} />}</Field>;
  const area = references.areas.find(option => option.id === draft.areaId)?.name;
  const preview: Solution = {
    id: saved?.id ?? "preview", name: draft.name, summary: draft.summary, whatItDoes: draft.whatItDoes, businessValue: draft.businessValue,
    specializationArea: area === "data" || area === "ibo" ? area : "ai", status: MATURITY_OPTIONS.find(option => option.value === draft.maturity)?.label as Solution["status"],
    publicationStatus: "Draft", safetyAcknowledged: draft.safetyAcknowledged, clientSafeReviewed: false, clientContext: draft.clientContext, clientContextRedacted: draft.clientContextRedacted,
    contributors: graph.contributors.map((person, index) => ({ id: person.id ?? String(index), builtBy: { id: person.personId, name: graphReferences.people?.find(option => option.id === person.personId)?.name ?? "Unavailable consultant", email: "" }, directHours: person.directHours ?? undefined, startDate: person.startDate ?? "", endDate: person.endDate ?? "", allocation: person.allocation ?? 0, calendarId: "" })),
    dateAdded: "", searchKeywords: "", assets: [], capabilities: references.capabilities.filter(option => option.id === draft.capabilityId).map(option => option.name),
    technologies: (graphReferences.technologies ?? []).filter(option => graph.technologyIds.includes(option.id)).map(option => option.name), industries: (graphReferences.industries ?? []).filter(option => graph.industryIds.includes(option.id)).map(option => option.name),
  };
  const busy = status === "saving" || mediaBusy;
  const locked = busy || mediaPending || status === "uncertain" || !!recovery;
  const thumbnail = media.find(item => item.kind === "thumbnail" && item.complete);
  const canSave = !!draft.name.trim() && draft.name.trim().toLowerCase() !== "untitled solution" && !!draft.areaId && !graph.contributors.some(person => !person.personId && !isEmptyContributor(person));
  const effortComplete = graph.contributors.length > 0 && graph.contributors.every(person => !contributorEffort(person, draft.maturity).error);
  const complete = canSave && !!draft.summary.trim() && !!draft.capabilityId && effortComplete && (!draft.clientContext.trim() || !!draft.clientContextRedacted.trim()) && media.some(item => item.kind === "image" && item.complete) && !media.some(item => !item.complete);
  const canContinue = step === 0 ? accepted : step === 1 ? canSave && !!draft.summary.trim() && effortComplete && (!draft.clientContext.trim() || !!draft.clientContextRedacted.trim()) : step === 3 ? canSave && !!draft.capabilityId : step === 4 ? complete : canSave;
  const goBack = (next: number) => { if (!locked) { setStep(next); window.scrollTo({ top: 0, behavior: "instant" }); } };

  if (submitted) return <SubmissionSuccess name={draft.name} onSubmissions={() => navigate("/my-submissions")} onAnother={() => navigate("/submit")}>is pending librarian review. Your submission and media are saved in Dataverse. Nothing has been published.</SubmissionSuccess>;

  return <>
    <button type="button" disabled={busy} className="inline-flex cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold text-(--ink-2)" onClick={() => { if (dirty) setConfirmation("leave"); else navigate("/"); }}><Icon name="chevronLeft" size={15} />Back to the library</button>
    <div className="animate-rise mt-4"><p className="eyebrow">Contributor · guided submission</p><h1 className="mt-2 text-[28px] font-bold">{initial ? "Edit submission" : "Put your work on the shelf"}</h1><p role="status" className="mt-2 text-[14px] text-(--ink-2)">{busy ? "Saving..." : dirty || captionsDirty ? "Unsaved changes" : saved ? "Saved to Dataverse" : "Draft"}</p></div>
    {initial?.record.comments && <section aria-label="Librarian feedback" className="mt-5 border-l-2 border-(--proto) pl-4"><h2 className="text-[15px] font-semibold">Librarian feedback</h2><p className="mt-1 whitespace-pre-wrap break-words text-[14px]">{initial.record.comments}</p></section>}
    {status === "uncertain" && <div role="alert" className="mt-5 border-l-2 border-(--accent) pl-4"><p className="mb-3 text-[14px]">Save was not confirmed. Your edits remain here. Reopen from Dataverse before saving again.</p><button type="button" className={buttonClass} onClick={() => setConfirmation("reopen")}><Icon name="file" />{saved ? "Reopen saved draft" : "Check my submissions"}</button></div>}
    {recoveryError && <p role="alert" className="mt-4 text-[14px]">Tab recovery is unavailable. Save to Dataverse before leaving.</p>}
    {recovery && <ConfirmDialog title={recovery.rowVersion === (saved?.rowVersion ?? "") ? "Restore unsaved draft?" : "Saved draft has changed"} cancelLabel="Discard retained edits" confirmLabel={recovery.rowVersion === (saved?.rowVersion ?? "") ? "Restore edits" : "Use saved version"} onCancel={() => { clearRecovery(); setRecovery(null); }} onConfirm={() => {
      if (recovery.rowVersion === (saved?.rowVersion ?? "")) { setDraft(recovery.draft); setGraph(recovery.graph); setStep(recovery.step); setAccepted(false); if (recovery.uncertain) setStatus("uncertain"); }
      else clearRecovery();
      setRecovery(null);
    }}><p>{recovery.rowVersion === (saved?.rowVersion ?? "") ? "Unsaved text and selections are available from this tab. Media remains in Dataverse. Safety confirmation must be renewed." : "Dataverse has a newer version. These retained edits will not be applied over it. Review or copy them before discarding."}</p>{recovery.rowVersion !== (saved?.rowVersion ?? "") && <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[12px]">{JSON.stringify({ draft: recovery.draft, graph: recovery.graph }, null, 2)}</pre>}</ConfirmDialog>}
    {pendingHash && !recovery && <ConfirmDialog title={busy ? "Save in progress" : "Leave unsaved draft?"} confirmLabel={busy ? "Stay here" : "Discard & leave"} onCancel={() => setPendingHash(null)} onConfirm={() => {
      if (busy) { setPendingHash(null); return; }
      recoverySuppressed.current = true; clearRecovery(); allowedNavigation.current = true; window.location.hash = pendingHash; setPendingHash(null);
    }}><p>{busy ? "Wait for the current save or media operation to finish before leaving." : "Unsaved edits and their tab recovery copy will be discarded. Changes already saved to Dataverse will remain."}</p></ConfirmDialog>}
    {confirmation && <ConfirmDialog title={confirmation === "leave" ? "Discard unsaved changes?" : "Reopen saved draft?"} confirmLabel={confirmation === "leave" ? "Discard & leave" : "Discard & reopen"} onCancel={() => setConfirmation(null)} onConfirm={() => { if (confirmation === "reopen") reopen(); else { recoverySuppressed.current = true; clearRecovery(); allowedNavigation.current = true; setConfirmation(null); navigate("/"); } }}><p>{confirmation === "leave" ? "Your unsaved edits will be discarded. Changes already saved to Dataverse will remain." : "The edits shown here will be discarded. The latest saved version in Dataverse will be used instead."}</p></ConfirmDialog>}
    <SubmissionSteps step={step} disabled={locked} onStep={goBack} />
    <div className="glass glass-lite glass-sheen animate-rise mt-5 rounded-[24px] p-6 sm:p-8">
      <fieldset disabled={locked} className="min-w-0">
        {step === 0 && <SubmissionSafety accepted={accepted} onChange={setAccepted} />}
        {step === 1 && <StepShell title="What is it?">
          <IdentityFields value={{ ...draft, redacted: draft.clientContextRedacted }} onText={(key, value) => change(key === "redacted" ? "clientContextRedacted" : key, value)}
            area={draft.areaId} areas={[...references.areas].sort((left, right) => ["ai", "data", "ibo"].indexOf(left.name) - ["ai", "data", "ibo"].indexOf(right.name)).map(option => ({ value: option.id, label: areaName(option.name) }))} onArea={value => change("areaId", value)}
            status={String(draft.maturity)} statuses={MATURITY_OPTIONS.map(option => ({ value: String(option.value), label: option.label }))} onStatus={value => change("maturity", Number(value) as CoreDraft["maturity"])} />
          <DraftGraphEditor graph={graph} references={graphReferences} maturity={draft.maturity} section="contributors" onChange={changeGraph} />
        </StepShell>}
        {step === 2 && <StoryFields whatItDoes={draft.whatItDoes} businessValue={draft.businessValue} onChange={change}>{field("useCase", "Use case", true)}</StoryFields>}
        {step === 3 && <StepShell title="Tag it"><TagPicker label="Capability (required, choose one)" governed options={references.capabilities.map(option => option.id)} selected={draft.capabilityId ? [draft.capabilityId] : []} getLabel={id => references.capabilities.find(option => option.id === id)?.name ?? "Unavailable capability"} onChange={selected => change("capabilityId", selected.at(-1) ?? "")} /><DraftGraphEditor graph={graph} references={graphReferences} maturity={draft.maturity} section="tags" onChange={changeGraph} onCreateTechnology={addTechnology} /></StepShell>}
      </fieldset>
      {step === 4 && saved && <DraftMediaEditor saved={saved} captions={captions} onCaptions={setCaptions} embedded capabilities={preview.capabilities} blocked={dirty || status === "saving" || status === "uncertain"} onMedia={setMedia} onVersion={rowVersion => { setSaved(current => current ? { ...current, rowVersion, safetyAcknowledged: false } : current); setDraft(current => ({ ...current, safetyAcknowledged: false })); }} onBusy={setMediaBusy} onPending={setMediaPending} />}
      {step === 5 && <SubmissionReview card={<SolutionCard solution={preview} present index={0} poster={thumbnail && <div className="h-36 overflow-hidden"><ProtectedImage item={thumbnail} className="h-full w-full object-cover" /></div>} />} attachments={media.filter(item => item.kind === "attachment" && item.complete).length}
        contributors={preview.contributors.map(person => person.builtBy.name).join(", ")} hours={!hours.length || hours.some(value => value === null) ? null : Math.round(hours.reduce<number>((total, value) => total + (value ?? 0), 0) * 100) / 100}
        images={`${thumbnail ? "Thumbnail" : "Generated poster"} · ${media.filter(item => item.kind === "image" && item.complete).length} screenshots`} safety={draft.safetyAcknowledged ? "Acknowledged; review required" : "Not acknowledged"} client={draft.clientContext} context={draft.clientContextRedacted} nextState="Pending review">
        <label className="flex items-start gap-3 text-[15px]"><input disabled={locked} type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.safetyAcknowledged} onChange={event => change("safetyAcknowledged", event.target.checked)} /><span>I confirm this content and all media are authorized and safe for client presentation.</span></label>{!complete && <p role="alert">Complete identity, contributor effort, capability and at least one detail image before submitting.</p>}
      </SubmissionReview>}
      <SubmissionFooter step={step} busy={busy} locked={locked} canSave={canSave} canContinue={canContinue} canSubmit={complete && !captionsDirty && draft.safetyAcknowledged && !!hours.length && hours.every(value => value !== null)}
        onBack={() => goBack(step - 1)} onSave={() => void persist("close")} onContinue={() => void persist("continue")} onSubmit={() => void persist("submit")} />
    </div>
  </>;
}