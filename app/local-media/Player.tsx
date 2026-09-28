import { useEffect, useRef, useState } from "react";
import { Icon } from "../src/components/Icon";
import { FullVideoRequiredError } from "../connected/src/videoStream";
import { extractMp4Captions, captionsVtt } from "../connected/src/mp4Captions";
import { fullVideo, readRange, type Actor, type Mode, type Upload } from "./client";

export function Player({ actor, id, upload, mode }: { actor: Actor; id: string; upload: Upload; mode: Mode }) {
  const video = useRef<HTMLVideoElement>(null);
  const lifetime = useRef<AbortController | null>(null);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState("");
  const [full, setFull] = useState(false);
  const [ready, setReady] = useState(false);
  const [reads, setReads] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [captionError, setCaptionError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const controller = new AbortController();
    const urls: string[] = [];
    const tracks: HTMLTrackElement[] = [];
    let version: string | undefined;
    let checking = false;
    const clear = () => {
      element.pause(); element.removeAttribute("src"); element.load();
      tracks.splice(0).forEach(track => track.remove());
      urls.splice(0).forEach(url => URL.revokeObjectURL(url));
    };
    const fail = (reason: unknown) => {
      if (controller.signal.aborted) return;
      controller.abort(); clear();
      if (reason instanceof FullVideoRequiredError) setFallback(reason.message);
      else setError(reason instanceof Error ? reason.message : "Playback unavailable.");
      setReady(false);
    };
    const read = async (offset: number, signal: AbortSignal) => {
      const result = await readRange(actor, id, upload, mode, offset, signal, version);
      version = result.version; setReads(previous => previous + 1);
      return result.bytes;
    };
    const loaded = () => setReady(true);
    const decodeError = () => fail(full ? new Error("This browser could not decode the video.") : new FullVideoRequiredError("Streaming decode failed. Full-file playback may be available."));
    element.addEventListener("loadeddata", loaded); element.addEventListener("error", decodeError);
    const timer = setInterval(() => {
      if (checking || !version || controller.signal.aborted) return;
      checking = true;
      void read(0, controller.signal).catch(fail).finally(() => { checking = false; });
    }, 30_000);
    void (async () => {
      if (!full) {
        const { streamVideo } = await import("../connected/src/videoStream");
        controller.signal.throwIfAborted();
        return streamVideo(element, upload.size, read, controller.signal);
      }
      await read(0, controller.signal);
      const blob = await fullVideo(actor, id, upload, mode, controller.signal);
      await read(0, controller.signal);
      try {
        const captions = await extractMp4Captions(blob, controller.signal);
        controller.signal.throwIfAborted();
        for (const [index, caption] of captions.entries()) {
          const track = document.createElement("track");
          track.kind = "subtitles"; track.label = `Captions ${index + 1}`; track.srclang = caption.language;
          track.src = URL.createObjectURL(new Blob([captionsVtt(caption)], { type: "text/vtt" }));
          tracks.push(track); urls.push(track.src); element.append(track);
        }
      } catch { if (!controller.signal.aborted) setCaptionError("Caption extraction unavailable. Original tracks remain in the download."); }
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(blob); urls.push(url); element.src = url;
    })().catch(fail);
    return () => {
      controller.abort(); clearInterval(timer);
      element.removeEventListener("loadeddata", loaded); element.removeEventListener("error", decodeError); clear();
    };
  }, [actor, id, upload, mode, full]);

  const download = async () => {
    const controller = lifetime.current;
    if (!controller || downloading) return;
    setDownloading(true);
    try {
      const blob = await fullVideo(actor, id, upload, mode, controller.signal);
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = upload.name;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Download failed."); }
    finally { if (!controller.signal.aborted) setDownloading(false); }
  };
  return <section className="player" aria-label="Protected local playback">
    <div className="player-heading"><h2>Playback</h2><span className="mono">{reads} range reads</span></div>
    <video ref={video} controls preload="metadata" aria-label={upload.name} />
    <div className="player-footer"><span role="status">{error ? "Access / playback failed" : fallback ? "Full file required" : ready ? "Ready" : full ? "Loading full video" : "Buffering"}</span>
      <button disabled={downloading || !!error} onClick={() => void download()} title="Download original video"><Icon name="download" />{downloading ? "Downloading" : "Download"}</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {fallback && !full && <div className="notice"><p>{fallback}</p><button onClick={() => { setFallback(""); setError(""); setReady(false); setFull(true); }}><Icon name="download" />Load full video</button></div>}
    {captionError && <p role="status" className="notice">{captionError}</p>}
  </section>;
}