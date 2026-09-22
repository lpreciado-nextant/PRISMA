import { useEffect, useState } from "react";
import { downloadMedia } from "./dataSource";
import type { MediaItem } from "./media";

export function ProtectedImage({ item, className = "h-full w-full object-contain" }: { item: MediaItem; className?: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let source = "";
    void downloadMedia(item).then(blob => { if (active) { source = URL.createObjectURL(blob); setUrl(source); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (source) URL.revokeObjectURL(source); };
  }, [item]);
  return url ? <img src={url} alt={item.caption || item.name} className={className} /> : <div role="status" className={`${className} grid place-items-center text-[13px] text-(--ink-2)`}>{error ? "Image unavailable" : "Loading image..."}</div>;
}