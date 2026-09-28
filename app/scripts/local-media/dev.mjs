import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { startEmulator } from "./emulator.mjs";
import { LocalBlobStore } from "./storage.mjs";
import { LocalMediaService } from "./service.mjs";
import { mediaHandler } from "./http.mjs";
import { SqliteMediaState } from "./state.mjs";
import { fork } from "node:child_process";
import { once } from "node:events";

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--data-dir")) throw new Error("Usage: npm run dev:media -- [--data-dir <local-directory>]");
const directory = args.length ? resolve(args[1]) : join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "PRISMA", "media-lab");
const emulator = await startEmulator({ directory: join(directory, "blob") });
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
  child.send({ path: join(directory, "media.sqlite"), endpoint: emulator.endpoint, account: emulator.account, key: emulator.key });
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
  await emulator.stop();
};
try {
  const storage = new LocalBlobStore(emulator.endpoint, emulator.account, emulator.key);
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
  console.log("PRISMA local media only. Simulated identities; no Dataverse or Azure access.");
  console.log(`Retained local workspace: ${directory}`);
  console.log("Ctrl+C flushes and stops both servers. Restart with the same data directory, Reopen, and reselect the exact file to resume.");
  server.printUrls();
  process.send?.({ event: "ready", url: `http://127.0.0.1:${server.httpServer.address().port}/` });
  process.on("message", message => { if (message === "shutdown") void stop().then(() => process.exit(0)); });
  if (process.connected) process.once("disconnect", () => { void stop().then(() => process.exit(0)); });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void stop().then(() => process.exit(0)); });
} catch (error) { await stop(); throw error; }