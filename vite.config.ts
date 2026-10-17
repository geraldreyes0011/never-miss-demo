import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { resolve, join, normalize } from "node:path";

const root = __dirname;
const dataDir = resolve(root, "data");

/** Content in data/ is loaded at runtime (not bundled): serve it in dev, copy it to dist/data at build. */
function contentData(): Plugin {
  let outDir = resolve(root, "dist");
  return {
    name: "content-data",
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const base = server.config.base;
        const url = (req.url || "").split("?")[0];
        if (!url.startsWith(base + "data/")) return next();
        const file = normalize(join(dataDir, url.slice((base + "data/").length)));
        if (!file.startsWith(dataDir) || !existsSync(file)) return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      cpSync(dataDir, join(outDir, "data"), { recursive: true });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), contentData()],
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        admin: resolve(root, "admin/index.html"),
      },
    },
  },
  preview: { port: 4173 },
});
