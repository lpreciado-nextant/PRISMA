import { useEffect, useState } from "react";
import { LoadingState } from "../../src/components/LoadingState";
import type { MediaItem } from "./media";
import { cachedImage, cachedUrl, imageKey } from "./imageCache";

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
  const current = preview?.key === key ? preview : { key, url: cachedUrl(key) };
  return current.url ? <img src={current.url} alt={item.caption || item.name} className={className} onError={() => setPreview({ key, error: true })} />
    : current.error ? <div role="status" className={`${className} grid place-items-center text-[13px] text-(--ink-2)`}>Image unavailable</div>
    : <LoadingState variant="media" className={className} label="Loading image..." />;
}
