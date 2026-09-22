import { useEffect, useRef, useState } from "react";
import { downloadMedia } from "./dataSource";
import type { MediaItem } from "./media";

export function useMediaAction(onPreview: (item: MediaItem) => void) {
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  const running = useRef(false);
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const sources = urls.current;
    return () => { controller.abort(); sources.forEach(url => URL.revokeObjectURL(url)); };
  }, []);
  const open = async (item: MediaItem | undefined) => {
    if (!item || running.current) return;
    setFailed(false);
    setMessage("");
    if (item.linkedAsset) {
      const link = item.linkedAsset;
      if (link.assetType === "Desktop app or script" || (link.assetType === "Hosted web app (URL)" && link.allowsEmbedding)) onPreview(item);
      else window.open(link.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.kind === "image" || item.mime === "text/html" || item.mime.startsWith("video/")) { onPreview(item); return; }
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted) return;
    running.current = true;
    setDownloading(true);
    setMessage(`Downloading ${item.name}...`);
    try {
      const blob = await downloadMedia(item);
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.name;
      document.body.append(link);
      link.click();
      link.remove();
      setMessage(`Download started: ${item.name}`);
    } catch {
      if (!controller.signal.aborted) { setFailed(true); setMessage("Download unavailable. Check your connection and access, then try again."); }
    } finally { running.current = false; if (!controller.signal.aborted) setDownloading(false); }
  };
  return { open, message, failed, downloading };
}