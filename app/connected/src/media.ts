import { validateLinkedAsset, type LinkedAssetInput } from "../../src/lib/linkedAssets.ts";

export async function imageDataUrl(blob: Blob, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  if (!["image/png", "image/jpeg"].includes(blob.type) || blob.size > 20 * 1024 * 1024) throw new Error("Unsupported image preview.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  signal?.throwIfAborted();
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 32768) parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
  return `data:${blob.type};base64,${btoa(parts.join(""))}`;
}

export type MediaKind = "image" | "attachment" | "thumbnail";
export type MediaItem = { id: string; sessionId: string; kind: MediaKind; name: string; mime: string; size: number; received: number; nextBlock: number; complete: boolean; caption?: string; sortOrder?: number; linkedAsset?: LinkedAssetInput };
export type MediaState = { id: string; rowVersion: string; sessionId: string | null; blockSize: number; media: MediaItem[]; uploadProtocol?: 2; maxBlockSize?: 4194304 };
export type MediaApi = {
  read: (id: string) => Promise<unknown>;
  begin: (id: string, version: string, kind: MediaKind | `${MediaKind}:v2` | `${MediaKind}:v3`, name: string, size: number) => Promise<unknown>;
  block: (id: string, version: string, session: string, index: number, content: string) => Promise<unknown>;
  finish: (id: string, version: string, session: string) => Promise<unknown>;
  remove: (id: string, version: string, session: string) => Promise<unknown>;
  metadata: (id: string, version: string, json: string) => Promise<unknown>;
};
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid media response."); return value as Record<string, unknown>; };
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export function parseMedia(response: unknown): MediaState {
  const result = object(response);
  const data = object(result.data);
  if (result.success !== true || typeof data.ResultJson !== "string") throw new Error("Media request failed.");
  const state = object(JSON.parse(data.ResultJson));
  if (typeof state.id !== "string" || !guid.test(state.id) || typeof state.rowVersion !== "string" || !/^\d+$/.test(state.rowVersion)) throw new Error("Invalid media identity/version.");
  if (state.sessionId !== null && (typeof state.sessionId !== "string" || !guid.test(state.sessionId))) throw new Error("Invalid upload session.");
  if (![524288, 2097152, 4194304].includes(state.blockSize as number) || (state.uploadProtocol !== undefined && state.uploadProtocol !== 2)
    || (state.maxBlockSize !== undefined && (state.maxBlockSize !== 4194304 || state.uploadProtocol !== 2)) || !Array.isArray(state.media) || state.media.length > 13) throw new Error("Invalid media limits.");
  const media = state.media.map(value => {
    const item = object(value);
    if (typeof item.id !== "string" || !guid.test(item.id) || typeof item.sessionId !== "string" || !guid.test(item.sessionId)
      || (item.kind !== "image" && item.kind !== "attachment" && item.kind !== "thumbnail") || typeof item.name !== "string" || typeof item.mime !== "string"
      || !integer(item.size) || !integer(item.received) || item.received > item.size || !integer(item.nextBlock) || typeof item.complete !== "boolean") throw new Error("Invalid media record.");
    if ((item.caption !== undefined && (typeof item.caption !== "string" || item.caption.length > 200)) || (item.sortOrder !== undefined && (!integer(item.sortOrder) || item.sortOrder > 12))) throw new Error("Invalid media metadata.");
    if (item.mime === "application/vnd.prisma.link" || item.linkedAsset !== undefined) {
      const linked = object(item.linkedAsset);
      if (item.mime !== "application/vnd.prisma.link" || item.kind !== "attachment" || !item.complete || item.size !== 0 || item.received !== 0 || item.nextBlock !== 0
        || typeof linked.name !== "string" || typeof linked.assetType !== "string" || typeof linked.externalUrl !== "string" || typeof linked.embedHint !== "string" || typeof linked.allowsEmbedding !== "boolean") throw new Error("Invalid linked asset record.");
      const validated = validateLinkedAsset(linked as LinkedAssetInput);
      if (validated.name !== item.name) throw new Error("Mismatched linked asset name.");
      return { ...item, linkedAsset: validated } as MediaItem;
    }
    return item as MediaItem;
  });
  if (new Set(media.map(item => item.id)).size !== media.length) throw new Error("Duplicate media record.");
  return { id: state.id, rowVersion: state.rowVersion, sessionId: state.sessionId, blockSize: state.blockSize as number, media, ...(state.uploadProtocol === 2 ? { uploadProtocol: 2 as const } : {}), ...(state.maxBlockSize === 4194304 ? { maxBlockSize: 4194304 as const } : {}) };
}

export function parseUploadProgress(response: unknown, previous: MediaState): MediaState {
  const result = object(response);
  const data = object(result.data);
  if (result.success !== true || typeof data.ResultJson !== "string") throw new Error("Media request failed.");
  const value = object(JSON.parse(data.ResultJson));
  if (value.uploadProgress !== true) return parseMedia(response);
  if (previous.uploadProtocol !== 2 || value.id !== previous.id || value.sessionId !== previous.sessionId || value.blockSize !== previous.blockSize
    || typeof value.rowVersion !== "string" || !/^\d+$/.test(value.rowVersion) || value.rowVersion === previous.rowVersion
    || !integer(value.received) || !integer(value.nextBlock)) throw new Error("Unconfirmed upload progress.");
  const current = previous.media.find(item => item.sessionId === previous.sessionId);
  if (!current || current.complete || value.nextBlock !== current.nextBlock + 1 || value.received !== Math.min(current.received + previous.blockSize, current.size)) throw new Error("Out-of-order upload progress.");
  return { ...previous, rowVersion: value.rowVersion, media: previous.media.map(item => item.id === current.id ? { ...item, received: value.received as number, nextBlock: value.nextBlock as number } : item) };
}

export async function mediaRequest(operation: Promise<unknown>, signal: AbortSignal, parse: (response: unknown) => MediaState = parseMedia): Promise<MediaState> {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(60_000)]);
  deadline.throwIfAborted();
  let abort: () => void = () => {};
  try {
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => reject(deadline.reason);
      deadline.addEventListener("abort", abort, { once: true });
    });
    const result = await Promise.race([operation, cancelled]);
    deadline.throwIfAborted();
    return parse(result);
  } finally { deadline.removeEventListener("abort", abort); }
}

export function hasCaptionChanges(media: MediaItem[], captions: Record<string, string>): boolean {
  return media.some(item => item.kind === "image" && item.complete && captions[item.id] !== undefined && captions[item.id] !== (item.caption ?? ""));
}

export async function saveMediaOrder(api: Pick<MediaApi, "metadata">, saved: { id: string; rowVersion: string }, media: MediaItem[], orderedIds: string[], signal: AbortSignal): Promise<MediaState> {
  signal.throwIfAborted();
  if (media.some(item => !item.complete) || orderedIds.length !== media.length || new Set(orderedIds).size !== media.length || orderedIds.some(id => !media.some(item => item.id === id))) throw new Error("Reordering requires all saved media exactly once.");
  const metadata = orderedIds.map((id, sortOrder) => ({ id, caption: media.find(item => item.id === id)!.caption ?? "", sortOrder }));
  const next = await mediaRequest(api.metadata(saved.id, saved.rowVersion, JSON.stringify(metadata)), signal);
  if (next.id !== saved.id || next.rowVersion === saved.rowVersion || next.media.length !== media.length || metadata.some(expected => !next.media.some(item => item.id === expected.id && item.complete && item.sortOrder === expected.sortOrder && (item.caption ?? "") === expected.caption))) throw new Error("Media order was not confirmed. Reopen before retrying.");
  return { ...next, media: [...next.media].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)) };
}

export async function saveMediaCaptions(api: Pick<MediaApi, "metadata">, saved: { id: string; rowVersion: string }, media: MediaItem[], captions: Record<string, string>, signal: AbortSignal): Promise<MediaState | null> {
  signal.throwIfAborted();
  for (const [id, caption] of Object.entries(captions)) {
    if (caption.length > 200 || !media.some(item => item.id === id && item.kind === "image" && item.complete)) throw new Error("Caption does not match a saved screenshot.");
  }
  if (!hasCaptionChanges(media, captions)) return null;
  const metadata = media.filter(item => item.complete).map((item, index) => ({ id: item.id, caption: item.kind === "image" ? captions[item.id] ?? item.caption ?? "" : item.caption ?? "", sortOrder: item.sortOrder ?? index }));
  const next = await mediaRequest(api.metadata(saved.id, saved.rowVersion, JSON.stringify(metadata)), signal);
  if (next.id !== saved.id || next.rowVersion === saved.rowVersion || next.media.length !== media.length
    || media.some(previous => !next.media.some(item => item.id === previous.id && item.complete === previous.complete))
    || metadata.some(expected => !next.media.some(item => item.id === expected.id && item.complete && (item.caption ?? "") === expected.caption && item.sortOrder === expected.sortOrder))) throw new Error("Caption save was not confirmed. Reopen the draft before retrying.");
  return next;
}

export type UploadTiming = { bytes: number; blockSize: number; blocks: number; beginMs: number; encodingMs: number; requestsMs: number; finishMs: number; totalMs: number; complete: boolean };
let lastUploadTiming: UploadTiming | null = null;
export function getLastUploadTiming(): UploadTiming | null { return lastUploadTiming ? { ...lastUploadTiming } : null; }

export async function uploadMedia(api: MediaApi, initial: { id: string; rowVersion: string; uploadProtocol?: 2; maxBlockSize?: 4194304 }, file: File, kind: MediaKind, signal: AbortSignal, progress: (state: MediaState) => void, resume?: MediaState): Promise<MediaState> {
  const started = performance.now();
  const timing: UploadTiming = { bytes: file.size, blockSize: 0, blocks: 0, beginMs: 0, encodingMs: 0, requestsMs: 0, finishMs: 0, totalMs: 0, complete: false };
  lastUploadTiming = null;
  const timed = async <Result>(field: "beginMs" | "requestsMs" | "finishMs", operation: () => Promise<Result>): Promise<Result> => {
    const start = performance.now();
    try { return await operation(); } finally { timing[field] += performance.now() - start; }
  };
  try {
    signal.throwIfAborted();
    const negotiatedKind = initial.uploadProtocol === 2 ? initial.maxBlockSize === 4194304 ? `${kind}:v3` as const : `${kind}:v2` as const : kind;
    let state = resume ?? await timed("beginMs", () => mediaRequest(api.begin(initial.id, initial.rowVersion, negotiatedKind, file.name, file.size), signal));
    const session = state.sessionId;
    const check = (previousVersion: string) => {
      if (state.id !== initial.id || state.sessionId !== session || state.rowVersion === previousVersion) throw new Error("Unconfirmed upload response.");
    };
    if (!session) throw new Error("Missing upload session.");
    const blockSize = state.blockSize;
    const expectedBlockSize = resume ? resume.blockSize : negotiatedKind.endsWith(":v3") ? 4194304 : negotiatedKind.endsWith(":v2") ? 2097152 : 524288;
    if (blockSize !== expectedBlockSize) throw new Error("Upload block size was not negotiated.");
    timing.blockSize = blockSize;
    const active = state.media.find(item => item.sessionId === session);
    if (!active || active.complete || active.kind !== kind || active.name !== file.name || active.size !== file.size
      || ![524288, 2097152, 4194304].includes(blockSize) || active.nextBlock !== Math.ceil(active.received / blockSize)
      || active.received !== Math.min(active.nextBlock * blockSize, file.size)) throw new Error("Invalid upload checkpoint.");
    if (resume) {
      if (state.id !== initial.id || state.rowVersion !== initial.rowVersion) throw new Error("Stale upload checkpoint.");
    } else check(initial.rowVersion);
    progress(state);
    for (let offset = active.received, index = active.nextBlock; offset < file.size; offset += blockSize, index++) {
      const encodingStart = performance.now();
      const bytes = new Uint8Array(await file.slice(offset, offset + blockSize).arrayBuffer());
      signal.throwIfAborted();
      let binary = "";
      for (let position = 0; position < bytes.length; position += 8192) binary += String.fromCharCode(...bytes.subarray(position, position + 8192));
      const content = btoa(binary);
      timing.encodingMs += performance.now() - encodingStart;
      const previous = state.rowVersion;
      const checkpoint = state;
      state = await timed("requestsMs", () => mediaRequest(api.block(initial.id, previous, session, index, content), signal, response => parseUploadProgress(response, checkpoint)));
      check(previous);
      if (state.blockSize !== blockSize) throw new Error("Upload block size changed.");
      const item = state.media.find(item => item.sessionId === session);
      if (!item || item.nextBlock !== index + 1 || item.received !== Math.min(offset + blockSize, file.size)) throw new Error("Unconfirmed upload block.");
      timing.blocks++;
      progress(state);
    }
    signal.throwIfAborted();
    const previous = state.rowVersion;
    state = await timed("finishMs", () => mediaRequest(api.finish(initial.id, previous, session), signal));
    check(previous);
    if (!state.media.find(item => item.sessionId === session)?.complete) throw new Error("Unconfirmed media finalization.");
    timing.complete = true;
    return state;
  } finally {
    timing.totalMs = performance.now() - started;
    lastUploadTiming = { ...timing };
  }
}