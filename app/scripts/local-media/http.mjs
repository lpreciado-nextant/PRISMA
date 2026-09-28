import { BLOCK_SIZE, MediaError, requireValue } from "./policy.mjs";

async function body(request, limit) {
  const parts = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    requireValue(size <= limit, 413, "Request body exceeds the local limit.");
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}

export function mediaHandler(service) {
  return async (request, response, next = () => { response.writeHead(404).end(); }) => {
    if (!request.url?.startsWith("/api/local-media/")) { next(); return; }
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    try {
      requireValue(request.socket.remoteAddress === "127.0.0.1" || request.socket.remoteAddress === "::ffff:127.0.0.1", 403, "Loopback access only.");
      const host = request.headers.host;
      requireValue(/^127\.0\.0\.1:\d+$/.test(host ?? "") && request.headers.origin === `http://${host}` && request.headers["x-prisma-local"] === "1", 403, "Same-origin local workbench access only.");
      requireValue(request.method === "POST", 405, "Use POST for local media operations.");
      const action = request.url.slice("/api/local-media/".length);
      requireValue(["create", "list", "read", "begin", "checkpoint", "block", "finish", "scan", "submit", "publish", "withdraw", "remove", "range"].includes(action), 404, "Unknown local endpoint.");
      let input;
      if (action === "block") {
        requireValue(request.headers["content-type"] === "application/octet-stream", 415, "A binary block is required.");
        input = JSON.parse(request.headers["x-local-command"] ?? "null");
        requireValue(input && typeof input === "object" && !Array.isArray(input), 400, "Invalid block command.");
        input.bytes = await body(request, BLOCK_SIZE);
      } else {
        requireValue(request.headers["content-type"] === "application/json", 415, "JSON is required.");
        input = JSON.parse((await body(request, 16 * 1024)).toString("utf8"));
        requireValue(input && typeof input === "object" && !Array.isArray(input), 400, "Invalid command.");
      }
      const result = await service.execute(request.headers["x-local-actor"], action, input);
      if (action === "range") {
        response.writeHead(200, {
          "Content-Type": "application/octet-stream", "Content-Length": result.bytes.length,
          "X-Media-Version": result.version, "X-Media-Size": result.size, "X-Media-Offset": result.offset,
        });
        response.end(Buffer.from(result.bytes));
      } else {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(result));
      }
    } catch (error) {
      const status = error instanceof MediaError ? error.status : error instanceof SyntaxError ? 400 : 502;
      const message = error instanceof MediaError ? error.message : error instanceof SyntaxError ? "Malformed JSON." : "Local storage operation failed. Reopen before retrying.";
      if (!response.destroyed) {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: message }));
      }
    }
  };
}