import { useEffect, useState } from "react";
import { downloadMedia } from "./dataSource";
import { imageDataUrl, type MediaItem } from "./media";

export function ProtectedImage({ item, className = "h-full w-full object-contain" }: { item: MediaItem; className?: string }) {
  const [preview, setPreview] = useState<{ item: MediaItem; url?: string; error?: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void downloadMedia(item).then(blob => imageDataUrl(blob, controller.signal)).then(url => { if (!controller.signal.aborted) setPreview({ item, url }); }).catch(() => { if (!controller.signal.aborted) setPreview({ item, error: true }); });
    return () => { controller.abort(); };
  }, [item]);
  const current = preview?.item === item ? preview : null;
  return current?.url ? <img src={current.url} alt={item.caption || item.name} className={className} onError={() => setPreview({ item, error: true })} /> : <div role="status" className={`${className} grid place-items-center text-[13px] text-(--ink-2)`}>{current?.error ? "Image unavailable" : "Loading image..."}</div>;
}