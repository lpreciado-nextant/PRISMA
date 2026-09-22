import { useEffect, useRef, useState } from "react";
import { transferApi, downloadMedia } from "./dataSource";
import { readVideoRange, type PlaybackMode } from "./mediaTransfer";
import type { MediaItem } from "./media";
import { Icon } from "../../src/components/Icon";
import { LoadingState } from "../../src/components/LoadingState";

export function StreamingVideo({ item, solutionId, mode }: { item: MediaItem; solutionId: string; mode: PlaybackMode }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [fullVideoReason, setFullVideoReason] = useState("");
  const [full, setFull] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [captionError, setCaptionError] = useState("");
  const lifetime = useRef<AbortController | null>(null);
  const downloads = useRef<string[]>([]);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    const urls = downloads.current;
    return () => { controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
  }, []);
  const download = async () => {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted || downloading) return;
    setDownloading(true);
    try {
      const check = await readVideoRange(transferApi, solutionId, item.id, mode, 0, item.size, controller.signal);
      const blob = await downloadMedia(item);
      await readVideoRange(transferApi, solutionId, item.id, mode, 0, item.size, controller.signal, check.version);
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(blob); downloads.current.push(url);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = item.name;
      document.body.append(anchor); anchor.click(); anchor.remove();
    } catch { if (!controller.signal.aborted) setError("Download unavailable. Reopen the video to check access."); }
    finally { if (!controller.signal.aborted) setDownloading(false); }
  };
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const controller = new AbortController();
    let version: string | undefined;
    let checking = false;
    let objectUrl: string | undefined;
    const captionUrls: string[] = [];
    const captionElements: HTMLTrackElement[] = [];
    const clearCaptions = () => { captionElements.splice(0).forEach(track => track.remove()); captionUrls.splice(0).forEach(url => URL.revokeObjectURL(url)); };
    const read = async (offset: number, signal: AbortSignal) => {
      const result = await readVideoRange(transferApi, solutionId, item.id, mode, offset, item.size, AbortSignal.any([signal, AbortSignal.timeout(60_000)]), version);
      version = result.version; return result.bytes;
    };
    const fail = (fullVideoReason = "") => {
      controller.abort(); element.pause(); element.removeAttribute("src"); element.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      clearCaptions();
      setLoading(false); setFullVideoReason(fullVideoReason);
      setError(fullVideoReason ? "" : "Playback unavailable. The format may be unsupported or your access may have changed.");
    };
    const heartbeat = setInterval(() => {
      if (!version || checking || controller.signal.aborted) return;
      checking = true;
      void read(0, controller.signal).catch(() => { if (!controller.signal.aborted) fail(); }).finally(() => { checking = false; });
    }, 30_000);
    const loaded = () => setLoading(false);
    const decodeError = () => { if (!controller.signal.aborted) fail(); };
    element.addEventListener("loadeddata", loaded); element.addEventListener("error", decodeError);
    void (async () => {
      if (full) {
        await read(0, controller.signal);
        const blob = await downloadMedia(item);
        await read(0, controller.signal);
        controller.signal.throwIfAborted();
        try {
          const { extractMp4Captions, captionsVtt } = await import("./mp4Captions");
          const captions = await extractMp4Captions(blob, controller.signal);
          controller.signal.throwIfAborted();
          for (const [index, caption] of captions.entries()) {
            const track = document.createElement("track"); track.kind = "subtitles"; track.label = `Captions ${index + 1}`; track.srclang = caption.language;
            const url = URL.createObjectURL(new Blob([captionsVtt(caption)], { type: "text/vtt" }));
            track.src = url; captionUrls.push(url); captionElements.push(track); element.append(track);
          }
        } catch { if (!controller.signal.aborted) setCaptionError("Embedded captions could not be displayed. Download the original to retain all tracks."); }
        controller.signal.throwIfAborted();
        objectUrl = URL.createObjectURL(blob); element.src = objectUrl;
      } else {
        const { streamVideo, FullVideoRequiredError } = await import("./videoStream");
        controller.signal.throwIfAborted();
        try {
          await streamVideo(element, item.size, read, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) return;
          if (error instanceof FullVideoRequiredError) fail(error.message);
          else throw error;
        }
      }
    })().catch(() => { if (!controller.signal.aborted) fail(); });
    return () => {
      controller.abort(); clearInterval(heartbeat);
      element.removeEventListener("loadeddata", loaded); element.removeEventListener("error", decodeError);
      element.pause(); element.removeAttribute("src"); element.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      clearCaptions();
    };
  }, [item, solutionId, mode, full]);
  return <div className="flex h-full min-h-64 flex-col gap-3 p-3">
    {loading && !error && <LoadingState label={full ? "Downloading video..." : "Buffering video..."} />}
    {(error || fullVideoReason) && <div role={error ? "alert" : "status"} className="text-[14px]"><p>{error || fullVideoReason}</p>{!full && <button type="button" className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3" onClick={() => { setError(""); setFullVideoReason(""); setLoading(true); setFull(true); }}><Icon name="download" />Load full video</button>}</div>}
    <video ref={video} controls preload="metadata" aria-label={item.name} className="min-h-0 w-full flex-1 object-contain" />
    {captionError && <p role="status" className="text-[13px]">{captionError}</p>}
    <button type="button" disabled={downloading} onClick={() => void download()} title="Download video" aria-label={`Download ${item.name}`} className="inline-flex min-h-10 cursor-pointer items-center gap-2 self-end rounded-lg border border-(--glass-edge) px-3 text-[14px] disabled:opacity-40"><Icon name="download" />{downloading ? "Downloading..." : "Download"}</button>
  </div>;
}