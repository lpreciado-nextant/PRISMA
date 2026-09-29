import { parseArgs } from "node:util";
import { realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startEmulator } from "./emulator.mjs";
import { AzureBlobStore, LocalBlobStore } from "./storage.mjs";
import { SqliteMediaState } from "./state.mjs";
import { cleanupWorkspace } from "./cleanup.mjs";
import { defaultWorkspace, lockWorkspace, readAzureBinding } from "./workspace.mjs";

let emulator;
let unlock;
let state;
try {
  const { values } = parseArgs({ options: { "data-dir": { type: "string" }, azure: { type: "boolean" }, execute: { type: "boolean" }, confirm: { type: "string" }, help: { type: "boolean" } }, strict: true });
  if (values.help) {
    console.log("Usage: npm run cleanup:media -- [--data-dir <existing-local-directory> | --azure] [--execute --confirm <report-fingerprint>]");
    console.log("Stop the local media lab first. The default operation reports only; execution deletes approved expired uploads and old orphans.");
    console.log("--azure selects the default Azure-bound workspace; any Azure-bound --data-dir is detected automatically.");
  } else {
    if (Boolean(values.execute) !== Boolean(values.confirm) || (values.confirm && !/^[a-f0-9]{64}$/.test(values.confirm))) throw new Error("Deletion requires both --execute and --confirm <64-character-report-fingerprint>.");
    const directory = await realpath(values["data-dir"] ? resolve(values["data-dir"]) : defaultWorkspace(Boolean(values.azure)));
    const path = join(directory, "media.sqlite");
    const binding = await readAzureBinding(directory);
    if (values.azure && !binding) throw new Error("This workspace is not bound to Azure Blob Storage.");
    let store;
    if (binding) {
      unlock = lockWorkspace(directory);
      state = new SqliteMediaState(path, { existingOnly: true, readOnly: !values.execute });
      store = new AzureBlobStore(binding.endpoint, binding.prefix);
    } else {
      if (!(await stat(join(directory, "blob"))).isDirectory()) throw new Error("The existing Blob workspace is missing.");
      state = new SqliteMediaState(path, { existingOnly: true });
      state.close(); state = null;
      emulator = await startEmulator({ directory: join(directory, "blob") });
      state = new SqliteMediaState(path, { existingOnly: true, readOnly: !values.execute });
      store = new LocalBlobStore(emulator.endpoint, emulator.account, emulator.key);
    }
    const result = await cleanupWorkspace(state, store, { workspace: directory, execute: values.execute, expected: values.confirm });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(`Cleanup stopped: ${error.message}`);
  console.error("No success is assumed. Preserve the workspace, resolve the error, then generate and review a fresh report before retrying. Earlier deletions cannot be rolled back.");
  process.exitCode = 1;
} finally {
  state?.close();
  await emulator?.stop();
  unlock?.();
}