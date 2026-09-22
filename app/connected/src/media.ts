export type MediaKind = "image" | "attachment" | "thumbnail";
export type MediaItem = { id: string; sessionId: string; kind: MediaKind; name: string; mime: string; size: number; received: number; nextBlock: number; complete: boolean; caption?: string; sortOrder?: number };
export type MediaState = { id: string; rowVersion: string; sessionId: string | null; blockSize: number; media: MediaItem[] };
export type MediaApi = {
  read: (id: string) => Promise<unknown>;
  begin: (id: string, version: string, kind: MediaKind, name: string, size: number) => Promise<unknown>;
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
  if (state.blockSize !== 524288 || !Array.isArray(state.media) || state.media.length > 13) throw new Error("Invalid media limits.");
  const media = state.media.map(value => {
    const item = object(value);
    if (typeof item.id !== "string" || !guid.test(item.id) || typeof item.sessionId !== "string" || !guid.test(item.sessionId)
      || (item.kind !== "image" && item.kind !== "attachment" && item.kind !== "thumbnail") || typeof item.name !== "string" || typeof item.mime !== "string"
      || !integer(item.size) || !integer(item.received) || item.received > item.size || !integer(item.nextBlock) || typeof item.complete !== "boolean") throw new Error("Invalid media record.");
    if ((item.caption !== undefined && (typeof item.caption !== "string" || item.caption.length > 200)) || (item.sortOrder !== undefined && (!integer(item.sortOrder) || item.sortOrder > 12))) throw new Error("Invalid media metadata.");
    return item as MediaItem;
  });
  if (new Set(media.map(item => item.id)).size !== media.length) throw new Error("Duplicate media record.");
  return { id: state.id, rowVersion: state.rowVersion, sessionId: state.sessionId, blockSize: state.blockSize, media };
}

export async function mediaRequest(operation: Promise<unknown>, signal: AbortSignal): Promise<MediaState> {
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
    return parseMedia(result);
  } finally { deadline.removeEventListener("abort", abort); }
}

export async function uploadMedia(api: MediaApi, initial: { id: string; rowVersion: string }, file: File, kind: MediaKind, signal: AbortSignal, progress: (state: MediaState) => void): Promise<MediaState> {
  signal.throwIfAborted();
  let state = await mediaRequest(api.begin(initial.id, initial.rowVersion, kind, file.name, file.size), signal);
  const session = state.sessionId;
  const check = (previousVersion: string) => {
    if (state.id !== initial.id || state.sessionId !== session || state.rowVersion === previousVersion) throw new Error("Unconfirmed upload response.");
  };
  if (!session) throw new Error("Missing upload session.");
  check(initial.rowVersion);
  progress(state);
  for (let offset = 0, index = 0; offset < file.size; offset += state.blockSize, index++) {
    const bytes = new Uint8Array(await file.slice(offset, offset + state.blockSize).arrayBuffer());
    signal.throwIfAborted();
    let binary = "";
    for (let position = 0; position < bytes.length; position += 8192) binary += String.fromCharCode(...bytes.subarray(position, position + 8192));
    const previous = state.rowVersion;
    state = await mediaRequest(api.block(initial.id, previous, session, index, btoa(binary)), signal);
    check(previous);
    const item = state.media.find(item => item.sessionId === session);
    if (!item || item.nextBlock !== index + 1 || item.received !== Math.min(offset + state.blockSize, file.size)) throw new Error("Unconfirmed upload block.");
    progress(state);
  }
  signal.throwIfAborted();
  const previous = state.rowVersion;
  state = await mediaRequest(api.finish(initial.id, previous, session), signal);
  check(previous);
  if (!state.media.find(item => item.sessionId === session)?.complete) throw new Error("Unconfirmed media finalization.");
  return state;
}