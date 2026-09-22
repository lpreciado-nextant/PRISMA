import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export function VideoPlayer({ src, name, className }: { src: string; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div role="alert" className="grid h-full min-h-48 place-items-center p-6 text-center"><div><p className="text-[16px] font-semibold">Video could not be played in this browser.</p><a href={src} download={name} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px]"><Icon name="download" />Download video</a></div></div>;
  return <video controls src={src} aria-label={name} className={className} onError={() => setFailed(true)} />;
}

export function ViewerFrame({ name, kind, onClose, externalUrl, hint, actions, children }: { name: string; kind?: string; onClose: () => void; externalUrl?: string; hint?: string; actions?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="animate-scale-in mx-auto flex h-[calc(100dvh-6rem)] min-h-[360px] w-full max-w-[1340px] flex-col px-4 pt-4 pb-6 sm:px-6">
    <div className="glass glass-sheen mb-3 flex flex-wrap items-center gap-3 rounded-[16px] px-4 py-2.5">
      <button type="button" onClick={onClose} className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold text-(--ink-2)"><Icon name="chevronLeft" size={15} className="shrink-0" /><span className="break-words">{name}</span></button>
      <span className="hidden font-mono text-[10.5px] uppercase text-(--ink-3) sm:block">{kind}</span>
      <div className="ml-auto flex shrink-0 items-center gap-2">{actions}{externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-(--glass-edge) px-3 py-1.5 text-[12.5px] font-semibold">Pop out<Icon name="external" size={13} /></a>}<button type="button" onClick={onClose} aria-label="Close the viewer" title="Close the viewer" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-(--ink-3)"><Icon name="close" size={16} /></button></div>
    </div>
    {hint && <p className="mb-3 px-1 text-[13px] text-(--ink-3)">{hint}</p>}
    <div className="glass glass-lite relative min-h-0 flex-1 overflow-hidden rounded-[20px]">{children}</div>
  </div>;
}