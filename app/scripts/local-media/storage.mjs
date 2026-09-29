import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { AzureCliCredential } from "@azure/identity";
import { requireValue } from "./policy.mjs";

const blockId = index => Buffer.from(String(index).padStart(8, "0")).toString("base64");
const CONTAINERS = ["staging", "assets"];
export const WORKSPACE_PREFIX = /^lab-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/$/;

export function azureEndpoint(value) {
  const match = typeof value === "string" ? /^https:\/\/([a-z0-9]{3,24})\.blob\.core\.windows\.net\/?$/.exec(value) : null;
  requireValue(match, 400, "Use https://<account>.blob.core.windows.net without a path, credentials or SAS.");
  return `https://${match[1]}.blob.core.windows.net/`;
}

class BlobStore {
  constructor(service, prefix) {
    this.prefix = prefix;
    this.staging = service.getContainerClient("staging");
    this.assets = service.getContainerClient("assets");
  }

  blob(container, name) {
    return this[container].getBlockBlobClient(this.prefix + name);
  }

  async initialize() {
    await this.staging.createIfNotExists();
    await this.assets.createIfNotExists();
  }

  async stage(id, index, bytes) {
    await this.blob("staging", id).stageBlock(blockId(index), bytes, bytes.length);
  }

  async seal(id, count) {
    const blob = this.blob("staging", id);
    const committed = await blob.commitBlockList(Array.from({ length: count }, (_, index) => blockId(index)));
    const result = await blob.download(0, undefined, { conditions: { ifMatch: committed.etag } });
    return { stream: result.readableStreamBody, size: result.contentLength, etag: result.etag };
  }

  async promote(id, assetId, etag) {
    const source = await this.blob("staging", id).download(0, undefined, { conditions: { ifMatch: etag } });
    const result = await this.blob("assets", assetId).uploadStream(source.readableStreamBody, 4 * 1024 * 1024, 1, {
      blobHTTPHeaders: { blobContentType: "video/mp4", blobCacheControl: "no-store" },
    });
    return result.etag;
  }

  async read(id, offset, count, etag, signal) {
    const result = await this.blob("assets", id).download(offset, count, { conditions: { ifMatch: etag }, abortSignal: signal });
    const chunks = [];
    let received = 0;
    for await (const chunk of result.readableStreamBody) {
      received += chunk.length;
      requireValue(received <= count, 502, "Storage exceeded the requested range.");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async remove(id, assetId) {
    await this.blob("assets", assetId).deleteIfExists();
    await this.blob("staging", id).deleteIfExists();
  }

  async inventory() {
    const inventory = [];
    for (const container of CONTAINERS) {
      for await (const item of this[container].listBlobsFlat({ includeUncommitedBlobs: true, ...(this.prefix ? { prefix: this.prefix } : {}) })) {
        const name = item.name.slice(this.prefix.length);
        const blob = this.blob(container, name);
        let properties;
        let uncommitted = false;
        let blocks;
        try { properties = await blob.getProperties(); }
        catch (error) {
          if ((error.code ?? error.details?.errorCode) !== "BlobNotFound") throw error;
          properties = await blob.getBlockList("all");
          blocks = (properties.uncommittedBlocks ?? []).map(block => ({ name: block.name, size: block.size })).sort((left, right) => left.name.localeCompare(right.name));
          requireValue(blocks.length > 0, 409, "Storage changed during inventory. Generate a fresh report.");
          uncommitted = true;
        }
        requireValue(typeof properties.etag === "string" && properties.etag.length > 0, 502, "Storage inventory is missing an ETag.");
        inventory.push({ container, name, etag: properties.etag,
          size: uncommitted ? blocks.reduce((total, block) => total + block.size, 0) : properties.contentLength,
          modified: properties.lastModified?.getTime() ?? null, uncommitted, ...(blocks ? { blocks } : {}) });
      }
    }
    return inventory;
  }

  async deleteObserved(blob) {
    requireValue(CONTAINERS.includes(blob.container) && typeof blob.etag === "string" && blob.etag.length > 0, 400, "Invalid conditional deletion.");
    try {
      const client = this.blob(blob.container, blob.name);
      let etag = blob.etag;
      if (blob.uncommitted) {
        const current = await client.getBlockList("all");
        const blocks = (current.uncommittedBlocks ?? []).map(block => ({ name: block.name, size: block.size })).sort((left, right) => left.name.localeCompare(right.name));
        requireValue(current.etag === blob.etag && (current.committedBlocks ?? []).length === 0 && JSON.stringify(blocks) === JSON.stringify(blob.blocks), 409, "Uncommitted blocks changed. Generate a fresh cleanup report.");
        const empty = await client.commitBlockList([], { conditions: { ifNoneMatch: "*" } });
        etag = empty.etag;
      }
      await client.delete({ conditions: { ifMatch: etag } });
      return true;
    } catch (error) {
      if ((error.code ?? error.details?.errorCode) === "BlobNotFound") return false;
      throw error;
    }
  }
}

export class LocalBlobStore extends BlobStore {
  constructor(endpoint, account, key) {
    const url = new URL(endpoint);
    requireValue(url.protocol === "http:" && url.hostname === "127.0.0.1" && !url.username && !url.password, 400, "This adapter only accepts a loopback Azurite endpoint.");
    super(new BlobServiceClient(endpoint, new StorageSharedKeyCredential(account, key), { retryOptions: { maxTries: 1 } }), "");
  }
}

// Entra ID only (the lab account disables Shared Key); blobs are isolated under a per-workspace prefix.
export class AzureBlobStore extends BlobStore {
  constructor(endpoint, prefix, credential = new AzureCliCredential()) {
    requireValue(typeof prefix === "string" && WORKSPACE_PREFIX.test(prefix), 400, "Invalid Azure workspace prefix.");
    super(new BlobServiceClient(azureEndpoint(endpoint), credential, { retryOptions: { maxTries: 1 } }), prefix);
  }

  async initialize() {
    for (const container of CONTAINERS) {
      requireValue(await this[container].exists(), 503, `Azure container '${container}' is missing. Deploy infra/media/lab.bicep first.`);
    }
  }
}

export const openBlobStore = config => config.kind === "azure"
  ? new AzureBlobStore(config.endpoint, config.prefix)
  : new LocalBlobStore(config.endpoint, config.account, config.key);