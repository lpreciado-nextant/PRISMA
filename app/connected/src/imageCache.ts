import { downloadMedia } from "./dataSource";
import { imageDataUrl, type MediaItem } from "./media";

// The gallery, the lightbox and its filmstrip show the same images; share one download per
// upload. The key changes when an image is replaced (new session), so stale bytes never show.
const CACHE_LIMIT = 24;
const cache = new Map<string, { load: Promise<string>; url?: string }>();
export const imageKey = (item: MediaItem) => `${item.id}:${item.sessionId}:${item.size}`;

export function cachedImage(item: MediaItem): Promise<string> {
  const key = imageKey(item);
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit.load; }
  const entry: { load: Promise<string>; url?: string } = { load: downloadMedia(item).then(blob => imageDataUrl(blob)) };
  cache.set(key, entry);
  entry.load.then(url => { entry.url = url; }, () => { if (cache.get(key) === entry) cache.delete(key); });
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return entry.load;
}

/** A file this session just uploaded is shown from memory: its stored copy would only be downloaded again to look the same. */
export function primeImage(item: MediaItem, file: Blob): void {
  const key = imageKey(item);
  if (cache.has(key) || file.size !== item.size) return;
  const entry: { load: Promise<string>; url?: string } = { load: imageDataUrl(file) };
  cache.set(key, entry);
  entry.load.then(url => { entry.url = url; }, () => { if (cache.get(key) === entry) cache.delete(key); });
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

export const cachedUrl = (key: string) => cache.get(key)?.url;
