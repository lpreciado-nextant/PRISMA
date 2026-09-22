import { createFile, type MP4BoxBuffer } from "mp4box";

export type CaptionTrack = { language: string; cues: { start: number; end: number; text: string }[] };

export function decodeCaption(data: Uint8Array, start: number, duration: number, timescale: number) {
  if (data.length < 2 || !Number.isFinite(start) || !Number.isFinite(duration) || timescale <= 0 || duration <= 0) return null;
  const length = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(0);
  if (!length) return null;
  if (length > data.length - 2) throw new Error("Invalid caption length.");
  const textBytes = data.subarray(2, length + 2);
  const encoding = textBytes[0] === 0xfe && textBytes[1] === 0xff ? "utf-16be" : textBytes[0] === 0xff && textBytes[1] === 0xfe ? "utf-16le" : "utf-8";
  return { start: Math.max(0, start / timescale), end: Math.max(0, (start + duration) / timescale), text: new TextDecoder(encoding, { fatal: true }).decode(textBytes) };
}

export function captionsVtt(track: CaptionTrack): string {
  const timestamp = (seconds: number) => {
    const total = Math.round(seconds * 1000);
    return `${String(Math.floor(total / 3600000)).padStart(2, "0")}:${String(Math.floor(total / 60000) % 60).padStart(2, "0")}:${String(Math.floor(total / 1000) % 60).padStart(2, "0")}.${String(total % 1000).padStart(3, "0")}`;
  };
  return "WEBVTT\n\n" + track.cues.map((cue, index) => `${index + 1}\n${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll(/\r?\n\s*\r?\n/g, "\n")}\n`).join("\n");
}

export async function extractMp4Captions(blob: Blob, signal: AbortSignal): Promise<CaptionTrack[]> {
  const parser = createFile();
  const tracks = new Map<number, CaptionTrack>();
  let failure: Error | null = null;
  let ready = false;
  let textSize = 0;
  parser.onError = () => { failure = new Error("Caption metadata is invalid."); };
  parser.onReady = info => {
    ready = true;
    const captions = info.tracks.filter(track => track.type !== "video" && track.type !== "audio");
    if (captions.length > 8 || captions.some(track => track.codec !== "tx3g")) { failure = new Error("This caption format is not supported in the browser."); return; }
    for (const track of captions) { tracks.set(track.id, { language: track.language || "und", cues: [] }); parser.setExtractionOptions(track.id, null, { nbSamples: 100 }); }
    parser.start();
  };
  parser.onSamples = (id, _user, samples) => {
    try {
      const track = tracks.get(id)!;
      for (const sample of samples) {
        if (!sample.data) throw new Error("Caption bytes unavailable.");
        const cue = decodeCaption(sample.data, sample.cts, sample.duration, sample.timescale);
        if (cue) { textSize += cue.text.length; if (textSize > 2 * 1024 * 1024 || track.cues.length >= 10000) throw new Error("Caption limit exceeded."); track.cues.push(cue); }
        parser.releaseUsedSamples(id, sample.number + 1);
      }
    } catch (error) { failure = error instanceof Error ? error : new Error("Caption extraction failed."); }
  };
  try {
    for (let offset = 0; offset < blob.size;) {
      signal.throwIfAborted();
      const data = await blob.slice(offset, offset + 1048576).arrayBuffer() as MP4BoxBuffer;
      signal.throwIfAborted(); data.fileStart = offset;
      const next = parser.appendBuffer(data);
      if (failure) throw failure;
      if (ready && !tracks.size) break;
      offset = next && next > offset ? next : offset + data.byteLength;
    }
    parser.flush();
    if (failure) throw failure;
    return [...tracks.values()].filter(track => track.cues.length);
  } finally { parser.stop(); }
}