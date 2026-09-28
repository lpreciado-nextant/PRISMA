import { createHash, randomUUID } from "node:crypto";
import { BLOCK_SIZE, SESSION_TTL, assertActor, assertEditable, assertRead, assertResume, assertSession, assertVersion, rangeLength, requireValue, validateFile, fileType, validateHeader } from "./policy.mjs";
import { claimNextScan, isReleased, MAX_SCAN_ATTEMPTS, queueScan, scanRecord, settleScan } from "./scanner.mjs";

export class LocalMediaService {
  constructor(store, now = Date.now, state = null) {
    this.store = store;
    this.now = now;
    this.state = state;
    this.drafts = new Map();
    this.queue = Promise.resolve();
  }

  execute(actor, action, input = {}) {
    return this.transaction(() => this.perform(actor, action, input));
  }

  claimScan() { return this.transaction(() => claimNextScan(this.drafts, this.now())); }

  settleScan(claim, status, failure) { return this.transaction(() => settleScan(this.drafts, claim, status, this.now(), failure)); }

  transaction(callback) {
    const operation = this.queue.then(async () => {
      const previous = structuredClone(this.drafts);
      try {
        if (this.state) return await this.state.transaction(async drafts => {
          this.drafts = drafts;
          return callback();
        });
        return await callback();
      } catch (error) { this.drafts = previous; throw error; }
    });
    this.queue = operation.catch(() => {});
    return operation.then(result => structuredClone(result));
  }

  snapshot(draft) {
    const upload = draft.upload;
    return {
      id: draft.id, owner: draft.owner, version: String(draft.version), status: draft.status, safe: draft.safe,
      upload: upload ? {
        id: upload.id, assetId: upload.assetId, name: upload.name, mime: fileType(upload.name).mime, size: upload.size, sha256: upload.sha256,
        received: upload.received, nextBlock: upload.blocks, blockSize: BLOCK_SIZE, expires: upload.expires,
        complete: upload.complete, verification: upload.complete ? "integrity-only; not malware-scanned" : "pending",
        scan: upload.complete ? { engine: "simulated", status: isReleased(upload) ? "passed" : upload.scan?.status === "passed" ? "pending" : upload.scan?.status ?? "pending", attempts: upload.scan?.attempts ?? 0,
          failure: upload.scan?.failure ?? null, job: upload.scan?.job ? { state: upload.scan.job.state, attempts: upload.scan.job.attempts,
            maxAttempts: MAX_SCAN_ATTEMPTS, availableAt: upload.scan.job.availableAt, leaseUntil: upload.scan.job.leaseUntil } : null } : null,
        released: isReleased(upload),
      } : null,
    };
  }

  async perform(actor, action, input) {
    assertActor(actor);
    if (action === "create") {
      requireValue(actor === "builder" || actor === "other-builder", 403, "Only a local builder can create a draft.");
      const draft = { id: randomUUID(), owner: actor, version: 1, status: "draft", safe: false, upload: null };
      this.drafts.set(draft.id, draft);
      return this.snapshot(draft);
    }
    if (action === "list") {
      return [...this.drafts.values()].filter(draft => draft.owner === actor || actor === "librarian" || (draft.status === "published" && isReleased(draft.upload))).map(draft => this.snapshot(draft));
    }
    const draft = this.drafts.get(input.id);
    requireValue(draft, 404, "Local draft not found.");
    if (action === "read") {
      assertRead(draft, actor, input.mode);
      if (input.mode !== "submission") requireValue(isReleased(draft.upload), 403, "Media is quarantined. A simulated scan pass is required.");
      return this.snapshot(draft);
    }
    if (action === "range") {
      assertRead(draft, actor, input.mode);
      const upload = draft.upload;
      requireValue(upload?.complete && upload.assetId === input.assetId, 404, "Completed video not found.");
      requireValue(isReleased(upload), 403, "Media is quarantined. A simulated scan pass is required.");
      const version = `${draft.version}:${upload.assetId}`;
      requireValue(input.version === undefined || input.version === version, 409, "Video version changed. Reopen playback.");
      const count = rangeLength(input.offset, input.count, upload.size);
      const bytes = await this.store.read(upload.assetId, input.offset, count, upload.etag);
      assertRead(draft, actor, input.mode);
      requireValue(bytes.length === count, 502, "Incomplete storage range.");
      return { version, size: upload.size, offset: input.offset, bytes };
    }
    if (action === "publish") {
      requireValue(actor === "librarian", 403, "Only the simulated librarian can publish.");
      assertVersion(draft, input.version);
      requireValue(draft.status === "review" && draft.upload?.complete && input.safe === true, 409, "Review a complete fixture and confirm client safety first.");
      requireValue(isReleased(draft.upload), 409, "Media is quarantined. A simulated scan pass is required.");
      draft.status = "published"; draft.safe = true; draft.version++;
      return this.snapshot(draft);
    }
    if (action === "withdraw") {
      requireValue(draft.owner === actor || actor === "librarian", 403, "Withdrawal access denied.");
      assertVersion(draft, input.version);
      draft.status = "draft"; draft.safe = false; draft.version++;
      return this.snapshot(draft);
    }
    assertEditable(draft, actor, input.version);
    if (action === "begin") {
      validateFile(input);
      requireValue(!draft.upload, 409, "This local slice allows one video per draft. Remove the existing upload first.");
      draft.upload = {
        id: randomUUID(), assetId: randomUUID(), name: input.name, size: input.size, sha256: input.sha256,
        received: 0, blocks: 0, complete: false, expires: this.now() + SESSION_TTL,
      };
      draft.safe = false; draft.version++;
      return this.snapshot(draft);
    }
    if (action === "submit") {
      requireValue(draft.upload?.complete, 409, "A verified local attachment is required.");
      requireValue(isReleased(draft.upload), 409, "Media is quarantined. A simulated scan pass is required.");
      draft.status = "review"; draft.safe = false; draft.version++;
      return this.snapshot(draft);
    }
    const upload = draft.upload;
    requireValue(upload && upload.id === input.session, 404, "Upload session not found.");
    if (action === "scan") {
      requireValue(upload.complete, 409, "Complete integrity verification before scanning.");
      requireValue(!upload.scan || ["pending", "error"].includes(upload.scan.status), 409, "This scan is final. Remove a rejected upload before replacing it.");
      queueScan(upload, input.outcome, this.now());
      draft.safe = false; draft.version++;
      return this.snapshot(draft);
    }
    if (action === "remove") {
      await this.store.remove(upload.id, upload.assetId);
      draft.upload = null; draft.safe = false; draft.version++;
      return this.snapshot(draft);
    }
    if (action === "checkpoint") {
      assertResume(upload, input, this.now());
      return this.snapshot(draft);
    }
    if (action === "finish" && upload.complete) return this.snapshot(draft);
    assertSession(upload, this.now());
    if (action === "block") {
      const expectedLength = Math.min(BLOCK_SIZE, upload.size - upload.received);
      requireValue(Number.isSafeInteger(input.index) && input.index === upload.blocks && expectedLength > 0, 409, "Out-of-order block. Reopen the checkpoint.");
      requireValue(input.bytes instanceof Uint8Array && input.bytes.length === expectedLength, 400, "Unexpected block size.");
      await this.store.stage(upload.id, upload.blocks, input.bytes);
      upload.received += input.bytes.length; upload.blocks++; draft.version++;
      return this.snapshot(draft);
    }
    requireValue(action === "finish", 400, "Unknown local media operation.");
    requireValue(upload.received === upload.size, 409, "Upload is incomplete.");
    const staged = await this.store.seal(upload.id, upload.blocks);
    requireValue(staged.size === upload.size, 409, "Stored size does not match.");
    const digest = createHash("sha256");
    const mime = fileType(upload.name).mime;
    const decoder = mime === "text/html" ? new TextDecoder("utf-8", { fatal: true }) : null;
    let received = 0;
    let header = Buffer.alloc(0);
    for await (const chunk of staged.stream) {
      digest.update(chunk); received += chunk.length;
      if (header.length < 12) header = Buffer.concat([header, Buffer.from(chunk).subarray(0, 12 - header.length)]);
      if (decoder) {
        let text;
        try { text = decoder.decode(chunk, { stream: true }); } catch { requireValue(false, 400, "HTML must be valid UTF-8 text."); }
        requireValue(!text.includes("\0"), 400, "HTML must not contain null bytes.");
      }
    }
    if (decoder) { try { decoder.decode(); } catch { requireValue(false, 400, "HTML must be valid UTF-8 text."); } }
    requireValue(received === upload.size && digest.digest("hex") === upload.sha256, 409, "SHA-256 verification failed. Remove and restart the upload.");
    validateHeader(mime, header);
    assertSession(upload, this.now());
    upload.etag = await this.store.promote(upload.id, upload.assetId, staged.etag);
    upload.complete = true; upload.scan = scanRecord(upload); draft.safe = false; draft.version++;
    return this.snapshot(draft);
  }
}