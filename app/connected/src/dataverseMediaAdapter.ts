import { parseMedia, parseUploadProgress, type MediaApi, type MediaState } from "./media.ts";
import { parseVideoRange, type TransferApi } from "./mediaTransfer.ts";
import { MediaContractError, mediaOperation, rangeCount, requireMedia, validateBlock, validateMediaIdentity, validateVideoFile,
  type MediaSnapshot, type VideoMediaAdapter } from "../../src/lib/mediaContract.ts";

function decode<Result>(raw: unknown, parse: (value: unknown) => Result): Result {
  if (raw && typeof raw === "object" && "success" in raw && raw.success === false) throw new MediaContractError("unavailable", "Dataverse media operation failed.");
  try { return parse(raw); }
  catch (error) { throw new MediaContractError("invalid-response", "Invalid Dataverse media response.", "none", error); }
}

export function dataverseMediaSnapshot(state: MediaState): MediaSnapshot {
  return { provider: "dataverse", id: state.id, version: state.rowVersion, sessionId: state.sessionId, blockSize: state.blockSize,
    media: state.media.map(item => ({ ...item, readiness: item.complete ? "ready" : "uploading", integrity: "unreported", scanning: "unreported" })) };
}

export function createDataverseMediaAdapter(api: MediaApi, transfer: TransferApi): VideoMediaAdapter {
  const parse = (raw: unknown) => dataverseMediaSnapshot(decode(raw, parseMedia));
  const verify = (state: MediaSnapshot, id: string) => { requireMedia(state.id === id, "Mismatched solution identity."); return state; };
  return {
    provider: "dataverse",
    async read(id, signal) {
      validateMediaIdentity(id);
      return mediaOperation(signal, false, async () => verify(parse(await api.read(id)), id));
    },
    async begin(write, file, signal) {
      validateMediaIdentity(write.id, write.version); validateVideoFile(file);
      return mediaOperation(signal, true, async () => {
        const state = verify(parse(await transfer.begin(write.id, write.version, file.name, file.size, file.sha256)), write.id);
        const item = state.media.find(media => media.sessionId === state.sessionId);
        requireMedia(state.version !== write.version && state.blockSize === 4194304 && item && !item.complete
          && item.kind === "attachment" && item.name === file.name && item.size === file.size && item.received === 0 && item.nextBlock === 0,
        "Unconfirmed upload begin.");
        return state;
      });
    },
    async checkpoint(write, session, file, signal) {
      validateMediaIdentity(write.id, write.version); validateMediaIdentity(session); validateVideoFile(file);
      return mediaOperation(signal, false, async () => {
        const state = verify(parse(await transfer.checkpoint(write.id, write.version, session, file.name, file.size, file.sha256)), write.id);
        const item = state.media.find(media => media.sessionId === session);
        requireMedia(state.version === write.version && state.sessionId === session && item && !item.complete && item.kind === "attachment"
          && item.name === file.name && item.size === file.size && item.received === Math.min(item.nextBlock * state.blockSize, item.size), "Unconfirmed upload checkpoint.");
        return state;
      });
    },
    async block(previous, session, index, bytes, signal) {
      validateMediaIdentity(previous.id, previous.version); validateMediaIdentity(session);
      const item = validateBlock("dataverse", previous, session, index, bytes);
      return mediaOperation(signal, true, async () => {
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
        const native: MediaState = { id: previous.id, rowVersion: previous.version, sessionId: previous.sessionId,
          blockSize: previous.blockSize, uploadProtocol: 2, media: previous.media };
        const raw = await api.block(previous.id, previous.version, session, index, btoa(binary));
        const state = verify(dataverseMediaSnapshot(decode(raw, value => parseUploadProgress(value, native))), previous.id);
        const next = state.media.find(media => media.sessionId === session);
        requireMedia(state.version !== previous.version && state.sessionId === session && state.blockSize === previous.blockSize
          && next && next.id === item.id && next.name === item.name && next.size === item.size && !next.complete
          && next.nextBlock === index + 1 && next.received === item.received + bytes.length, "Unconfirmed uploaded block.");
        return state;
      });
    },
    async finish(write, session, signal) {
      validateMediaIdentity(write.id, write.version); validateMediaIdentity(session);
      return mediaOperation(signal, true, async () => {
        const state = verify(parse(await api.finish(write.id, write.version, session)), write.id);
        const item = state.media.find(media => media.sessionId === session);
        requireMedia(item?.complete && item.received === item.size, "Unconfirmed media finalization.");
        return state;
      });
    },
    async remove(write, session, signal) {
      validateMediaIdentity(write.id, write.version); validateMediaIdentity(session);
      return mediaOperation(signal, true, async () => {
        const state = verify(parse(await api.remove(write.id, write.version, session)), write.id);
        requireMedia(state.version !== write.version && !state.media.some(item => item.sessionId === session), "Unconfirmed media removal.");
        return state;
      });
    },
    async range(input, signal) {
      const count = rangeCount(input);
      return mediaOperation(signal, false, async () => decode(await transfer.range(input.id, input.assetId, input.mode, input.offset, count, input.version),
        raw => parseVideoRange(raw, input.id, input.assetId, input.offset, input.size, count, input.version)));
    },
  };
}