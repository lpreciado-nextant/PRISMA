import { setTimeout as delay } from "node:timers/promises";
import { openBlobStore } from "./storage.mjs";
import { SqliteMediaState } from "./state.mjs";
import { claimNextScan, runScanOnce, settleScan } from "./scanner.mjs";

if (!process.send) throw new Error("The local scan worker requires its launcher IPC connection.");
const lifetime = new AbortController();
for (const signal of ["SIGINT", "SIGTERM", "disconnect"]) process.once(signal, () => lifetime.abort());
process.on("message", message => { if (message === "shutdown") lifetime.abort(); });
process.once("message", async options => {
  let state;
  try {
    if (lifetime.signal.aborted) return;
    state = new SqliteMediaState(options.path, { existingOnly: true });
    const store = openBlobStore(options.storage);
    const repository = {
      claimScan: () => state.transaction(drafts => claimNextScan(drafts, Date.now())),
      settleScan: (claim, status, failure) => state.transaction(drafts => settleScan(drafts, claim, status, Date.now(), failure)),
    };
    if (process.connected) process.send({ event: "ready" });
    while (!lifetime.signal.aborted) {
      try {
        const processed = await runScanOnce(repository, store, { signal: lifetime.signal,
          onClaim: claim => { if (process.connected) process.send({ event: "claimed", jobId: claim.jobId }); } });
        if (processed && process.connected) process.send({ event: "settled" });
      } catch (error) { console.error(`Local scan worker: ${error.message}`); }
      await delay(1000, undefined, { signal: lifetime.signal }).catch(() => {});
    }
  } catch (error) { console.error(`Local scan worker stopped: ${error.message}`); process.exitCode = 1; }
  finally { state?.close(); if (process.connected) process.disconnect(); }
});