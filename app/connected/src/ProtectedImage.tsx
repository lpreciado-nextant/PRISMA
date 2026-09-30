import { useEffect, useState } from "react";
import { LoadingState } from "../../src/components/LoadingState";
import { downloadMedia } from "./dataSource";
import { imageDataUrl, type MediaItem } from "./media";

// The gallery, the lightbox and its filmstrip show the same images; share one download per
// upload. The key changes when an image is replaced (new session), so stale bytes never show.
const CACHE_LIMIT = 24;
const cache = new Map<string, { load: Promise<string>; url?: string }>();
const imageKey = (item: MediaItem) => `${item.id}:${item.sessionId}:${item.size}`;

function cachedImage(item: MediaItem): Promise<string> {
  const key = imageKey(item);
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit.load; }
  const entry: { load: Promise<string>; url?: string } = { load: downloadMedia(item).then(blob => imageDataUrl(blob)) };
  cache.set(key, entry);
  entry.load.then(url => { entry.url = url; }, () => { if (cache.get(key) === entry) cache.delete(key); });
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return entry.load;
}

export function ProtectedImage({ item, className = "h-full w-full object-contain" }: { item: MediaItem; className?: string }) {
  const key = imageKey(item);
  const [preview, setPreview] = useState<{ key: string; url?: string; error?: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    const requested = imageKey(item);
    void cachedImage(item).then(url => { if (active) setPreview({ key: requested, url }); }).catch(() => { if (active) setPreview({ key: requested, error: true }); });
    return () => { active = false; };
  }, [item]);
  // An image downloaded earlier (a card before its detail page, or before going back) shows without a loading frame.
  const current = preview?.key === key ? preview : { key, url: cache.get(key)?.url };
  return current.url ? <img src={current.url} alt={item.caption || item.name} className={className} onError={() => setPreview({ key, error: true })} />
    : current.error ? <div role="status" className={`${className} grid place-items-center text-[13px] text-(--ink-2)`}>Image unavailable</div>
    : <LoadingState variant="media" className={className} label="Loading image..." />;
}
