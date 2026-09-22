export const VIDEO_COMPRESSION_THRESHOLD = 200 * 1024 * 1024;
export const VIDEO_SIZE_LIMIT = 500 * 1024 * 1024;
export type CompressionProgress = { phase: "loading" | "encoding" | "checking"; percent?: number };
export type VideoEncoder = (file: File, signal: AbortSignal, progress: (value: CompressionProgress) => void) => Promise<File>;
export type CompressionResult = { file: File; outcome: "unchanged" | "compressed" | "not-smaller"; originalBytes: number };

export function shouldCompressVideo(file: Pick<File, "name" | "size">): boolean {
  return /\.(mp4|webm)$/i.test(file.name) && file.size >= VIDEO_COMPRESSION_THRESHOLD && file.size <= VIDEO_SIZE_LIMIT;
}

export async function prepareVideo(file: File, signal: AbortSignal, progress: (value: CompressionProgress) => void,
  encode: VideoEncoder = async (...args) => (await import("./videoEncoder")).encodeVideo(...args)): Promise<CompressionResult> {
  signal.throwIfAborted();
  if (!shouldCompressVideo(file)) return { file, outcome: "unchanged", originalBytes: file.size };
  const candidate = await encode(file, signal, progress);
  signal.throwIfAborted();
  if (!candidate.size || candidate.type !== "video/mp4" || !/\.mp4$/i.test(candidate.name)) throw new Error("Compression did not produce a valid MP4.");
  return candidate.size < file.size
    ? { file: candidate, outcome: "compressed", originalBytes: file.size }
    : { file, outcome: "not-smaller", originalBytes: file.size };
}