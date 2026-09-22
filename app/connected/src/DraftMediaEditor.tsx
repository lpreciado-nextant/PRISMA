import { useEffect, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";
import { ConfirmDialog } from "../../src/components/ConfirmDialog";
import { ViewerFrame } from "../../src/components/ViewerFrame";
import { ProtectedImage } from "./ProtectedImage";
import { ImageUploadZone, SubmissionMedia } from "../../src/components/SubmissionForm";
import type { AssetType } from "../../src/types";
import { mediaApi, downloadMedia } from "./dataSource";
import { mediaRequest, uploadMedia, type MediaItem, type MediaKind, type MediaState } from "./media";
import type { SavedDraft } from "./drafts";
import { mediaAsset } from "./workflow";

const button = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3 py-2 text-[14px] disabled:opacity-50";

export function DraftMediaEditor({ saved, blocked, onVersion, onBusy, onPending, embedded = false, onMedia, capabilities = [] }: { saved: SavedDraft; blocked: boolean; onVersion: (version: string) => void; onBusy: (busy: boolean) => void; onPending?: (pending: boolean) => void; embedded?: boolean; onMedia?: (media: MediaItem[]) => void; capabilities?: string[] }) {
  const [state, setState] = useState<MediaState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MediaItem | null>(null);
  const [format, setFormat] = useState<AssetType>("Self-contained HTML file");
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const metadataDirty = !!state?.media.some(item => captions[item.id] !== undefined && captions[item.id] !== (item.caption ?? ""));
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
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  useEffect(() => {
    onPending?.(uncertain || metadataDirty);
    return () => onPending?.(false);
  }, [uncertain, metadataDirty, onPending]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  const mutate = async (files: File[], kind: MediaKind, remove?: MediaItem, metadata = false) => {
    if (operation.current || blocked || uncertain || !state || state.rowVersion !== saved.rowVersion) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError("");
    let started = false;
    try {
      if (!remove && !metadata && (!files.length || files.length + state.media.filter(item => item.kind === kind).length > (kind === "thumbnail" ? 1 : 6))) throw new Error("Choose up to six files per media category and one thumbnail.");
      let next = state;
      for (let file of remove || metadata ? [null] : files) {
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
      started = true;
      const version = next.rowVersion;
      next = metadata ? await mediaRequest(mediaApi.metadata(saved.id, version, JSON.stringify(state.media.filter(item => item.complete).map((item, index) => ({ id: item.id, caption: captions[item.id] ?? item.caption ?? "", sortOrder: item.sortOrder ?? index })))), controller.signal)
        : remove ? await mediaRequest(mediaApi.remove(saved.id, version, remove.sessionId), controller.signal)
        : await uploadMedia(mediaApi, { id: saved.id, rowVersion: version }, file!, kind, controller.signal, setState);
      if (next.id !== saved.id || next.rowVersion === version) throw new Error("Unconfirmed media update.");
      setState(next);
      setPreview(null);
      onVersion(next.rowVersion);
      if (metadata) setCaptions({});
      }
    } catch {
      if (!controller.signal.aborted) { setUncertain(started); setError(started ? "Upload or removal was not confirmed. Reopen the draft before retrying; unfinished uploads can be removed there." : "Use a valid image up to 5 MB and 40 megapixels. WebP is converted to PNG within that size limit."); }
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const disabled = blocked || busy || uncertain || !state || state.rowVersion !== saved.rowVersion;
  const thumbnail = state?.media.find(item => item.kind === "thumbnail" && item.complete);
  const uploadDisabled = disabled || metadataDirty || !!state?.media.some(item => !item.complete);
  const remove = (id: string) => setRemoveTarget(state?.media.find(item => item.id === id) ?? null);
  const open = (id: string) => setPreview(state?.media.find(item => item.id === id && item.complete) ?? null);
  return <section className={embedded ? "min-w-0" : "mt-12 border-t border-(--glass-edge) pt-8"}>
    <SubmissionMedia capabilities={capabilities} disabled={disabled} attachmentDisabled={uploadDisabled} format={format} onFormat={setFormat} onAttachment={file => void mutate([file], "attachment")}
      onPreviewThumbnail={thumbnail ? () => open(thumbnail.id) : undefined} onPreviewImage={open} onPreviewAttachment={open}
      thumbnail={thumbnail && <ProtectedImage item={thumbnail} className="h-full w-full object-cover" />} onRemoveThumbnail={() => thumbnail && setRemoveTarget(thumbnail)}
      thumbnailUpload={<ImageUploadZone disabled={uploadDisabled} onFiles={files => void mutate(files.slice(0, 1), "thumbnail")} line="Upload a screenshot for the card." sub="PNG, JPG or WebP · 16:10 reads best" />}
      images={(state?.media ?? []).filter(item => item.kind === "image" && item.complete).map(item => ({ id: item.id, caption: captions[item.id] ?? item.caption ?? "", preview: <ProtectedImage item={item} className="h-full w-full object-cover" /> }))}
      onCaption={(id, caption) => setCaptions(current => ({ ...current, [id]: caption }))} onRemoveImage={remove}
      imageUpload={<ImageUploadZone disabled={uploadDisabled} multiple onFiles={files => void mutate(files, "image")} line="Add detail screenshots — flows, dashboards, the moments worth narrating." sub="Up to 6 · select several at once" />}
      attachments={(state?.media ?? []).filter(item => item.kind === "attachment" || !item.complete).map(item => ({ id: item.id, name: item.name, status: !item.complete && <p className="text-[13px] text-(--ink-2)">{Math.round(item.received / item.size * 100)}% · Unfinished upload{busy && <progress className="mt-2 w-full" value={item.received} max={item.size} aria-label={`Upload ${item.name}`} />}</p> }))} onRemoveAttachment={remove}>
    {error && <p role="alert" className="mb-4 text-[14px]">{error}</p>}
    {!state && !error && <p role="status">Loading media...</p>}
    {error && !uncertain && <button className={button} onClick={() => { setError(""); setAttempt(current => current + 1); }}><Icon name="arrowRight" />Retry</button>}
    {metadataDirty && <div className="mb-5 flex flex-wrap gap-3"><button className={button} disabled={disabled} onClick={() => void mutate([], "image", undefined, true)}><Icon name="check" />Save captions</button><button className={button} disabled={disabled} onClick={() => setCaptions({})}>Discard caption edits</button></div>}
    {busy && <p role="status" className="mt-4 text-[14px]">Saving media...</p>}
    {preview && <MediaPreview key={preview.id} item={preview} onClose={() => setPreview(null)} />}
    {removeTarget && <ConfirmDialog title="Remove attachment?" confirmLabel="Remove attachment" onCancel={() => setRemoveTarget(null)} onConfirm={() => { setRemoveTarget(null); void mutate([], removeTarget.kind, removeTarget); }}><p className="mb-3 font-semibold text-(--ink)">{removeTarget.name}</p><p>This file will be removed from the saved draft.</p></ConfirmDialog>}
    </SubmissionMedia>
  </section>;
}

export function MediaPreview({ item, onClose, viewerTitle }: { item: MediaItem; onClose: () => void; viewerTitle?: string }) {
  const [content, setContent] = useState<{ url: string; html?: string } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    void downloadMedia(item).then(async blob => {
      const html = item.mime === "text/html" ? await blob.text() : undefined;
      if (!active) return;
      url = URL.createObjectURL(blob);
      if (html !== undefined) {
        const document = new DOMParser().parseFromString(html, "text/html");
        const policy = document.createElement("meta");
        policy.httpEquiv = "Content-Security-Policy";
        policy.content = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
        document.head.prepend(policy);
        setContent({ url, html: `<!doctype html>${document.documentElement.outerHTML}` });
      } else setContent({ url });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [item]);
  const stage = error ? <p role="alert" className="p-6">Media could not be downloaded.</p> : !content ? <p role="status" className="p-6">Loading preview...</p>
    : item.kind !== "attachment" ? <img src={content.url} alt={item.caption || item.name} className={viewerTitle ? "h-full w-full object-contain" : "max-h-[65vh] w-full object-contain"} />
    : content.html !== undefined ? <iframe title={item.name} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={content.html} className={`${viewerTitle ? "h-full" : "h-[65vh]"} w-full border-0 bg-white`} />
    : item.mime.startsWith("video/") ? <video controls src={content.url} className={viewerTitle ? "h-full w-full" : "max-h-[65vh] w-full"} />
    : <div className="grid h-full place-items-center p-6 text-center"><a className={button} href={content.url} download={item.name}><Icon name="download" /><span className="break-all">{item.name}</span></a></div>;
  if (viewerTitle) return <ViewerFrame name={viewerTitle} kind={item.kind === "attachment" ? mediaAsset(item, 0).assetType : "Screenshot"} onClose={onClose} actions={content && <a className={button} href={content.url} download={item.name} aria-label={`Download ${item.name}`} title="Download"><Icon name="download" /></a>}>{stage}</ViewerFrame>;
  return <div className="mt-6 border-t border-(--glass-edge) pt-5">
    <div className="mb-4 flex flex-wrap items-center gap-3"><h3 className="min-w-0 flex-1 break-all text-[18px] font-semibold">{item.name}</h3>{content && <a className={button} href={content.url} download={item.name}><Icon name="download" />Download</a>}<button className={button} onClick={onClose} aria-label="Close preview" title="Close preview"><Icon name="close" /></button></div>
    {stage}
  </div>;
}

