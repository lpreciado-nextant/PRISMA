import { useEffect, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";
import { LoadingState } from "../../src/components/LoadingState";
import { ConfirmDialog } from "../../src/components/ConfirmDialog";
import { LocalVideoPreview, VideoPlayer, ViewerFrame } from "../../src/components/ViewerFrame";
import { ProtectedImage } from "./ProtectedImage";
import { ImageUploadZone, SubmissionMedia, UploadProgress } from "../../src/components/SubmissionForm";
import type { AssetType } from "../../src/types";
import { mediaApi, downloadMedia, workflowApi, transferApi } from "./dataSource";
import { transferVideo, type PlaybackMode } from "./mediaTransfer";
import { StreamingVideo } from "./StreamingVideo";
import { imageDataUrl, mediaRequest, saveMediaCaptions, saveMediaOrder, uploadMedia, type MediaItem, type MediaKind, type MediaState } from "./media";
import type { SavedDraft } from "./drafts";
import { mediaAsset, saveLinkedAsset } from "./workflow";
import type { LinkedAssetInput } from "../../src/lib/linkedAssets";

const button = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3 py-2 text-[14px] disabled:opacity-50";

export function DraftMediaEditor({ saved, blocked, captions, onCaptions, onVersion, onBusy, onPending, onReopen, embedded = false, onMedia, capabilities = [] }: { saved: SavedDraft; blocked: boolean; captions: Record<string, string>; onCaptions: (captions: Record<string, string>) => void; onVersion: (version: string) => void; onBusy: (busy: boolean) => void; onPending?: (pending: boolean) => void; onReopen?: () => void; embedded?: boolean; onMedia?: (media: MediaItem[]) => void; capabilities?: string[] }) {
  const [state, setState] = useState<MediaState | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [hashing, setHashing] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [linkedPending, setLinkedPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [localVideo, setLocalVideo] = useState<File | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MediaItem | null>(null);
  const [format, setFormat] = useState<AssetType>("Self-contained HTML file");
  const operation = useRef<AbortController | null>(null);
  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    void mediaRequest(mediaApi.read(saved.id), controller.signal).then(result => {
      if (result.id !== saved.id || result.rowVersion !== saved.rowVersion) throw new Error("Draft changed. Reopen it to load media.");
      setState(result);
    }).catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Media unavailable."); });
    return () => controller.abort();
  }, [saved.id, saved.rowVersion, attempt, busy]);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => { if (state) onMedia?.(state.media); }, [state, onMedia]);
  useEffect(() => {
    onBusy(busy || preparing);
    return () => onBusy(false);
  }, [busy, preparing, onBusy]);
  useEffect(() => {
    onPending?.(uncertain || linkedPending);
    return () => onPending?.(false);
  }, [uncertain, linkedPending, onPending]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  const mutate = async (files: File[], kind: MediaKind, remove?: MediaItem, resume?: MediaItem) => {
    if (operation.current || blocked || uncertain || !state || state.rowVersion !== saved.rowVersion) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError("");
    let started = false;
    try {
      if (!remove && !resume && (!files.length || files.length + state.media.filter(item => item.kind === kind).length > (kind === "thumbnail" ? 1 : 6))) throw new Error("Choose up to six files per media category and one thumbnail.");
      if (remove) setLocalVideo(null);
      else if (kind === "attachment") {
        const selected = files[0];
        setLocalVideo(selected && /\.(mp4|webm)$/i.test(selected.name) && selected.size > 0 && selected.size <= 500 * 1024 * 1024 ? selected : null);
      }
      let next = state;
      if (resume && (resume.complete || !state.media.some(item => item.sessionId === resume.sessionId && !item.complete))) throw new Error("Reopen the unfinished upload first.");
      if (Object.keys(captions).length) {
        started = true;
        const confirmed = await saveMediaCaptions(mediaApi, next, next.media, captions, controller.signal);
        if (confirmed) { next = confirmed; setState(next); onVersion(next.rowVersion); }
        onCaptions({});
      }
      for (let file of remove ? [null] : files) {
      if (file && kind !== "attachment") {
        if (file.size > 5 * 1024 * 1024) throw new Error("Image exceeds 5 MB.");
        const decoded = await createImageBitmap(file);
        if (decoded.width * decoded.height > 40_000_000) { decoded.close(); throw new Error("Image dimensions exceed limit."); }
        if (/\.webp$/i.test(file.name)) {
          const canvas = document.createElement("canvas");
          canvas.width = decoded.width;
          canvas.height = decoded.height;
          canvas.getContext("2d")!.drawImage(decoded, 0, 0);
          const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image conversion failed.")), "image/png"));
          file = new File([png], file.name.replace(/\.webp$/i, ".png"), { type: "image/png" });
        }
        decoded.close();
        if (file.size > 5 * 1024 * 1024) throw new Error("Converted image exceeds 5 MB.");
      }
      controller.signal.throwIfAborted();
      const videoTransfer = !remove && kind === "attachment" && /\.(mp4|webm)$/i.test(file!.name);
      if (!videoTransfer) started = true;
      const version = next.rowVersion;
      next = remove ? await mediaRequest(mediaApi.remove(saved.id, version, remove.sessionId), controller.signal)
        : videoTransfer
          ? await transferVideo(mediaApi, transferApi, next, file!, controller.signal, setState, setHashing, resume?.sessionId, () => { started = true; })
        : await uploadMedia(mediaApi, { id: saved.id, rowVersion: version, uploadProtocol: next.uploadProtocol, maxBlockSize: next.maxBlockSize }, file!, kind, controller.signal, setState);
      if (next.id !== saved.id || next.rowVersion === version) throw new Error("Unconfirmed media update.");
      setState(next);
      setPreview(null);
      onVersion(next.rowVersion);
      setUploadFile(null);
      }
    } catch {
      setLocalVideo(null);
      if (!started) setUploadFile(null);
      if (!controller.signal.aborted) { setUncertain(started); setError(started ? "Media save was not confirmed. Reopen the draft before retrying; unfinished uploads can be removed there." : resume ? "Resume unavailable. Select the exact upload file; expired or older uploads must be removed and restarted." : kind === "attachment" ? "Video preparation or access failed before upload. Check the file and try again." : "Use a valid image up to 5 MB and 40 megapixels. WebP is converted to PNG within that size limit."); }
    } finally {
      operation.current = null;
      setHashing(null);
      setBusy(false);
    }
  };
  const selectVideo = (file: File) => { if (/\.(mp4|webm)$/i.test(file.name)) setUploadFile(file); void mutate([file], "attachment"); };
  const pauseUpload = () => {
    operation.current?.abort();
    setUncertain(true); setError("Upload paused. Reopen the draft to check confirmed progress before resuming.");
  };
  const disabled = blocked || busy || preparing || uncertain || !state || state.rowVersion !== saved.rowVersion;
  const saveLink = async (input: LinkedAssetInput, id?: string) => {
    if (disabled || operation.current || !state) throw new Error("Media unavailable. Reopen the draft.");
    const controller = new AbortController(); operation.current = controller; setBusy(true); setError("");
    try {
      let checkpoint = state;
      const captionsSaved = await saveMediaCaptions(mediaApi, checkpoint, checkpoint.media, captions, controller.signal);
      if (captionsSaved) { checkpoint = captionsSaved; setState(checkpoint); onVersion(checkpoint.rowVersion); }
      onCaptions({});
      const next = await saveLinkedAsset(workflowApi, checkpoint, checkpoint.media, input, controller.signal, id);
      setState(next); onVersion(next.rowVersion); setPreview(null);
    } catch {
      if (!controller.signal.aborted) { setUncertain(true); setError("Asset save was not confirmed. Reopen the draft before retrying."); }
      throw new Error("Asset save was not confirmed. Reopen the draft before retrying.");
    } finally { operation.current = null; if (!controller.signal.aborted) setBusy(false); }
  };
  const thumbnail = state?.media.find(item => item.kind === "thumbnail" && item.complete);
  const reorder = async (kind: "image" | "attachment", ids: string[]) => {
    if (disabled || operation.current || !state || state.media.some(item => !item.complete)) return;
    const members = state.media.filter(item => item.kind === kind);
    if (members.length !== ids.length || new Set(ids).size !== ids.length || ids.some(id => !members.some(item => item.id === id))) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setError("");
    try {
      let checkpoint = state;
      const confirmed = await saveMediaCaptions(mediaApi, checkpoint, checkpoint.media, captions, controller.signal);
      if (confirmed) { checkpoint = confirmed; setState(checkpoint); onVersion(checkpoint.rowVersion); }
      onCaptions({});
      let position = 0;
      const order = checkpoint.media.map(item => item.kind === kind ? ids[position++] : item.id);
      const next = await saveMediaOrder(mediaApi, checkpoint, checkpoint.media, order, controller.signal);
      setState(next); onVersion(next.rowVersion);
    } catch {
      if (!controller.signal.aborted) { setUncertain(true); setError("Media order was not confirmed. Reopen the draft before retrying."); }
    } finally { operation.current = null; if (!controller.signal.aborted) setBusy(false); }
  };
  const uploadDisabled = disabled || !!state?.media.some(item => !item.complete);
  const remove = (id: string) => setRemoveTarget(state?.media.find(item => item.id === id) ?? null);
  const open = (id: string) => setPreview(state?.media.find(item => item.id === id && item.complete) ?? null);
  return <section className={embedded ? "min-w-0" : "mt-12 border-t border-(--glass-edge) pt-8"}>
    <SubmissionMedia capabilities={capabilities} disabled={disabled} attachmentDisabled={uploadDisabled} format={format} onFormat={setFormat} onAttachment={selectVideo} onPreparationBusy={setPreparing}
      onLinkedAsset={saveLink} onLinkedPending={setLinkedPending}
      onReorderImages={ids => void reorder("image", ids)} onReorderAttachments={ids => void reorder("attachment", ids)}
      onPreviewThumbnail={thumbnail ? () => open(thumbnail.id) : undefined} onPreviewImage={open} onPreviewAttachment={open}
      thumbnail={thumbnail && <ProtectedImage item={thumbnail} className="h-full w-full object-cover" />} onRemoveThumbnail={() => thumbnail && setRemoveTarget(thumbnail)}
      thumbnailUpload={<ImageUploadZone disabled={uploadDisabled} onFiles={files => void mutate(files.slice(0, 1), "thumbnail")} line="Upload a screenshot for the card." sub="PNG, JPG or WebP · 16:10 reads best" />}
      images={(state?.media ?? []).filter(item => item.kind === "image" && item.complete).map(item => ({ id: item.id, caption: captions[item.id] ?? item.caption ?? "", preview: <ProtectedImage item={item} className="h-full w-full object-cover" /> }))}
      onCaption={(id, caption) => onCaptions({ ...captions, [id]: caption })} onRemoveImage={remove}
      imageUpload={<ImageUploadZone disabled={uploadDisabled} multiple onFiles={files => void mutate(files, "image")} line="Add detail screenshots — flows, dashboards, the moments worth narrating." sub="Up to 6 · select several at once" />}
      attachments={(state?.media ?? []).filter(item => item.kind === "attachment" || !item.complete).map(item => ({ id: item.id, name: item.name, linkedAsset: item.linkedAsset, status: !item.complete && <UploadProgress name={item.name} received={item.received} size={item.size} active={busy} /> }))} onRemoveAttachment={remove}>
    {error && <p role="alert" className="mb-4 text-[14px]">{error}</p>}
    {uncertain && !busy && onReopen && <button type="button" className={button} onClick={onReopen}><Icon name="file" />Reopen saved draft</button>}
    {!state && !error && <LoadingState label="Loading media..." />}
    {error && !uncertain && <button className={button} onClick={() => { setError(""); setAttempt(current => current + 1); }}><Icon name="arrowRight" />Retry</button>}
    {busy && hashing === null && <LoadingState className="mt-4" label="Saving media..." />}
    {hashing !== null && <LoadingState label={`Checking video identity: ${hashing}%`} progress={hashing} />}
    {busy && uploadFile && <button type="button" className={button} onClick={pauseUpload}><Icon name="close" />Pause upload</button>}
    {uploadFile && <PreparedFileDownload file={uploadFile} />}
    {!busy && !uncertain && !blocked && state?.media.filter(item => !item.complete && item.mime.startsWith("video/")).map(item => <label key={item.sessionId} className="block text-[14px]">Resume {item.name}<input type="file" accept=".mp4,.webm" className="mt-2 block max-w-full" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) { setUploadFile(file); void mutate([file], "attachment", undefined, item); } }} /></label>)}
    {localVideo && !uncertain && !blocked && <LocalVideoPreview file={localVideo} onClose={() => setLocalVideo(null)} />}
    {preview && <MediaPreview key={preview.id} item={preview} solutionId={saved.id} mode="submission" onClose={() => setPreview(null)} />}
    {removeTarget && <ConfirmDialog title="Remove attachment?" confirmLabel="Remove attachment" onCancel={() => setRemoveTarget(null)} onConfirm={() => { setRemoveTarget(null); void mutate([], removeTarget.kind, removeTarget); }}><p className="mb-3 font-semibold text-(--ink)">{removeTarget.name}</p><p>This file will be removed from the saved draft.</p></ConfirmDialog>}
    </SubmissionMedia>
  </section>;
}


function PreparedFileDownload({ file }: { file: File }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (link.current) link.current.href = url;
    return () => { URL.revokeObjectURL(url); };
  }, [file]);
  return <a ref={link} download={file.name} className={button}><Icon name="download" />Keep upload file for resume</a>;
}
export function MediaPreview({ item, onClose, viewerTitle, solutionId, mode = "submission" }: { item: MediaItem; onClose: () => void; viewerTitle?: string; solutionId?: string; mode?: PlaybackMode }) {
  const [content, setContent] = useState<{ url: string; html?: string } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (item.linkedAsset || (solutionId && item.mime === "video/mp4")) return;
    let active = true;
    let url: string | undefined;
    void downloadMedia(item).then(async blob => {
      const html = item.mime === "text/html" ? await blob.text() : undefined;
      const image = item.kind !== "attachment" ? await imageDataUrl(blob) : undefined;
      if (!active) return;
      url = image ?? URL.createObjectURL(blob);
      if (html !== undefined) {
        const document = new DOMParser().parseFromString(html, "text/html");
        const policy = document.createElement("meta");
        policy.httpEquiv = "Content-Security-Policy";
        policy.content = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
        document.head.prepend(policy);
        setContent({ url, html: `<!doctype html>${document.documentElement.outerHTML}` });
      } else setContent({ url });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [item, solutionId]);
  if (solutionId && item.mime === "video/mp4") {
    const player = <StreamingVideo key={`${item.id}:${mode}`} item={item} solutionId={solutionId} mode={mode} />;
    return viewerTitle ? <ViewerFrame name={viewerTitle} kind="Video walkthrough" onClose={onClose}>{player}</ViewerFrame>
      : <section className="mt-6 border-t border-(--glass-edge) pt-5"><div className="flex items-center justify-between gap-3"><h3 className="min-w-0 break-words text-[18px]">{item.name}</h3><button type="button" className={button} onClick={onClose} aria-label="Close preview"><Icon name="close" /></button></div>{player}</section>;
  }
  if (item.linkedAsset) {
    const link = item.linkedAsset;
    const embedded = link.assetType === "Hosted web app (URL)" && link.allowsEmbedding;
    const content = embedded ? <iframe title={link.name} src={link.externalUrl} sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" className="h-full min-h-[360px] w-full border-0 bg-white" />
      : <div className="grid h-full min-h-[360px] place-items-center p-6 text-center"><div><p className="eyebrow">{link.assetType}</p><h2 className="mt-3 text-[22px] font-semibold">{link.name}</h2><p className="mx-auto mt-3 max-w-[48ch] whitespace-pre-wrap break-words text-[15px] text-(--ink-2)">{link.embedHint || "Open the application in a new tab."}</p>{link.externalUrl && <a className={`${button} mt-6`} href={link.externalUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" />Open in new tab</a>}{!link.externalUrl && <p className="mt-4 text-[13px] text-(--ink-3)">No demo request has been sent.</p>}</div></div>;
    if (viewerTitle) return <ViewerFrame name={viewerTitle} kind={link.assetType} onClose={onClose} externalUrl={link.externalUrl || undefined} hint={embedded ? link.embedHint : undefined}>{content}</ViewerFrame>;
    return <div className="mt-6 border-t border-(--glass-edge) pt-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="min-w-0 flex-1 break-words text-[18px] font-semibold">{link.name}</h3>{embedded && <a className={button} href={link.externalUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" />Open in new tab</a>}<button className={button} onClick={onClose} aria-label="Close preview"><Icon name="close" /></button></div>{embedded && link.embedHint && <p className="mb-3 break-words text-[13px] text-(--ink-2)">{link.embedHint}</p>}{content}</div>;
  }
  const stage = error ? <p role="alert" className="p-6">Media could not be downloaded.</p> : !content ? <LoadingState variant="media" className={viewerTitle ? "h-full w-full" : "h-64"} label="Loading preview..." />
    : item.kind !== "attachment" ? <img src={content.url} alt={item.caption || item.name} className={viewerTitle ? "h-full w-full object-contain" : "max-h-[65vh] w-full object-contain"} />
    : content.html !== undefined ? <iframe title={item.name} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={content.html} className={`${viewerTitle ? "h-full" : "h-[65vh]"} w-full border-0 bg-white`} />
    : item.mime.startsWith("video/") ? <VideoPlayer key={content.url} src={content.url} name={item.name} className={viewerTitle ? "h-full w-full" : "max-h-[65vh] w-full"} />
    : <div className="grid h-full place-items-center p-6 text-center"><a className={button} href={content.url} download={item.name}><Icon name="download" /><span className="break-all">{item.name}</span></a></div>;
  if (viewerTitle) return <ViewerFrame name={viewerTitle} kind={item.kind === "attachment" ? mediaAsset(item, 0).assetType : "Screenshot"} onClose={onClose} actions={content && <a className={button} href={content.url} download={item.name} aria-label={`Download ${item.name}`} title="Download"><Icon name="download" /></a>}>{stage}</ViewerFrame>;
  return <div className="mt-6 border-t border-(--glass-edge) pt-5">
    <div className="mb-4 flex flex-wrap items-center gap-3"><h3 className="min-w-0 flex-1 break-all text-[18px] font-semibold">{item.name}</h3>{content && <a className={button} href={content.url} download={item.name}><Icon name="download" />Download</a>}<button className={button} onClick={onClose} aria-label="Close preview" title="Close preview"><Icon name="close" /></button></div>
    {stage}
  </div>;
}

