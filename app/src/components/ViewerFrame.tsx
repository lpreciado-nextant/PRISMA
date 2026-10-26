import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { assetTypeLabel } from "../lib/linkedAssets";

export function LocalVideoPreview({ file, onClose }: { file: File; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const url = URL.createObjectURL(file);
    element.src = url;
    return () => { element.pause(); element.removeAttribute("src"); element.load(); URL.revokeObjectURL(url); };
  }, [file]);
  return <section aria-label="Local video preview" className="mt-6 border-t border-(--glass-edge) pt-5">
    <div className="mb-3 flex items-center gap-3"><div className="min-w-0 flex-1"><p className="eyebrow">Local file preview</p><h3 className="mt-1 break-words text-[16px] font-semibold">{file.name}</h3></div><button type="button" aria-label="Close local preview" title="Close local preview" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-(--glass-edge)" onClick={onClose}><Icon name="close" /></button></div>
    {failedFile === file && <p role="alert" className="mb-3 text-[14px]">This local video could not be played in this browser.</p>}
    <video ref={video} controls aria-label={`Local preview: ${file.name}`} className="max-h-[65vh] w-full" onError={() => setFailedFile(file)} />
  </section>;
}

export function VideoPlayer({ src, name, fileName = name, className }: { src: string; name: string; fileName?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div role="alert" className="grid h-full min-h-48 place-items-center p-6 text-center"><div><p className="text-[16px] font-semibold">Video could not be played in this browser.</p><a href={src} download={fileName} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px]"><Icon name="download" />Download video</a></div></div>;
  return <video controls src={src} aria-label={name} className={className} onError={() => setFailed(true)} />;
}

/**
 * Full screen for the demo stage. The browser's own full screen when the host allows it (Power Apps
 * runs the app in its own iframe, which may not); otherwise the stage expands over the PRISMA chrome
 * to fill the app's window. The demo stays in its sandboxed iframe either way.
 */
function useStageFullScreen() {
  const stage = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [native, setNative] = useState(false);
  // Esc that ends the browser's full screen can also reach the page; it must not close the viewer too.
  const exitedAt = useRef(0);
  useEffect(() => {
    const element = stage.current;
    const onChange = () => {
      const active = !!element && document.fullscreenElement === element;
      if (!active) exitedAt.current = Date.now();
      setNative(active);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (element && document.fullscreenElement === element) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);
  const active = native || expanded;
  const enter = () => {
    const element = stage.current;
    if (element && document.fullscreenEnabled && element.requestFullscreen) void element.requestFullscreen().catch(() => setExpanded(true));
    else setExpanded(true);
  };
  const exit = () => {
    setExpanded(false);
    if (native) void document.exitFullscreen().catch(() => undefined);
  };
  /** Handles Esc while full screen; true when the key was used and the viewer must stay open. */
  const escape = () => {
    if (expanded) { setExpanded(false); return true; }
    return native || Date.now() - exitedAt.current < 500;
  };
  return { stage, active, expanded, toggle: () => active ? exit() : enter(), exit, escape };
}

/**
 * The demo viewer: a header (title, type, actions) over one 16:9 stage, the same size and place for every demo type;
 * the content fits inside it. `newTabUrl` offers "Open in new tab"; `focused` is that tab: the viewer fills the page.
 */
export function ViewerFrame({ name, kind, onClose, externalUrl, hint, actions, newTabUrl, focused = false, children }: { name: string; kind?: string; onClose: () => void; externalUrl?: string; hint?: string; actions?: ReactNode; newTabUrl?: string; focused?: boolean; children: ReactNode }) {
  const { stage, active, expanded, toggle, exit, escape } = useStageFullScreen();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !escape()) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, escape]);
  const fullLabel = active ? "Exit full screen" : "Full screen";
  return <div className={`animate-scale-in mx-auto flex ${focused ? "h-dvh" : "h-[calc(100dvh-6rem)]"} min-h-[360px] w-full max-w-[1340px] flex-col px-4 pt-4 pb-6 sm:px-6`}>
    <div className="glass glass-sheen mb-3 flex flex-wrap items-center gap-3 rounded-[16px] px-4 py-2.5">
      <button type="button" onClick={onClose} title={focused ? "Back to the solution" : undefined} className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold text-(--ink-2)"><Icon name="chevronLeft" size={15} className="shrink-0" /><span className="break-words">{name}</span></button>
      <span className="hidden font-mono text-[10.5px] uppercase text-(--ink-3) sm:block">{kind && assetTypeLabel(kind)}</span>
      <div className="ml-auto flex shrink-0 items-center gap-2">{actions}{newTabUrl && <a href={newTabUrl} target="_blank" rel="noopener noreferrer" title="Open this demo on its own in a new browser tab" className="inline-flex items-center gap-1.5 rounded-lg border border-(--glass-edge) px-3 py-1.5 text-[12.5px] font-semibold"><Icon name="external" size={13} /><span className="hidden sm:inline">Open in new tab</span></a>}<button type="button" onClick={toggle} aria-label={fullLabel} title={fullLabel} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-(--glass-edge) px-3 py-1.5 text-[12.5px] font-semibold"><Icon name="maximize" size={13} /><span className="hidden sm:inline">Full screen</span></button>{externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-(--glass-edge) px-3 py-1.5 text-[12.5px] font-semibold">Pop out<Icon name="external" size={13} /></a>}<button type="button" onClick={onClose} aria-label="Close the viewer" title="Close the viewer" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-(--ink-3)"><Icon name="close" size={16} /></button></div>
    </div>
    {hint && <p className="mb-3 px-1 text-[13px] text-(--ink-3)">{hint}</p>}
    {/* The stage keeps 16:9 and fits the space left under the header, centred, whatever the demo type. */}
    <div className="viewer-fit min-h-0 flex-1">
      <div ref={stage} className={`viewer-stage viewer-stage--169 glass glass-lite relative overflow-hidden ${expanded ? "viewer-stage--expanded" : "rounded-[20px]"}`}>
        {children}
        {active && <button type="button" onClick={exit} aria-label="Exit full screen" title="Exit full screen (Esc)" className="viewer-stage-exit"><Icon name="minimize" size={15} /></button>}
      </div>
    </div>
  </div>;
}