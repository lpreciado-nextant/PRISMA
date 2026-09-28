import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

export async function startEmulator(options = {}) {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const persistent = options.directory !== undefined;
  const directory = options.directory ?? await mkdtemp(join(tmpdir(), "prisma-media-local-"));
  await mkdir(directory, { recursive: true });
  const account = "prismalocal";
  const key = randomBytes(64).toString("base64");
  const entry = fileURLToPath(new URL("./emulator-worker.mjs", import.meta.url));
  const child = spawn(process.execPath, [entry, "--blobHost", "127.0.0.1", "--blobPort", String(port), "--location", directory, "--silent", "--disableTelemetry"], {
    env: { ...process.env, PRISMA_EMULATOR_DIRECTORY: directory, AZURITE_ACCOUNTS: `${account}:${key}` }, stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true,
  });
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode === null && child.signalCode === null) {
      let timer;
      const exited = once(child, "exit");
      try {
        child.send("shutdown");
        const [code] = await Promise.race([exited, new Promise((_, reject) => {
          timer = setTimeout(() => { child.kill(); reject(new Error("Azurite shutdown timed out; retained data needs verification.")); }, 30_000);
        })]);
        if (code !== 0) throw new Error("Azurite did not shut down cleanly; retained data needs verification.");
      } finally { clearTimeout(timer); }
    }
    if (!persistent) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  };
  try {
    await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error(`Azurite did not start within 90 seconds. ${output.slice(-1000)}`)), 90_000);
      const done = error => { clearTimeout(timer); error ? reject(error) : resolve(); };
      child.once("error", done);
      child.once("exit", code => done(new Error(`Azurite exited (${code}) before use. ${output.slice(-1000)}`)));
      const capture = chunk => {
        output = (output + chunk.toString()).slice(-4000);
        if (output.includes("Azurite Blob service successfully listens")) done();
      };
      child.stdout.on("data", capture); child.stderr.on("data", capture);
    });
    return { endpoint: `http://127.0.0.1:${port}/${account}`, account, key, directory, stop };
  } catch (error) { await stop(); throw error; }
}