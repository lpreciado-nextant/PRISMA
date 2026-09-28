import { LocalBlobStore } from "./storage.mjs";
import { LocalMediaService } from "./service.mjs";
import { SqliteMediaState } from "./state.mjs";
import { cleanupWorkspace } from "./cleanup.mjs";
import { runScanOnce } from "./scanner.mjs";

if (!process.send) throw new Error("This helper is only for the local recovery tests.");
process.once("message", async options => {
  try {
    const store = new LocalBlobStore(options.endpoint, options.account, options.key);
    const journal = new SqliteMediaState(options.path);
    if (["stage", "seal", "promote", "deleteObserved", "read"].includes(options.crashAfter)) {
      const original = store[options.crashAfter].bind(store);
      store[options.crashAfter] = async (...args) => { await original(...args); process.exit(73); };
    }
    if (options.crashAfter === "cleanup-placeholder") {
      const client = store.staging.getBlockBlobClient.bind(store.staging);
      store.staging.getBlockBlobClient = name => {
        const blob = client(name);
        const commit = blob.commitBlockList.bind(blob);
        blob.commitBlockList = async (...args) => { await commit(...args); process.exit(73); };
        return blob;
      };
    }
    if (options.action === "cleanup") {
      await cleanupWorkspace(journal, store, { ...options.cleanup, execute: true, now: () => options.cleanup.time });
      process.exit(1);
    }
    const service = new LocalMediaService(store, Date.now, journal);
    if (options.action === "runScan") await runScanOnce(service, store);
    else await service.execute("builder", options.action, options.input);
    process.exit(options.crashAfter === "commit" ? 74 : 1);
  } catch (error) { console.error(error.message); process.exit(1); }
});