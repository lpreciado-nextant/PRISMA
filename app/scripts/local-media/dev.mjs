import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { parseArgs } from "node:util";
import { join, resolve } from "node:path";
import { startEmulator } from "./emulator.mjs";
import { openBlobStore } from "./storage.mjs";
import { LocalMediaService } from "./service.mjs";
import { mediaHandler } from "./http.mjs";
import { SqliteMediaState } from "./state.mjs";
import { bindAzureWorkspace, defaultWorkspace, lockWorkspace, readAzureBinding } from "./workspace.mjs";
import { fork } from "node:child_process";
import { once } from "node:events";

const { values } = parseArgs({ options: { "data-dir": { type: "string" }, "azure-endpoint": { type: "string" } }, strict: true });
const azure = values["azure-endpoint"];
const directory = values["data-dir"] ? resolve(values["data-dir"]) : defaultWorkspace(Boolean(azure));
let emulator;
let unlock;
let storageConfig;
if (azure) {
  storageConfig = await bindAzureWorkspace(directory, azure);
  unlock = lockWorkspace(directory);
} else {
  if (await readAzureBinding(directory)) throw new Error("This workspace is bound to Azure Blob Storage. Pass --azure-endpoint or choose another --data-dir.");
  emulator = await startEmulator({ directory: join(directory, "blob") });
  storageConfig = { kind: "azurite", endpoint: emulator.endpoint, account: emulator.account, key: emulator.key };
}
let server;
let state;
let service;
let closing = false;
let worker;
let workerRestart;
let workerRestarts = 0;
const startWorker = () => {
  if (closing) return;
  const child = fork(new URL("./scan-worker.mjs", import.meta.url), [], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
  worker = child;
  child.on("error", error => console.error(`Local scan worker: ${error.message}`));
  child.on("message", message => { if (message.event === "ready") console.log(`Simulated background scan worker ready (PID ${child.pid}).`); });
  child.once("exit", () => {
    if (worker === child) worker = null;
    if (!closing && workerRestarts++ < 3) workerRestart = setTimeout(startWorker, 1000);
    else if (!closing) console.error("Scan worker restart limit reached. Jobs remain quarantined; restart the launcher.");
  });
  child.send({ path: join(directory, "media.sqlite"), storage: storageConfig });
};
const stop = async () => {
  if (closing) return;
  closing = true;
  clearTimeout(workerRestart);
  if (worker) {
    const child = worker;
    const exited = once(child, "exit");
    const deadline = setTimeout(() => child.kill(), 8000);
    try { if (child.connected) child.send("shutdown"); else child.kill(); await exited; }
    finally { clearTimeout(deadline); }
  }
  await server?.close();
  await service?.queue;
  state?.close();
  await emulator?.stop();
  unlock?.();
};
try {
  const storage = openBlobStore(storageConfig);
  await storage.initialize();
  state = new SqliteMediaState(join(directory, "media.sqlite"));
  service = new LocalMediaService(storage, Date.now, state);
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("../../local-media/", import.meta.url)),
    base: "./", publicDir: false,
    plugins: [react(), { name: "local-media-api", configureServer(vite) { vite.middlewares.use(mediaHandler(service)); } }],
    server: { host: "127.0.0.1", port: 5180, strictPort: false, fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] } },
  });
  await server.listen();
  startWorker();
  console.log(azure
    ? `PRISMA media lab. Simulated identities; Blob bytes in ${storageConfig.endpoint} under ${storageConfig.prefix} as your Azure CLI identity; no Dataverse access.`
    : "PRISMA local media only. Simulated identities; no Dataverse or Azure access.");
  console.log(`Retained local workspace: ${directory}`);
  console.log("Ctrl+C flushes and stops both servers. Restart with the same data directory, Reopen, and reselect the exact file to resume.");
  server.printUrls();
  process.send?.({ event: "ready", url: `http://127.0.0.1:${server.httpServer.address().port}/` });
  process.on("message", message => { if (message === "shutdown") void stop().then(() => process.exit(0)); });
  if (process.connected) process.once("disconnect", () => { void stop().then(() => process.exit(0)); });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void stop().then(() => process.exit(0)); });
} catch (error) { await stop(); throw error; }