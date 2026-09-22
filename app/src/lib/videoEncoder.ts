import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";
import classWorkerURL from "../../node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js?worker&url";
import type { CompressionProgress } from "./videoCompression";

type MediaProbe = { streams: { codec_type: string; codec_name: string; width?: number; height?: number; duration?: string }[]; format: { duration: string; filename: string }; error?: unknown };

export async function encodeVideo(file: File, signal: AbortSignal, progress: (value: CompressionProgress) => void): Promise<File> {
  signal.throwIfAborted();
  const encoder = new FFmpeg();
  const abort = () => encoder.terminate();
  signal.addEventListener("abort", abort, { once: true });
  const startupTimeout = setTimeout(abort, 60_000);
  let probeIndex = 0;
  const probe = async (path: string): Promise<MediaProbe> => {
    const output = `probe-${probeIndex++}.json`;
    const code = await encoder.ffprobe(["-v", "error", "-show_error", "-show_streams", "-show_format", "-of", "json", path, "-o", output], 30_000, { signal });
    if (code !== 0 && code !== -1) throw new Error("Video metadata could not be read.");
    const parsed = JSON.parse(await encoder.readFile(output, "utf8", { signal }) as string) as MediaProbe;
    if (parsed.error || parsed.format?.filename !== path || !Array.isArray(parsed.streams) || !Number.isFinite(Number(parsed.format?.duration))) throw new Error("Video duration is unavailable.");
    return parsed;
  };
  try {
    progress({ phase: "loading" });
    await encoder.load({ classWorkerURL, coreURL: new URL(coreURL, location.href).href, wasmURL: new URL(wasmURL, location.href).href }, { signal });
    clearTimeout(startupTimeout);
    signal.throwIfAborted();
    await encoder.createDir("/input", { signal });
    const name = /\.webm$/i.test(file.name) ? "source.webm" : "source.mp4";
    const mounted = await encoder.mount(FFFSType.WORKERFS, { files: [new File([file], name, { type: file.type })] }, "/input");
    if (!mounted) throw new Error("Local file access is unavailable.");
    const input = `/input/${name}`;
    const before = await probe(input);
    const videos = before.streams.filter(stream => stream.codec_type === "video");
    if (videos.length !== 1) throw new Error("Compression requires a single video track.");
    const duration = Number(before.format.duration);
    if (duration <= 0) throw new Error("Video duration is unavailable.");
    const audio = before.streams.filter(stream => stream.codec_type === "audio");
    const subtitles = before.streams.filter(stream => stream.codec_type === "subtitle");
    if (subtitles.some(stream => !["mov_text", "subrip", "webvtt", "ass", "ssa"].includes(stream.codec_name))) throw new Error("This subtitle format cannot be preserved.");
    encoder.on("progress", ({ time }) => progress({ phase: "encoding", percent: Math.max(0, Math.min(99, Math.round(time / 1_000_000 / duration * 100))) }));
    progress({ phase: "encoding", percent: 0 });
    const code = await encoder.exec(["-i", input, "-map", "0:v:0", "-map", "0:a?", "-map", "0:s?",
      "-c:v", "libx264", "-preset", "fast", "-crf", "26", "-threads", "1", "-pix_fmt", "yuv420p",
      "-c:a", audio.every(stream => stream.codec_name === "aac") ? "copy" : "aac", "-c:s", subtitles.every(stream => stream.codec_name === "mov_text") ? "copy" : "mov_text",
      "-movflags", "+faststart", "output.mp4"], 30 * 60_000, { signal });
    if (code !== 0) throw new Error("Video compression failed.");
    progress({ phase: "checking" });
    const after = await probe("output.mp4");
    const outputVideo = after.streams.find(stream => stream.codec_type === "video");
    if (outputVideo?.width !== videos[0].width || outputVideo?.height !== videos[0].height
      || Math.abs(Number(after.format.duration) - duration) > 0.25
      || after.streams.filter(stream => stream.codec_type === "audio").length !== audio.length
      || after.streams.filter(stream => stream.codec_type === "subtitle").length !== subtitles.length) throw new Error("Compressed video did not preserve its tracks or duration.");
    const bytes = await encoder.readFile("output.mp4", "binary", { signal });
    if (!(bytes instanceof Uint8Array)) throw new Error("Compressed file is unavailable.");
    signal.throwIfAborted();
    return new File([bytes as Uint8Array<ArrayBuffer>], file.name.replace(/\.(mp4|webm)$/i, ".mp4"), { type: "video/mp4", lastModified: file.lastModified });
  } finally {
    clearTimeout(startupTimeout);
    signal.removeEventListener("abort", abort);
    encoder.terminate();
  }
}