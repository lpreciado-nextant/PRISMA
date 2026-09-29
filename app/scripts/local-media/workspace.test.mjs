import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindAzureWorkspace, lockWorkspace, readAzureBinding } from "./workspace.mjs";

const endpoint = "https://stprismalab01.blob.core.windows.net";

test("Azure workspace binding is stable, exclusive to one account and never adopts Azurite state", async () => {
  const root = await mkdtemp(join(tmpdir(), "prisma-workspace-test-"));
  try {
    const directory = join(root, "azure");
    assert.equal(await readAzureBinding(directory), null);
    const binding = await bindAzureWorkspace(directory, endpoint);
    assert.equal(binding.endpoint, `${endpoint}/`);
    assert.match(binding.prefix, /^lab-[a-f0-9-]{36}\/$/);
    assert.deepEqual(await bindAzureWorkspace(directory, `${endpoint}/`), binding);
    assert.deepEqual(await readAzureBinding(directory), binding);
    await assert.rejects(bindAzureWorkspace(directory, "https://stprismalab02.blob.core.windows.net/"), /bound to/);

    const azurite = join(root, "azurite");
    await mkdir(join(azurite, "blob"), { recursive: true });
    await assert.rejects(bindAzureWorkspace(azurite, endpoint), /Azurite-backed/);
    assert.equal(await readAzureBinding(azurite), null);

    const tampered = join(root, "tampered");
    await mkdir(tampered);
    await writeFile(join(tampered, "azure-storage.json"), JSON.stringify({ ...binding, prefix: "../" }));
    await assert.rejects(readAzureBinding(tampered), /Invalid Azure workspace binding/);
    assert.equal(JSON.parse(await readFile(join(directory, "azure-storage.json"), "utf8")).prefix, binding.prefix);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Azure-bound workspaces reject a second owner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prisma-workspace-lock-"));
  try {
    const release = lockWorkspace(directory);
    assert.throws(() => lockWorkspace(directory), /already running/);
    release();
    lockWorkspace(directory)();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
