import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const directory = process.env.PRISMA_EMULATOR_DIRECTORY;
if (!directory || !process.send) throw new Error("Start the emulator through the local media launcher.");
delete process.env.AZURITE_DB;
const lease = new DatabaseSync(join(directory, "workspace-lock.sqlite"));
try { lease.exec("BEGIN EXCLUSIVE;"); }
catch { lease.close(); throw new Error("This local media workspace is already running. Stop its other launcher first."); }
const { BlobServerFactory } = createRequire(import.meta.url)("azurite/dist/src/blob/BlobServerFactory.js");
const starting = (async () => {
  const server = await new BlobServerFactory().createServer();
  await server.start();
  return server;
})();
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  try {
    const server = await starting;
    await server.close();
    lease.exec("ROLLBACK;"); lease.close();
    process.exit(0);
  } catch (error) { console.error(error.message); process.exit(1); }
};
process.on("message", message => { if (message === "shutdown") void stop(); });
process.once("disconnect", () => void stop());
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => void stop());
try {
  await starting;
  if (process.connected) console.log("Azurite Blob service successfully listens (local workspace locked).");
  else await stop();
} catch (error) { console.error(error.message); process.exit(1); }