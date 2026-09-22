import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { powerApps } from "@microsoft/power-apps-vite/plugin";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  publicDir: "../public",
  plugins: [react(), tailwindcss(), powerApps(), {
    name: "reject-poc-data",
    generateBundle() {
      for (const moduleId of this.getModuleIds()) {
        const path = moduleId.replaceAll("\\", "/");
        if (["/src/data/solutions.ts", "/src/lib/submissions.ts", "/src/lib/demoDoc.ts", "/src/App.tsx"].some(forbidden => path.endsWith(forbidden))) {
          this.error(`Connected build must not import PoC data: ${moduleId}`);
        }
      }
    },
  }],
  server: {
    host: "localhost",
    port: 5174,
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
  build: { outDir: "dist", emptyOutDir: true },
});