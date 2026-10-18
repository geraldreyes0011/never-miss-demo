import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
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

/** owner/repo of the GitHub remote, so the local admin needs no configuration. */
function gitRemote(): { owner: string; repo: string } | null {
  try {
    const url = execSync("git remote get-url origin", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    const m = /github\.com[:/]([^/]+)\/(.+?)(\.git)?$/.exec(url);
    return m ? { owner: m[1], repo: m[2] } : null;
  } catch (e) {
    return null;
  }
}
const remote = gitRemote();
if (remote) {
  process.env.VITE_GITHUB_OWNER ||= remote.owner;
  process.env.VITE_GITHUB_REPO ||= remote.repo;
  process.env.VITE_SITE_URL ||= `https://${remote.owner.toLowerCase()}.github.io/${remote.repo}/`;
}

/**
 * Local admin (npm run admin): the dev server forwards the admin's GitHub API calls and adds this
 * computer's GitHub CLI login, so there is no token to create or paste. The credential never leaves
 * this machine. Only same-origin requests carrying X-Demo-Admin, to this repo's API paths, are allowed.
 */
function localAdmin(): Plugin {
  let token = "";
  const getToken = () => {
    if (!token)
      token = execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    return token;
  };
  return {
    name: "local-admin",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/__github/")) return next();
        const deny = (status: number, message: string) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ message }));
        };
        const site = req.headers["sec-fetch-site"];
        if (req.headers["x-demo-admin"] !== "1" || (site && site !== "same-origin"))
          return deny(403, "Local admin requests must come from the admin page.");
        if (!remote) return deny(500, "This folder has no GitHub remote (git remote get-url origin).");
        const path = url.slice("/__github".length);
        if (path === "/status") {
          try {
            getToken();
            return res.end(JSON.stringify({ ok: true, ...remote }));
          } catch (e) {
            return deny(401, "GitHub CLI isn't signed in on this computer. Run: gh auth login");
          }
        }
        const repoPath = `/repos/${remote.owner}/${remote.repo}`;
        if (path !== repoPath && !path.startsWith(repoPath + "/") && !path.startsWith(repoPath + "?"))
          return deny(403, "Only this repository can be edited from the local admin.");
        let auth: string;
        try {
          auth = getToken();
        } catch (e) {
          return deny(401, "GitHub CLI isn't signed in on this computer. Run: gh auth login");
        }
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        try {
          const r = await fetch("https://api.github.com" + path, {
            method: req.method,
            headers: {
              Accept: String(req.headers["accept"] || "application/vnd.github+json"),
              "X-GitHub-Api-Version": "2022-11-28",
              Authorization: `Bearer ${auth}`,
              ...(chunks.length ? { "Content-Type": "application/json" } : {}),
            },
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          });
          res.statusCode = r.status;
          for (const h of ["content-type", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after"]) {
            const v = r.headers.get(h);
            if (v) res.setHeader(h, v);
          }
          res.end(Buffer.from(await r.arrayBuffer()));
        } catch (e) {
          deny(502, "Couldn't reach GitHub from this computer.");
        }
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), contentData(), localAdmin()],
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
