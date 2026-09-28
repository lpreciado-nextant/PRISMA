import { createHash } from "node:crypto";

export const ORPHAN_GRACE = 24 * 60 * 60 * 1000;
const guid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const keyOf = blob => `${blob.container}/${blob.name}`;
const order = (left, right) => keyOf(left).localeCompare(keyOf(right));

export function planCleanup(drafts, inventory, now, workspace) {
  const references = new Map();
  const issues = [];
  const expiredUploads = [];
  const orphanBlobs = [];
  const retainedBlobs = [];
  const blobs = new Map();
  for (const blob of inventory) {
    const key = keyOf(blob);
    if (blobs.has(key) || !["staging", "assets"].includes(blob.container)) throw new Error("Invalid or duplicate storage inventory.");
    blobs.set(key, blob);
  }
  const records = [...drafts.values()].sort((left, right) => left.id.localeCompare(right.id));
  for (const draft of records) {
    if (!draft.upload) continue;
    for (const key of [`staging/${draft.upload.id}`, `assets/${draft.upload.assetId}`]) {
      const owners = references.get(key) ?? [];
      owners.push(draft.id); references.set(key, owners);
    }
  }
  for (const [key, owners] of references) {
    if (owners.length > 1) issues.push({ kind: "shared-reference", key, drafts: owners });
  }
  for (const draft of records) {
    const upload = draft.upload;
    if (!upload) continue;
    const expired = !upload.complete && draft.status === "draft" && upload.expires <= now;
    const targets = [`staging/${upload.id}`, `assets/${upload.assetId}`];
    if (expired) {
      expiredUploads.push({ draftId: draft.id, version: String(draft.version), sessionId: upload.id, assetId: upload.assetId,
        expires: upload.expires, blobs: targets.flatMap(key => blobs.has(key) ? [blobs.get(key)] : []) });
    } else if (upload.complete) {
      const asset = blobs.get(targets[1]);
      if (!asset || asset.uncommitted) issues.push({ kind: "missing-completed-asset", key: targets[1], draftId: draft.id });
      else if (asset.etag !== upload.etag || asset.size !== upload.size) issues.push({ kind: "changed-completed-asset", key: targets[1], draftId: draft.id });
    } else if (upload.received > 0 && !blobs.has(targets[0])) {
      issues.push({ kind: "missing-active-staging", key: targets[0], draftId: draft.id });
    }
  }
  const expiredKeys = new Set(expiredUploads.flatMap(upload => upload.blobs.map(keyOf)));
  for (const blob of [...inventory].sort(order)) {
    const key = keyOf(blob);
    if (references.has(key)) {
      if (!expiredKeys.has(key)) retainedBlobs.push({ key, reason: "referenced" });
    } else if (!guid.test(blob.name)) {
      retainedBlobs.push({ key, reason: "unrecognized-name" });
    } else if (!Number.isFinite(blob.modified) || blob.modified > now - ORPHAN_GRACE) {
      retainedBlobs.push({ key, reason: "recent-or-unknown-age" });
    } else orphanBlobs.push(blob);
  }
  issues.sort((left, right) => left.key.localeCompare(right.key));
  const reviewed = { schema: 1, workspace, records, inventory: [...inventory].sort(order), expiredUploads, orphanBlobs, issues };
  const fingerprint = createHash("sha256").update(JSON.stringify(reviewed)).digest("hex");
  return { schema: 1, workspace, generatedAt: new Date(now).toISOString(), orphanGraceHours: 24, fingerprint,
    blocked: issues.length > 0, expiredUploads, orphanBlobs, retainedBlobs, issues };
}

export async function cleanupWorkspace(state, store, { workspace, execute = false, expected, now = Date.now }) {
  if (execute && (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected))) throw new Error("Execution requires the reviewed report fingerprint.");
  return state.transaction(async drafts => {
    const report = planCleanup(drafts, await store.inventory(), now(), workspace);
    if (!execute) return report;
    if (report.blocked) throw new Error("Cleanup is blocked by health/reference issues. Review a fresh report; nothing was deleted.");
    if (expected !== report.fingerprint) throw new Error("Cleanup report is stale or belongs to another workspace. Review a fresh report; nothing was deleted.");
    const removedBlobs = [];
    const clearedUploads = [];
    const remove = async (blob, expiredDraft) => {
      for (const draft of drafts.values()) {
        const upload = draft.upload;
        const referenced = upload && (blob.container === "staging" ? upload.id : upload.assetId) === blob.name;
        if (referenced && (draft.id !== expiredDraft || upload.complete || draft.status !== "draft" || upload.expires > now())) {
          throw new Error("A deletion target is now protected. Review a fresh report.");
        }
      }
      await store.deleteObserved(blob);
      removedBlobs.push(keyOf(blob));
    };
    for (const candidate of report.expiredUploads) {
      const draft = drafts.get(candidate.draftId);
      for (const blob of candidate.blobs) await remove(blob, draft.id);
      draft.upload = null; draft.safe = false; draft.version++;
      clearedUploads.push(draft.id);
    }
    for (const blob of report.orphanBlobs) await remove(blob);
    return { status: "completed", workspace, fingerprint: report.fingerprint, removedBlobs, clearedUploads };
  });
}