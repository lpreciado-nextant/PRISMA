import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/600.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import { Icon } from "../src/components/Icon";
import { Player } from "./Player";
import { AttachmentPreview } from "./AttachmentPreview";
import { attachmentType } from "../src/lib/mediaContract";
import { command, uploadAttachment, type Actor, type Mode, type Snapshot } from "./client";
import "./style.css";

const sizes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
const message = (error: unknown) => error instanceof Error ? error.message : "Local operation failed.";

export function Workbench() {
  const [actor, setActor] = useState<Actor>("builder");
  const [mode, setMode] = useState<Mode>("submission");
  const [drafts, setDrafts] = useState<Snapshot[]>([]);
  const [draft, setDraft] = useState<Snapshot | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [safe, setSafe] = useState(false);
  const [scanOutcome, setScanOutcome] = useState("");
  const operation = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectedId = draft?.id;
  const hasScanJob = !!draft?.upload?.scan?.job;
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    void command<Snapshot[]>(actor, "list", {}, controller.signal).then(setDrafts).catch(reason => { if (!controller.signal.aborted) setError(message(reason)); });
    return () => controller.abort();
  }, [actor]);
  useEffect(() => {
    if (!selectedId || !hasScanJob || busy || locked) return;
    const controller = new AbortController();
    let refreshing = false;
    const timer = setInterval(() => {
      if (refreshing) return;
      refreshing = true;
      void command<Snapshot>(actor, "read", { id: selectedId, mode }, controller.signal).then(next => {
        if (controller.signal.aborted) return;
        setDraft(current => current?.id === selectedId && Number(next.version) > Number(current.version) ? next : current);
        setDrafts(current => current.map(item => item.id === selectedId && Number(next.version) > Number(item.version) ? next : item));
      }).catch(reason => {
        if (!controller.signal.aborted) { setError(`${message(reason)} Status refresh stopped. Reopen before continuing.`); setLocked(true); }
      }).finally(() => { refreshing = false; });
    }, 1000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [actor, mode, selectedId, hasScanJob, busy, locked]);
  const refreshList = async () => setDrafts(await command<Snapshot[]>(actor, "list"));
  const reopen = async (id = draft?.id) => {
    setBusy("Reopening"); setError("");
    try {
      await refreshList();
      if (id) { setDraft(await command(actor, "read", { id, mode })); window.location.hash = `/draft/${id}`; }
      setLocked(false); setSafe(false); setScanOutcome("");
    } catch (reason) { setError(message(reason)); setDraft(null); }
    finally { setBusy(""); }
  };
  const mutate = async (action: string) => {
    setBusy(action === "create" ? "Creating draft" : "Saving"); setError("");
    try {
      const next = await command(actor, action, draft && action !== "create" ? { id: draft.id, version: draft.version, session: draft.upload?.id, safe, ...(action === "scan" ? { outcome: scanOutcome } : {}) } : {});
      setDraft(next); setSafe(false); setScanOutcome(""); window.location.hash = `/draft/${next.id}`;
      await refreshList();
    } catch (reason) { setError(message(reason)); setLocked(true); }
    finally { setBusy(""); }
  };
  const upload = async () => {
    if (!draft || !file) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy("Hashing"); setUploading(true); setError("");
    try {
      await uploadAttachment(actor, draft, file, controller.signal, setDraft, setBusy);
      setFile(null); if (fileInput.current) fileInput.current.value = "";
      await refreshList();
    } catch (reason) {
      setLocked(true);
      setError(controller.signal.aborted ? "Paused. Reopen to confirm the server checkpoint." : `${message(reason)} Reopen before another write.`);
    } finally { operation.current = null; setUploading(false); setBusy(""); }
  };
  const switchActor = (next: Actor) => {
    setActor(next); setMode(next === "reader" ? "present" : "submission");
    setDraft(null); setDrafts([]); setError(""); setLocked(false); setFile(null); setSafe(false); setScanOutcome(""); window.location.hash = "/";
  };
  const ownDraft = draft?.owner === actor && draft?.status === "draft";
  const uploadState = draft?.upload;
  const writesDisabled = !!busy || locked;
  const scanStatus = uploadState?.scan?.status ?? "pending";
  const scanJob = uploadState?.scan?.job;
  const scanLabels = { pending: "Quarantined / awaiting simulated scan", passed: "Simulated pass / not malware-scanned", rejected: "Quarantined / simulated rejection", error: "Quarantined / scan attempt failed" };
  return <>
    <header className="masthead"><div><span className="eyebrow">NEXTANT / DEVELOPMENT</span><h1>PRISMA <span>Media lab</span></h1></div><span className="environment"><Icon name="shield" />LOCAL ONLY</span></header>
    <main>
      <div className="toolbar">
        <label>Simulated identity<select value={actor} disabled={!!busy} onChange={event => switchActor(event.target.value as Actor)}>
          <option value="builder">Builder</option><option value="other-builder">Other builder</option><option value="reader">CSM reader</option><option value="librarian">Librarian</option>
        </select></label>
        <label>Read mode<select value={mode} disabled={!!busy} onChange={event => setMode(event.target.value as Mode)}>
          <option value="submission">Submission</option><option value="published">Published</option><option value="present">Present</option>
        </select></label>
        <div className="toolbar-actions"><button onClick={() => void reopen()} disabled={!!busy} title="Reopen confirmed server state"><Icon name="refresh" />Reopen</button>
          <button className="primary" disabled={writesDisabled || (actor !== "builder" && actor !== "other-builder")} onClick={() => void mutate("create")}><Icon name="plus" />New draft</button></div>
      </div>
      <div className="workspace">
        <aside aria-label="Local drafts"><div className="section-heading"><h2>Local catalogue</h2><span className="mono">{drafts.length}</span></div>
          {drafts.length === 0 && <p className="empty">No visible drafts</p>}
          <ul>{drafts.map(item => <li key={item.id}><button disabled={!!busy} aria-current={draft?.id === item.id ? "true" : undefined} onClick={() => { setFile(null); void reopen(item.id); }}>
            <Icon name="file" /><span><strong>{item.upload?.name ?? "Untitled attachment"}</strong><small>{item.status} / {item.owner}</small></span>
          </button></li>)}</ul>
        </aside>
        <div className="detail">
          {error && <p role="alert" className="error">{error}</p>}
          {locked && <p className="notice">Writes locked pending Reopen</p>}
          {!draft ? <div className="empty-workspace"><Icon name="file" size={40} /><h2>No draft selected</h2></div> : <>
            <div className="section-heading"><div><span className="eyebrow">{draft.owner} / VERSION {draft.version}</span><h2>{uploadState?.name ?? "New attachment draft"}</h2></div><span className={`status status-${draft.status}`}>{draft.status}</span></div>
            <section className="transfer" aria-label="Attachment upload">
              <label className="file-label">Attachment file<input key={`${draft.id}:${actor}`} ref={fileInput} type="file" accept=".mp4,.html,.htm,.pdf,.ppt,.pptx" disabled={!ownDraft || writesDisabled || uploadState?.complete} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
              <div className="transfer-actions"><button className="primary" disabled={!file || !ownDraft || writesDisabled || uploadState?.complete} onClick={() => void upload()}><Icon name="arrowRight" />{uploadState ? "Resume upload" : "Upload"}</button>
                {uploading && <button onClick={() => operation.current?.abort()}><Icon name="close" />Pause</button>}
                {uploadState && ownDraft && <button disabled={writesDisabled} onClick={() => { if (window.confirm("Remove this local upload and its stored bytes?")) void mutate("remove"); }} title="Remove local upload"><Icon name="trash" />Remove</button>}
              </div>
              <div className="progress-heading"><span role="status">{busy || (uploadState?.complete ? "Integrity verified / not malware-scanned" : uploadState ? "Upload incomplete" : "Awaiting attachment")}</span><span className="mono">{uploadState ? `${sizes(uploadState.received)} / ${sizes(uploadState.size)}` : "25 MiB documents / 500 MiB MP4"}</span></div>
              <progress max={uploadState?.size ?? 1} value={uploadState?.received ?? 0} aria-label="Confirmed uploaded bytes" />
              {uploadState && <dl className="metadata"><div><dt>Confirmed blocks</dt><dd>{uploadState.nextBlock}</dd></div><div><dt>Block size</dt><dd>4 MiB</dd></div><div><dt>SHA-256</dt><dd className="digest">{uploadState.sha256}</dd></div></dl>}
            </section>
            {uploadState?.complete && <section className="scanner" aria-label="Simulated scanner">
              <div className="section-heading"><h2>Simulated scanner</h2><span className="mono">{uploadState.scan?.attempts ?? 0} {uploadState.scan?.attempts === 1 ? "attempt" : "attempts"}</span></div>
              <p role="status" className={uploadState.released ? "scan-pass" : "notice"}>{scanJob
                ? scanJob.state === "running" ? "Quarantined / scanning" : uploadState.scan?.failure ? "Quarantined / retry scheduled" : "Quarantined / scan queued"
                : scanStatus === "error" && uploadState.scan?.failure ? "Quarantined / retry limit reached" : scanLabels[scanStatus]}</p>
              {scanJob && <p className="mono">Job attempts: {scanJob.attempts} / {scanJob.maxAttempts}</p>}
              {uploadState.scan?.failure && <p className="mono">Last failure: {uploadState.scan.failure}</p>}
              {ownDraft && !scanJob && ["pending", "error"].includes(scanStatus) && <div className="scan-actions">
                <label>Simulated outcome<select value={scanOutcome} disabled={writesDisabled} onChange={event => setScanOutcome(event.target.value)}>
                  <option value="" disabled>Choose outcome</option><option value="pass">Pass (simulated)</option><option value="reject">Reject (simulated)</option><option value="outage">Scanner unavailable (simulated)</option><option value="timeout">Scanner timeout (simulated)</option>
                </select></label>
                <button disabled={writesDisabled || !scanOutcome} onClick={() => void mutate("scan")}><Icon name="shield" />{scanStatus === "error" ? "Retry simulated scan" : "Run simulated scan"}</button>
              </div>}
            </section>}
            <div className="lifecycle">
              {ownDraft && <button disabled={writesDisabled || !uploadState?.released} onClick={() => void mutate("submit")}><Icon name="arrowRight" />Submit for local review</button>}
              {actor === "librarian" && draft.status === "review" && <><label className="checkbox"><input type="checkbox" checked={safe} onChange={event => setSafe(event.target.checked)} disabled={writesDisabled} />Non-sensitive, client-safe fixture</label><button disabled={writesDisabled || !safe || !uploadState?.released} onClick={() => void mutate("publish")}><Icon name="check" />Publish locally</button></>}
              {draft.status !== "draft" && (actor === draft.owner || actor === "librarian") && <button disabled={writesDisabled} onClick={() => void mutate("withdraw")}><Icon name="eyeOff" />Withdraw locally</button>}
            </div>
            {uploadState?.released && (attachmentType(uploadState.name).mime === "video/mp4"
              ? <Player key={`${actor}:${mode}:${draft.id}:${draft.version}`} actor={actor} id={draft.id} upload={uploadState} mode={mode} />
              : <AttachmentPreview key={`${actor}:${mode}:${draft.id}:${draft.version}`} actor={actor} id={draft.id} upload={uploadState} mode={mode} />)}
          </>}
        </div>
      </div>
    </main>
    <footer><span>Azurite / local workspace</span><span>Simulated authorization / no Dataverse connection</span></footer>
  </>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Workbench /></StrictMode>);