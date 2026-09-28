import type { LinkedAssetInput } from "./linkedAssets.ts";

export type MediaProvider = "dataverse" | "local-blob";
export type MediaReadMode = "submission" | "published" | "present";
export type MediaErrorCode = "invalid-request" | "invalid-response" | "denied" | "not-found" | "conflict" | "aborted" | "unavailable" | "unsupported";
export type ContractMedia = {
  id: string; sessionId: string; kind: "image" | "attachment" | "thumbnail"; name: string; mime: string;
  size: number; received: number; nextBlock: number; complete: boolean;
  readiness: "uploading" | "quarantined" | "ready" | "rejected";
  integrity: "unreported" | "sha256";
  scanning: "unreported" | "simulated-pending" | "simulated-passed" | "simulated-rejected" | "simulated-error";
  sha256?: string; caption?: string; sortOrder?: number; linkedAsset?: LinkedAssetInput;
};
export type MediaSnapshot = {
  provider: MediaProvider; id: string; version: string; sessionId: string | null; blockSize: number; media: ContractMedia[];
};
export type MediaWrite = { id: string; version: string };
export type VideoFile = { name: string; size: number; sha256: string };
export type AttachmentFile = VideoFile;
export type MediaRange = { id: string; assetId: string; mode: MediaReadMode; offset: number; size: number; version?: string };
export type MediaRangeResult = { bytes: Uint8Array<ArrayBuffer>; version: string };
export interface VideoMediaAdapter {
  readonly provider: MediaProvider;
  read(id: string, signal: AbortSignal): Promise<MediaSnapshot>;
  begin(write: MediaWrite, file: VideoFile, signal: AbortSignal): Promise<MediaSnapshot>;
  checkpoint(write: MediaWrite, session: string, file: VideoFile, signal: AbortSignal): Promise<MediaSnapshot>;
  block(state: MediaSnapshot, session: string, index: number, bytes: Uint8Array, signal: AbortSignal): Promise<MediaSnapshot>;
  finish(write: MediaWrite, session: string, signal: AbortSignal): Promise<MediaSnapshot>;
  remove(write: MediaWrite, session: string, signal: AbortSignal): Promise<MediaSnapshot>;
  range(input: MediaRange, signal: AbortSignal): Promise<MediaRangeResult>;
}

export type AttachmentMediaAdapter = VideoMediaAdapter;

export function attachmentType(name: string, code: MediaErrorCode = "invalid-request") {
  requireMedia(typeof name === "string" && name.length <= 180 && name.trim() === name && !/[\\/]/.test(name)
    && [...name].every(character => character.charCodeAt(0) >= 32), "Invalid attachment filename.", code);
  const types: Record<string, string> = { mp4: "video/mp4", html: "text/html", htm: "text/html", pdf: "application/pdf",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  const extension = name.split(".").at(-1)!.toLowerCase();
  requireMedia(name.includes(".") && Object.hasOwn(types, extension), "Choose MP4, HTML, PDF, PPT or PPTX.", code);
  return { mime: types[extension], minSize: extension === "mp4" ? 12 : 1, maxSize: (extension === "mp4" ? 500 : 25) * 1024 * 1024 };
}

export function validateAttachmentFile(file: AttachmentFile, code: MediaErrorCode = "invalid-request") {
  const type = attachmentType(file.name, code);
  requireMedia(Number.isSafeInteger(file.size) && file.size >= type.minSize && file.size <= type.maxSize
    && typeof file.sha256 === "string" && file.sha256.length === 64 && /^[a-f0-9]{64}$/.test(file.sha256), "Invalid attachment size or digest.", code);
  return type;
}

export class MediaContractError extends Error {
  code: MediaErrorCode;
  recovery: "none" | "reopen";
  constructor(code: MediaErrorCode, message: string, recovery: "none" | "reopen" = "none", cause?: unknown) {
    super(message, { cause }); this.name = "MediaContractError"; this.code = code; this.recovery = recovery;
  }
}

export function mediaProvider(value: unknown): MediaProvider {
  if (value !== "dataverse" && value !== "local-blob") throw new MediaContractError("unsupported", "Unsupported media provider.");
  return value;
}

export function requireMedia(condition: unknown, message: string, code: MediaErrorCode = "invalid-response"): asserts condition {
  if (!condition) throw new MediaContractError(code, message);
}

export function validateVideoFile(file: VideoFile) {
  requireMedia(typeof file.name === "string" && file.name.length <= 180 && /^[^\\/]+\.mp4$/i.test(file.name)
    && [...file.name].every(character => character.charCodeAt(0) >= 32)
    && Number.isSafeInteger(file.size) && file.size >= 12 && file.size <= 500 * 1024 * 1024
    && typeof file.sha256 === "string" && /^[a-f0-9]{64}$/.test(file.sha256), "Invalid MP4 identity, size or digest.", "invalid-request");
}

export function validateMediaIdentity(id: string, version?: string) {
  requireMedia(typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
    && (version === undefined || (typeof version === "string" && version.length > 0 && version.length <= 256)), "Invalid media identity or version.", "invalid-request");
}

export function rangeCount(input: MediaRange) {
  validateMediaIdentity(input.id); validateMediaIdentity(input.assetId);
  requireMedia(["submission", "published", "present"].includes(input.mode) && Number.isSafeInteger(input.size) && input.size > 0
    && Number.isSafeInteger(input.offset) && input.offset >= 0 && input.offset < input.size
    && (input.version === undefined || (typeof input.version === "string" && input.version.length > 0)), "Invalid bounded media range.", "invalid-request");
  return Math.min(1024 * 1024, input.size - input.offset);
}

export function validateBlock(provider: MediaProvider, state: MediaSnapshot, session: string, index: number, bytes: Uint8Array) {
  requireMedia(state.provider === provider, "Reopen using the asset's original provider.", "unsupported");
  const item = state.media.find(media => media.sessionId === session);
  requireMedia(item && item.kind === "attachment" && item.mime === (provider === "dataverse" ? "video/mp4" : attachmentType(item.name).mime)
    && !item.complete && item.readiness === "uploading" && state.sessionId === session
    && Number.isSafeInteger(index) && index === item.nextBlock && [524288, 2097152, 4194304].includes(state.blockSize)
    && bytes instanceof Uint8Array && bytes.length > 0 && bytes.length === Math.min(state.blockSize, item.size - item.received),
  "Invalid upload checkpoint or block.", "invalid-request");
  return item;
}

export async function mediaOperation<Result>(signal: AbortSignal, write: boolean, operation: () => Promise<Result>): Promise<Result> {
  let dispatched = false;
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(60_000)]);
  let abort = () => {};
  try {
    deadline.throwIfAborted();
    const interrupted = new Promise<never>((_resolve, reject) => {
      abort = () => reject(deadline.reason);
      deadline.addEventListener("abort", abort, { once: true });
    });
    dispatched = true;
    const result = await Promise.race([operation(), interrupted]);
    deadline.throwIfAborted();
    return result;
  } catch (error) {
    const recovery = write && dispatched ? "reopen" : "none";
    if (deadline.aborted) throw new MediaContractError(signal.aborted ? "aborted" : "unavailable", "Media operation interrupted.", recovery, error);
    if (error instanceof MediaContractError) throw new MediaContractError(error.code, error.message, recovery, error);
    if (error instanceof SyntaxError) throw new MediaContractError("invalid-response", "Malformed media response.", recovery, error);
    const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
    const code = status === 401 || status === 403 ? "denied" : status === 404 ? "not-found" : status === 409 || status === 412 ? "conflict" : "unavailable";
    throw new MediaContractError(code, "Media operation failed. Reopen before retrying a write.", recovery, error);
  } finally { deadline.removeEventListener("abort", abort); }
}