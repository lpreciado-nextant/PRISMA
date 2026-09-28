import { mediaOperation, rangeCount, requireMedia, validateBlock, validateMediaIdentity, validateAttachmentFile,
  type MediaSnapshot, type AttachmentMediaAdapter } from "../src/lib/mediaContract.ts";

export type LocalMediaTransport = {
  command(action: string, input: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
  block(input: Record<string, unknown>, bytes: Uint8Array, signal: AbortSignal): Promise<unknown>;
  range(input: Record<string, unknown>, signal: AbortSignal): Promise<Response>;
};
const guid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const object = (value: unknown): Record<string, unknown> => {
  requireMedia(value && typeof value === "object" && !Array.isArray(value), "Invalid local media response.");
  return value as Record<string, unknown>;
};

export function localMediaSnapshot(raw: unknown): MediaSnapshot {
  const state = object(raw);
  requireMedia(guid(state.id) && typeof state.version === "string" && /^\d+$/.test(state.version), "Invalid local media identity/version.");
  if (state.upload === null) return { provider: "local-blob", id: state.id, version: state.version, sessionId: null, blockSize: 4194304, media: [] };
  const upload = object(state.upload);
  requireMedia(guid(upload.id) && guid(upload.assetId) && typeof upload.name === "string"
    && typeof upload.size === "number" && Number.isSafeInteger(upload.size) && upload.size >= 1 && upload.size <= 500 * 1024 * 1024
    && typeof upload.received === "number" && typeof upload.nextBlock === "number" && Number.isSafeInteger(upload.nextBlock) && upload.nextBlock >= 0
    && upload.nextBlock <= Math.ceil(upload.size / 4194304) && upload.received === Math.min(upload.nextBlock * 4194304, upload.size)
    && upload.blockSize === 4194304 && typeof upload.complete === "boolean" && typeof upload.released === "boolean"
    && typeof upload.sha256 === "string" && /^[a-f0-9]{64}$/.test(upload.sha256)
    && (!upload.complete || upload.received === upload.size) && (upload.complete || !upload.released), "Invalid local upload checkpoint.");
  const type = validateAttachmentFile({ name: upload.name, size: upload.size, sha256: upload.sha256 }, "invalid-response");
  requireMedia((upload.mime ?? (type.mime === "video/mp4" ? type.mime : null)) === type.mime, "Unconfirmed attachment MIME type.");
  const scan = upload.scan === null ? null : object(upload.scan);
  requireMedia(upload.complete ? scan?.engine === "simulated" && ["pending", "passed", "rejected", "error"].includes(String(scan.status))
    && Number.isSafeInteger(scan.attempts) && Number(scan.attempts) >= 0 : scan === null, "Invalid local scan state.");
  requireMedia(upload.released === (upload.complete && scan?.status === "passed"), "Unconfirmed local media release.");
  return { provider: "local-blob", id: state.id, version: state.version, sessionId: upload.id, blockSize: 4194304,
    media: [{ id: upload.assetId, sessionId: upload.id, kind: "attachment", name: upload.name, mime: type.mime, size: upload.size,
      received: upload.received, nextBlock: upload.nextBlock, complete: upload.complete, sha256: upload.sha256,
      readiness: !upload.complete ? "uploading" : upload.released ? "ready" : scan?.status === "rejected" ? "rejected" : "quarantined",
      integrity: upload.complete ? "sha256" : "unreported", scanning: scan ? `simulated-${scan.status}` as "simulated-pending" | "simulated-passed" | "simulated-rejected" | "simulated-error" : "unreported" }] };
}

export function createLocalMediaAdapter(transport: LocalMediaTransport): AttachmentMediaAdapter {
  const parse = (raw: unknown, id: string) => {
    const state = localMediaSnapshot(raw); requireMedia(state.id === id, "Mismatched solution identity."); return state;
  };
  return {
    provider: "local-blob",
    async read(id, signal) {
      validateMediaIdentity(id);
      return mediaOperation(signal, false, async () => parse(await transport.command("read", { id, mode: "submission" }, signal), id));
    },
    async begin(write, file, signal) {
      validateMediaIdentity(write.id, write.version); validateAttachmentFile(file);
      return mediaOperation(signal, true, async () => {
        const state = parse(await transport.command("begin", { ...write, ...file }, signal), write.id);
        const item = state.media[0];
        requireMedia(state.version !== write.version && item && !item.complete && item.name === file.name && item.size === file.size
          && item.sha256 === file.sha256 && item.received === 0 && item.nextBlock === 0, "Unconfirmed upload begin.");
        return state;
      });
    },
    async checkpoint(write, session, file, signal) {
      validateMediaIdentity(write.id, write.version); validateMediaIdentity(session); validateAttachmentFile(file);
      return mediaOperation(signal, false, async () => {
        const state = parse(await transport.command("checkpoint", { ...write, session, ...file }, signal), write.id);
        const item = state.media[0];
        requireMedia(state.version === write.version && item && item.sessionId === session && !item.complete && item.name === file.name
          && item.size === file.size && item.sha256 === file.sha256, "Unconfirmed upload checkpoint.");
        return state;
      });
    },
    async block(previous, session, index, bytes, signal) {
      validateMediaIdentity(previous.id, previous.version); validateMediaIdentity(session);
      const item = validateBlock("local-blob", previous, session, index, bytes);
      return mediaOperation(signal, true, async () => {
        const state = parse(await transport.block({ id: previous.id, version: previous.version, session, index }, bytes, signal), previous.id);
        const next = state.media[0];
        requireMedia(state.version !== previous.version && next && next.id === item.id && next.sessionId === session && next.name === item.name
          && next.size === item.size && next.sha256 === item.sha256 && !next.complete && next.received === item.received + bytes.length && next.nextBlock === index + 1,
        "Unconfirmed uploaded block.");
        return state;
      });
    },
    async finish(write, session, signal) {
      validateMediaIdentity(write.id, write.version); validateMediaIdentity(session);
      return mediaOperation(signal, true, async () => {
        const state = parse(await transport.command("finish", { ...write, session }, signal), write.id);
        requireMedia(state.media[0]?.sessionId === session && state.media[0].complete, "Unconfirmed media finalization.");
        return state;
      });
    },
    async remove(write, session, signal) {
      validateMediaIdentity(write.id, write.version); validateMediaIdentity(session);
      return mediaOperation(signal, true, async () => {
        const state = parse(await transport.command("remove", { ...write, session }, signal), write.id);
        requireMedia(state.version !== write.version && state.media.length === 0, "Unconfirmed media removal.");
        return state;
      });
    },
    async range(input, signal) {
      const count = rangeCount(input);
      return mediaOperation(signal, false, async () => {
        const response = await transport.range({ ...input, count }, signal);
        if (!response.ok) throw Object.assign(new Error("Local range denied or unavailable."), { status: response.status });
        const version = response.headers.get("X-Media-Version");
        requireMedia(version && /^\d+:[a-f0-9-]{36}$/i.test(version) && (!input.version || input.version === version)
          && response.headers.get("Content-Type")?.split(";")[0] === "application/octet-stream"
          && response.headers.get("X-Media-Size") === String(input.size) && response.headers.get("X-Media-Offset") === String(input.offset)
          && response.headers.get("Content-Length") === String(count), "Unconfirmed local media range.");
        requireMedia(version.slice(version.indexOf(":") + 1) === input.assetId, "Mismatched range asset identity.");
        const bytes = new Uint8Array(await response.arrayBuffer());
        requireMedia(bytes.length === count, "Incomplete media range.");
        return { bytes, version };
      });
    },
  };
}