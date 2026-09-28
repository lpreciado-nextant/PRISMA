import { requireValue } from "./policy.mjs";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export const MAX_SCAN_ATTEMPTS = 3;
export const SCAN_TIMEOUT = 5_000;
export const SCAN_LEASE = 10_000;
export const SCAN_RETRY_DELAY = 2_000;

export function isReleased(upload) {
  const scan = upload?.scan;
  return !!(upload?.complete && scan?.engine === "simulated" && scan.status === "passed"
    && scan.assetId === upload.assetId && scan.etag === upload.etag && scan.sha256 === upload.sha256);
}

export function scanRecord(upload, status = "pending", attempts = 0) {
  return { engine: "simulated", status, attempts, assetId: upload.assetId, etag: upload.etag, sha256: upload.sha256 };
}

export function queueScan(upload, outcome, now) {
  requireValue(!upload.scan?.job, 409, "A scan job is already queued or running.");
  requireValue(["pass", "reject", "outage", "timeout"].includes(outcome), 400, "Choose a simulated scanner outcome.");
  upload.scan = { ...scanRecord(upload, "pending", upload.scan?.attempts ?? 0), job: {
    id: randomUUID(), sessionId: upload.id, outcome, state: "queued", attempts: 0,
    availableAt: now, leaseUntil: 0, token: null,
  } };
}

export function claimNextScan(drafts, now) {
  for (const draft of drafts.values()) {
    const upload = draft.upload;
    const scan = upload?.scan;
    const job = scan?.job;
    if (draft.status !== "draft" || !upload?.complete || scan?.status !== "pending" || !job
      || scan.assetId !== upload.assetId || scan.etag !== upload.etag || scan.sha256 !== upload.sha256 || job.sessionId !== upload.id
      || (job.state === "queued" ? job.availableAt > now : job.leaseUntil > now)) continue;
    if (job.attempts >= MAX_SCAN_ATTEMPTS) {
      scan.status = "error"; scan.failure = "interrupted"; delete scan.job; draft.version++;
      continue;
    }
    job.state = "running"; job.attempts++; scan.attempts++;
    job.token = randomUUID(); job.leaseUntil = now + SCAN_LEASE; draft.version++;
    return { draftId: draft.id, sessionId: upload.id, assetId: upload.assetId, etag: upload.etag, sha256: upload.sha256,
      jobId: job.id, token: job.token, leaseUntil: job.leaseUntil, outcome: job.outcome };
  }
  return null;
}

export function settleScan(drafts, claim, status, now, failure = "unavailable") {
  const draft = drafts.get(claim.draftId);
  const upload = draft?.upload;
  const scan = upload?.scan;
  const job = scan?.job;
  if (draft?.status !== "draft" || !upload?.complete || scan?.status !== "pending" || job?.state !== "running"
    || job.id !== claim.jobId || job.token !== claim.token || job.leaseUntil <= now || job.leaseUntil !== claim.leaseUntil
    || upload.id !== claim.sessionId || upload.assetId !== claim.assetId || upload.etag !== claim.etag || upload.sha256 !== claim.sha256
    || scan.assetId !== upload.assetId || scan.etag !== upload.etag || scan.sha256 !== upload.sha256) return false;
  requireValue(["passed", "rejected", "error"].includes(status), 400, "Invalid scanner verdict.");
  if (status === "error" && job.attempts < MAX_SCAN_ATTEMPTS) {
    job.state = "queued"; job.availableAt = now + SCAN_RETRY_DELAY * 2 ** (job.attempts - 1);
    job.token = null; job.leaseUntil = 0; scan.failure = failure;
  } else {
    scan.status = status; delete scan.job;
    if (status === "error") scan.failure = failure;
    else delete scan.failure;
  }
  draft.safe = false; draft.version++;
  return true;
}

export async function simulatedScan(outcome, { signal } = {}) {
  requireValue(["pass", "reject", "outage", "timeout"].includes(outcome), 400, "Choose a simulated scanner outcome.");
  await delay(outcome === "timeout" ? 60_000 : 750, undefined, { signal });
  if (outcome === "outage") throw new Error("Simulated scanner unavailable.");
  return outcome === "pass" ? "passed" : "rejected";
}

export async function runScanOnce(repository, store, { scan = simulatedScan, timeout = SCAN_TIMEOUT, signal, onClaim } = {}) {
  if (signal?.aborted) return false;
  const claim = await repository.claimScan();
  if (!claim) return false;
  onClaim?.(claim);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new DOMException("Scan timed out", "TimeoutError")), timeout);
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  let abort;
  let status;
  let failure;
  try {
    combined.throwIfAborted();
    const interrupted = new Promise((resolve, reject) => {
      abort = () => reject(combined.reason);
      combined.addEventListener("abort", abort, { once: true });
    });
    status = await Promise.race([interrupted, (async () => {
      const bytes = await store.read(claim.assetId, 0, 12, claim.etag, combined);
      combined.throwIfAborted();
      requireValue(bytes.length === 12, 502, "Stored media unavailable for scanning.");
      return scan(claim.outcome, { signal: combined });
    })()]);
    requireValue(["passed", "rejected"].includes(status), 502, "Invalid scanner result.");
  } catch {
    status = "error"; failure = controller.signal.aborted ? "timeout" : "unavailable";
  } finally {
    clearTimeout(deadline);
    if (abort) combined.removeEventListener("abort", abort);
  }
  if (!signal?.aborted) await repository.settleScan(claim, status, failure);
  return true;
}