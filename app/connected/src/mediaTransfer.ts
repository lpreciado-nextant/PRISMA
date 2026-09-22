import { createSHA256 } from "hash-wasm";
import { mediaRequest, uploadMedia, type MediaApi, type MediaState } from "./media.ts";

export type PlaybackMode = "submission" | "published" | "present";
export type TransferApi = {
  begin: (id: string, version: string, name: string, size: number, sha256: string) => Promise<unknown>;
  checkpoint: (id: string, version: string, session: string, name: string, size: number, sha256: string) => Promise<unknown>;
  range: (id: string, assetId: string, mode: PlaybackMode, offset: number, count: number, version?: string) => Promise<unknown>;
};
export async function fileDigest(file: File, signal: AbortSignal, progress: (percent: number) => void): Promise<string> {
  const hash = await createSHA256(); hash.init();
  for (let offset = 0; offset < file.size; offset += 4 * 1024 * 1024) {
    signal.throwIfAborted();
    hash.update(new Uint8Array(await file.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer()));
    signal.throwIfAborted(); progress(Math.min(100, Math.round((offset + 4 * 1024 * 1024) / file.size * 100)));
  }
  signal.throwIfAborted(); return hash.digest();
}

export async function transferVideo(api: MediaApi, transfer: TransferApi, initial: MediaState, file: File, signal: AbortSignal,
  progress: (state: MediaState) => void, hashing: (percent: number | null) => void, session?: string, onWrite: () => void = () => {}): Promise<MediaState> {
  if (!/\.(mp4|webm)$/i.test(file.name) || !file.size || file.size > 500 * 1024 * 1024) throw new Error("Choose the exact supported video file.");
  const sha256 = await fileDigest(file, signal, hashing);
  hashing(null);
  const tracked: MediaApi = { ...api,
    block: (...args) => { onWrite(); return api.block(...args); },
    finish: (...args) => { onWrite(); return api.finish(...args); },
  };
  if (!session) return uploadMedia({ ...tracked, begin: (id, version, _kind, name, size) => { onWrite(); return transfer.begin(id, version, name, size, sha256); } },
    { ...initial, uploadProtocol: 2, maxBlockSize: 4194304 }, file, "attachment", signal, progress);
  const checkpoint = await mediaRequest(transfer.checkpoint(initial.id, initial.rowVersion, session, file.name, file.size, sha256), signal);
  if (checkpoint.sessionId !== session) throw new Error("Mismatched resume session.");
  return uploadMedia(tracked, initial, file, "attachment", signal, progress, checkpoint);
}

export async function readVideoRange(api: TransferApi, id: string, assetId: string, mode: PlaybackMode, offset: number, size: number,
  signal: AbortSignal, version?: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; version: string }> {
  signal.throwIfAborted();
  const count = Math.min(1024 * 1024, size - offset);
  if (!Number.isSafeInteger(offset) || offset < 0 || count <= 0) throw new Error("Invalid video range.");
  let cancel = () => {};
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(60_000)]);
  let raw: unknown;
  try {
    const aborted = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(deadline.reason);
      deadline.addEventListener("abort", cancel, { once: true });
      if (deadline.aborted) cancel();
    });
    raw = await Promise.race([api.range(id, assetId, mode, offset, count, version), aborted]);
    deadline.throwIfAborted();
  } finally { deadline.removeEventListener("abort", cancel); }
  const response = raw as { success?: boolean; data?: { ResultJson?: string } };
  signal.throwIfAborted();
  if (!response?.success || typeof response.data?.ResultJson !== "string") throw new Error("Video access unavailable.");
  const result = JSON.parse(response.data.ResultJson);
  if (result.id !== id || result.assetId !== assetId || result.offset !== offset || result.size !== size || result.mime !== "video/mp4"
    || typeof result.version !== "string" || !/^\d+:\d+:[a-f0-9]{32}$/.test(result.version) || (version && version !== result.version)
    || typeof result.content !== "string" || result.content.length > Math.ceil(count / 3) * 4) throw new Error("Unconfirmed video range.");
  const binary = atob(result.content);
  if (binary.length !== count) throw new Error("Incomplete video range.");
  return { bytes: Uint8Array.from(binary, value => value.charCodeAt(0)), version: result.version };
}