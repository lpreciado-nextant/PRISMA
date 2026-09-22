import { createFile, type MP4BoxBuffer } from "mp4box";

export type VideoRead = (offset: number, signal: AbortSignal) => Promise<Uint8Array<ArrayBuffer>>;
export function bufferedAhead(ranges: { start: (index: number) => number; end: (index: number) => number; length: number }, time: number): number {
  const current = Array.from({ length: ranges.length }, (_, index) => [ranges.start(index), ranges.end(index)])
    .find(([start, end]) => time + 0.1 >= start && time < end);
  return current ? current[1] - time : 0;
}
export async function streamVideo(video: HTMLVideoElement, size: number, read: VideoRead, signal: AbortSignal): Promise<void> {
  if (!globalThis.MediaSource) throw new Error("Progressive playback is unsupported.");
  const source = new MediaSource();
  const url = URL.createObjectURL(source);
  const parser = createFile();
  const buffers = new Map<number, SourceBuffer>();
  let queue = Promise.resolve();
  let queuedBytes = 0;
  let failure: Error | null = null;
  let ready = false;
  let offset = 0;
  let seekTo: number | null = null;
  let parsedBytes = 0;
  const wait = (target: EventTarget, event: string) => new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("Video operation failed.")); };
    const aborted = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(failed, 60_000);
    const cleanup = () => { clearTimeout(timer); target.removeEventListener(event, done); target.removeEventListener("error", failed); signal.removeEventListener("abort", aborted); };
    target.addEventListener(event, done, { once: true }); target.addEventListener("error", failed, { once: true }); signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
  const enqueue = (buffer: SourceBuffer, bytes: ArrayBuffer, track?: number, sample?: number) => {
    queuedBytes += bytes.byteLength;
    if (queuedBytes > 32 * 1024 * 1024) { failure = new Error("Video segment exceeds the playback buffer limit."); return; }
    queue = queue.then(async () => {
      signal.throwIfAborted();
      if (failure) throw failure;
      if (video.currentTime > 60 && buffer.buffered.length && buffer.buffered.start(0) < video.currentTime - 60) {
        const removed = wait(buffer, "updateend"); buffer.remove(0, video.currentTime - 60); await removed;
      }
      const appended = wait(buffer, "updateend"); buffer.appendBuffer(bytes); await appended;
      queuedBytes -= bytes.byteLength;
      if (track !== undefined && sample !== undefined) parser.releaseUsedSamples(track, sample);
    }).catch(error => { failure = error instanceof Error ? error : new Error("Video append failed."); });
  };
  const seek = () => {
    const time = video.currentTime;
    const buffered = Array.from({ length: video.buffered.length }, (_, index) => [video.buffered.start(index), video.buffered.end(index)]);
    if (!buffered.some(([start, end]) => time >= start && time < end - 0.2)) seekTo = time;
  };
  const mediaError = () => { failure = new Error("This browser could not decode the video and audio tracks."); };
  video.addEventListener("seeking", seek); video.addEventListener("error", mediaError);
  parser.onError = () => { failure = new Error("Unsupported or invalid MP4."); };
  parser.onReady = info => {
    try {
      if (info.tracks.some(track => track.type !== "video" && track.type !== "audio")) throw new Error("This MP4 has additional tracks; use full-file playback to preserve them.");
      if (info.isFragmented) throw new Error("Fragmented MP4 requires full-file playback.");
      if (info.videoTracks.length !== 1 || !info.timescale || !Number.isFinite(info.duration / info.timescale)) throw new Error("Unsupported MP4 tracks.");
      for (const track of info.tracks) {
        const mime = `${track.type === "audio" ? "audio" : "video"}/mp4; codecs="${track.codec}"`;
        if (!MediaSource.isTypeSupported(mime)) throw new Error("A video or audio codec is unsupported.");
        const buffer = source.addSourceBuffer(mime); buffers.set(track.id, buffer);
        parser.setSegmentOptions(track.id, null, { nbSamples: 30, rapAlignement: true });
      }
      source.duration = info.duration / info.timescale;
      for (const init of parser.initializeSegmentation("per-track")) enqueue(buffers.get(init.id)!, init.buffer);
      ready = true; parser.start();
    } catch (error) { failure = error instanceof Error ? error : new Error("MP4 setup failed."); }
  };
  parser.onSegment = (id, _user, bytes, nextSample) => { const buffer = buffers.get(id); if (buffer) enqueue(buffer, bytes, id, nextSample); };
  try {
    signal.throwIfAborted();
    const opened = wait(source, "sourceopen"); video.src = url; await opened;
    while (!signal.aborted) {
      if (failure) throw failure;
      await queue;
      if (failure) throw failure;
      if (seekTo !== null && ready) { parser.stop(); offset = parser.seek(seekTo, true).offset; seekTo = null; parser.start(); }
      const ahead = bufferedAhead(video.buffered, video.currentTime);
      if (offset >= size || (ready && ahead > 30)) {
        if (offset >= size && source.readyState === "open") { parser.flush(); await queue; if (failure) throw failure; source.endOfStream(); }
        await new Promise<void>((resolve, reject) => {
          const done = () => { cleanup(); resolve(); };
          const aborted = () => { cleanup(); reject(signal.reason); };
          const timer = setTimeout(done, 1000);
          const cleanup = () => { clearTimeout(timer); video.removeEventListener("timeupdate", done); video.removeEventListener("seeking", done); signal.removeEventListener("abort", aborted); };
          video.addEventListener("timeupdate", done, { once: true }); video.addEventListener("seeking", done, { once: true }); signal.addEventListener("abort", aborted, { once: true });
          if (signal.aborted) aborted();
        });
        continue;
      }
      const bytes = await read(offset, signal);
      signal.throwIfAborted();
      if (!bytes.length || bytes.length > 1024 * 1024 || offset + bytes.length > size) throw new Error("Invalid video chunk.");
      const data = bytes.buffer as MP4BoxBuffer; data.fileStart = offset;
      const next = parser.appendBuffer(data);
      if (!ready) { parsedBytes += bytes.length; if (parsedBytes > 16 * 1024 * 1024) throw new Error("MP4 metadata exceeds the streaming limit."); }
      offset = next ?? offset + bytes.length;
    }
  } finally {
    parser.stop();
    video.removeEventListener("seeking", seek); video.removeEventListener("error", mediaError);
    video.pause(); video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url);
  }
}