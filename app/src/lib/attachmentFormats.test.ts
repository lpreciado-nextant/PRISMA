import assert from "node:assert/strict";
import test from "node:test";
import { checkAttachment, formatBytes, formatOfMime } from "./attachmentFormats.ts";

const MB = 1024 * 1024;

test("each section accepts only its own formats, within the size limits", () => {
  assert.equal(checkAttachment({ name: "walkthrough.mp4", size: 300 * MB }, "Demo video").ok, true);
  assert.equal(checkAttachment({ name: "demo.html", size: 3 * MB }, "Interactive demo").ok, true);
  assert.equal(checkAttachment({ name: "deck.PPTX", size: 20 * MB }, "Supporting material").ok, true);
  const big = checkAttachment({ name: "deck.pdf", size: 26 * MB }, "Supporting material");
  assert.equal(big.ok, false);
  assert.match(!big.ok ? big.message : "", /26 MB; the limit is 25 MB/);
  assert.equal(checkAttachment({ name: "walkthrough.mp4", size: 501 * MB }, "Demo video").ok, false);
  assert.equal(checkAttachment({ name: "empty.pdf", size: 0 }, "Supporting material").ok, false);
});

test("Word, Excel and app projects get a way forward instead of a bare rejection", () => {
  const message = (name: string, purpose: Parameters<typeof checkAttachment>[1]) => { const result = checkAttachment({ name, size: 1000 }, purpose); return result.ok ? "" : result.message; };
  assert.match(message("notes.docx", "Supporting material"), /Word files can't be uploaded.*PDF.*link/);
  assert.match(message("model.xlsx", "Supporting material"), /Excel files can't be uploaded.*PDF.*link/);
  assert.match(message("app.tsx", "Interactive demo"), /self-contained HTML file.*host them and add a link/);
  assert.match(message("archive.rar", "Supporting material"), /\.rar isn't supported/);
  assert.match(message("noextension", "Supporting material"), /This file isn't supported/);
});

test("a file in the wrong section says where it belongs", () => {
  const message = (name: string, purpose: Parameters<typeof checkAttachment>[1]) => { const result = checkAttachment({ name, size: 1000 }, purpose); return result.ok ? "" : result.message; };
  assert.match(message("slides.pdf", "Interactive demo"), /PDF files belong in Supporting material/);
  assert.match(message("demo.html", "Supporting material"), /HTML files belong in Interactive demo/);
  assert.match(message("clip.mp4", "Interactive demo"), /belong in Demo videos/);
});

test("how each format reaches viewers, and sizes read plainly", () => {
  assert.match(formatOfMime("text/html")!.how, /inside PRISMA/);
  assert.match(formatOfMime("application/pdf")!.how, /Downloaded/);
  assert.equal(formatOfMime("application/zip"), undefined);
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2.4 * MB), "2.4 MB");
  assert.equal(formatBytes(48 * MB), "48 MB");
});
