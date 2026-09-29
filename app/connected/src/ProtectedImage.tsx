import { useEffect, useState } from "react";
import { LoadingState } from "../../src/components/LoadingState";
import { downloadMedia } from "./dataSource";
import { imageDataUrl, type MediaItem } from "./media";

// The gallery, the lightbox and its filmstrip show the same images; share one download per
// upload. The key changes when an image is replaced (new session), so stale bytes never show.
const CACHE_LIMIT = 24;
const cache = new Map<string, Promise<string>>();

function cachedImage(item: MediaItem): Promise<string> {
  const key = `${item.id}:${item.sessionId}:${item.size}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const load = downloadMedia(item).then(blob => imageDataUrl(blob));
  cache.set(key, load);
  load.catch(() => cache.delete(key));
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return load;
}

export function ProtectedImage({ item, className = "h-full w-full object-contain" }: { item: MediaItem; className?: string }) {
  const [preview, setPreview] = useState<{ item: MediaItem; url?: string; error?: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    void cachedImage(item).then(url => { if (active) setPreview({ item, url }); }).catch(() => { if (active) setPreview({ item, error: true }); });
    return () => { active = false; };
  }, [item]);
  const current = preview?.item === item ? preview : null;
  return current?.url ? <img src={current.url} alt={item.caption || item.name} className={className} onError={() => setPreview({ item, error: true })} />
    : current?.error ? <div role="status" className={`${className} grid place-items-center text-[13px] text-(--ink-2)`}>Image unavailable</div>
    : <LoadingState variant="media" className={className} label="Loading image..." />;
}
