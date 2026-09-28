import { fileDigest } from "../connected/src/mediaTransfer.ts";
import { createLocalMediaAdapter, localMediaSnapshot } from "./adapter.ts";
import { attachmentType, validateAttachmentFile } from "../src/lib/mediaContract.ts";

export type Actor = "builder" | "other-builder" | "reader" | "librarian";
export type Mode = "submission" | "published" | "present";
export type Upload = {
  id: string; assetId: string; name: string; mime?: string; size: number; sha256: string;
  received: number; nextBlock: number; blockSize: number; expires: number; complete: boolean; verification: string;
  released: boolean;
  scan: { engine: "simulated"; status: "pending" | "passed" | "rejected" | "error"; attempts: number;
    failure: "unavailable" | "timeout" | "interrupted" | null;
    job: { state: "queued" | "running"; attempts: number; maxAttempts: number; availableAt: number; leaseUntil: number } | null;
  } | null;
};
export type Snapshot = { id: string; owner: Actor; version: string; status: "draft" | "review" | "published"; safe: boolean; upload: Upload | null };

export class LocalApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

async function request(actor: Actor, action: string, input: Record<string, unknown>, signal?: AbortSignal, bytes?: Blob): Promise<Response> {
  if (window.location.hostname !== "127.0.0.1" || window.location.protocol !== "http:") throw new Error("Local media is restricted to loopback HTTP.");
  const response = await fetch(`./api/local-media/${action}`, {
    method: "POST", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
    credentials: "omit", cache: "no-store",
    headers: {
      "Content-Type": bytes ? "application/octet-stream" : "application/json", "X-Prisma-Local": "1", "X-Local-Actor": actor,
      ...(bytes ? { "X-Local-Command": JSON.stringify(input) } : {}),
    },
    body: bytes ?? JSON.stringify(input),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new LocalApiError(typeof result?.error === "string" ? result.error : "Local media request failed.", response.status);
  }
  return response;
}

export async function command<Result = Snapshot>(actor: Actor, action: string, input: Record<string, unknown> = {}, signal?: AbortSignal): Promise<Result> {
  return (await request(actor, action, input, signal)).json() as Promise<Result>;
}

export function localAttachmentAdapter(actor: Actor) {
  return createLocalMediaAdapter({
    command: async (action, input, signal) => (await request(actor, action, input, signal)).json(),
    block: async (input, bytes, signal) => (await request(actor, "block", input, signal, new Blob([new Uint8Array(bytes)]))).json(),
    range: (input, signal) => request(actor, "range", input, signal),
  });
}

export const localVideoAdapter = localAttachmentAdapter;

export async function uploadAttachment(actor: Actor, initial: Snapshot, file: File, signal: AbortSignal, update: (state: Snapshot) => void, phase: (message: string) => void): Promise<Snapshot> {
  const type = attachmentType(file.name);
  if (file.size < type.minSize || file.size > type.maxSize) throw new Error("Choose a document/HTML up to 25 MiB or MP4 up to 500 MiB.");
  const sha256 = await fileDigest(file, signal, percent => phase(`Hashing ${percent}%`));
  const metadata = { name: file.name, size: file.size, sha256 };
  validateAttachmentFile(metadata);
  let state = await command(actor, initial.upload ? "checkpoint" : "begin", {
    id: initial.id, version: initial.version, session: initial.upload?.id, ...metadata,
  }, signal);
  localMediaSnapshot(state);
  update(state);
  const upload = state.upload;
  if (!upload || upload.complete || upload.name !== file.name || upload.size !== file.size || upload.sha256 !== sha256 || upload.blockSize !== 4194304
    || upload.received !== Math.min(upload.nextBlock * upload.blockSize, file.size)) throw new Error("Invalid upload checkpoint.");
  for (let offset = upload.received, index = upload.nextBlock; offset < file.size; offset += upload.blockSize, index++) {
    signal.throwIfAborted(); phase("Uploading");
    const response = await request(actor, "block", { id: state.id, version: state.version, session: upload.id, index }, signal, file.slice(offset, offset + upload.blockSize));
    const next: Snapshot = await response.json();
    localMediaSnapshot(next);
    if (next.id !== state.id || next.version === state.version || next.upload?.id !== upload.id || next.upload.received !== Math.min(offset + upload.blockSize, file.size)
      || next.upload.nextBlock !== index + 1) throw new Error("Unconfirmed upload block. Reopen before continuing.");
    state = next; update(state);
  }
  phase("Verifying SHA-256");
  state = await command(actor, "finish", { id: state.id, version: state.version, session: upload.id }, signal);
  localMediaSnapshot(state);
  if (!state.upload?.complete) throw new Error("Finalization was not confirmed. Reopen before continuing.");
  update(state); return state;
}

export const uploadVideo = uploadAttachment;

export async function readRange(actor: Actor, id: string, upload: Upload, mode: Mode, offset: number, signal: AbortSignal, version?: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; version: string }> {
  return localAttachmentAdapter(actor).range({ id, assetId: upload.assetId, mode, offset, size: upload.size, version }, signal);
}

export async function fullAttachment(actor: Actor, id: string, upload: Upload, mode: Mode, signal: AbortSignal): Promise<Blob> {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let version: string | undefined;
  for (let offset = 0; offset < upload.size; offset += 1024 * 1024) {
    const result = await readRange(actor, id, upload, mode, offset, signal, version);
    chunks.push(result.bytes); version = result.version;
  }
  await readRange(actor, id, upload, mode, 0, signal, version);
  return new Blob(chunks, { type: attachmentType(upload.name).mime });
}

export const fullVideo = fullAttachment;