import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = await build({
  root,
  configFile: false,
  publicDir: false,
  plugins: [react(), tailwindcss()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    write: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(root, "src/presentation/SubmissionPresentation.tsx"),
      name: "PrismaSubmission",
      formats: ["iife"],
    },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output);
const script = outputs.filter((output) => output.type === "chunk").map((output) => output.code).join("\n");
const css = outputs.filter((output) => output.type === "asset" && output.fileName.endsWith(".css")).map((output) => String(output.source)).join("\n");
if (!script || !css) throw new Error("Expected a JavaScript bundle and CSS for the standalone presentation.");
const sourceHtml = await readFile(resolve(root, "index.html"), "utf8");
const fontLinks = [...sourceHtml.matchAll(/<link\s[^>]*href="https:\/\/fonts\.[^>]+>/g)].map((match) => match[0]).join("\n");
const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="An interactive PRISMA submission walkthrough, built from the real PoC components with stage-by-stage explanations." />
<title>PRISMA | The submission flow</title>
${fontLinks}
<style>${css.replaceAll("</style", "<\\/style")}</style>
</head>
<body>
<div id="root"></div>
<noscript>This interactive presentation requires JavaScript.</noscript>
<script>${script.replaceAll("</script", "<\\/script")}</script>
</body>
</html>
`;
const destination = resolve(root, "../presentation/submission.html");
await mkdir(resolve(root, "../presentation"), { recursive: true });
await writeFile(destination, html);
console.log(`Standalone presentation: ${destination} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);