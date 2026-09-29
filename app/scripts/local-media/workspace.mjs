import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { WORKSPACE_PREFIX, azureEndpoint } from "./storage.mjs";

const BINDING = "azure-storage.json";

export const defaultWorkspace = azure => join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "PRISMA", azure ? "media-lab-azure" : "media-lab");

const present = path => stat(path).then(() => true, error => { if (error.code === "ENOENT") return false; throw error; });

export async function readAzureBinding(directory) {
  let text;
  try { text = await readFile(join(directory, BINDING), "utf8"); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  const binding = JSON.parse(text);
  if (binding?.kind !== "azure" || azureEndpoint(binding.endpoint) !== binding.endpoint || !WORKSPACE_PREFIX.test(binding.prefix ?? "")) {
    throw new Error("Invalid Azure workspace binding. Preserve the workspace for recovery.");
  }
  return binding;
}

// A workspace never switches between Azurite and Azure, because its journal references blobs in exactly one store.
export async function bindAzureWorkspace(directory, endpoint) {
  const normalized = azureEndpoint(endpoint);
  const existing = await readAzureBinding(directory);
  if (existing) {
    if (existing.endpoint !== normalized) throw new Error(`This workspace is bound to ${existing.endpoint}. Choose another --data-dir.`);
    return existing;
  }
  if (await present(join(directory, "blob")) || await present(join(directory, "media.sqlite"))) {
    throw new Error("This workspace already holds Azurite-backed state. Choose another --data-dir for Azure.");
  }
  await mkdir(directory, { recursive: true });
  const binding = { kind: "azure", endpoint: normalized, prefix: `lab-${randomUUID()}/` };
  await writeFile(join(directory, BINDING), JSON.stringify(binding, null, 2), { flag: "wx" });
  return binding;
}

// Same lock file the Azurite child holds, so Azure-bound workspaces also reject a second owner.
export function lockWorkspace(directory) {
  const lease = new DatabaseSync(join(directory, "workspace-lock.sqlite"));
  try { lease.exec("BEGIN EXCLUSIVE;"); }
  catch { lease.close(); throw new Error("This local media workspace is already running. Stop its other launcher first."); }
  return () => { lease.exec("ROLLBACK;"); lease.close(); };
}
