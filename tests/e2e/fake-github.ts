import type { Page, Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** In-memory GitHub REST API (repo, contents, Git Data, Actions runs) for admin e2e tests. */
type File = { text?: string; base64?: string };
type Tree = Map<string, File>;

export interface RecordedCommit {
  sha: string;
  message: string;
  parent: string;
  /** Tree entries sent with the commit: sha null = delete. */
  entries: { path: string; sha: string | null; content?: File }[];
}

const root = resolve(import.meta.dirname, "../..");
let n = 0;
const sha = (p: string) => `${p}${(++n).toString(16).padStart(6, "0")}`;

export class FakeGitHub {
  owner = "test-owner";
  repo = "test-repo";
  token = "github_pat_test";
  head: string;
  trees = new Map<string, Tree>();
  commits = new Map<string, { tree: string; parent: string; message: string }>();
  blobs = new Map<string, File>();
  recorded: RecordedCommit[] = [];
  refUpdates = 0;
  /** Simulate another admin saving first: the next ref update fails once after applying this commit. */
  interloper: ((tree: Tree) => void) | null = null;

  constructor() {
    const tree: Tree = new Map();
    tree.set("data/clients.json", { text: readFileSync(resolve(root, "data/clients.json"), "utf8") });
    tree.set("data/general.json", { text: readFileSync(resolve(root, "data/general.json"), "utf8") });
    for (const c of JSON.parse(tree.get("data/clients.json")!.text!)) {
      if (c.logo?.startsWith("logos/"))
        tree.set(`public/${c.logo}`, {
          base64: readFileSync(resolve(root, "public", c.logo)).toString("base64"),
        });
    }
    const t = sha("t");
    this.trees.set(t, tree);
    this.head = sha("c");
    this.commits.set(this.head, { tree: t, parent: "", message: "initial" });
  }

  treeAt(commit: string): Tree {
    return this.trees.get(this.commits.get(commit)!.tree)!;
  }
  file(path: string, commit = this.head) {
    return this.treeAt(commit).get(path);
  }
  json(path: string, commit = this.head) {
    return JSON.parse(this.file(path, commit)!.text!);
  }

  private commitDirect(message: string, edit: (t: Tree) => void) {
    const tree = new Map(this.treeAt(this.head));
    edit(tree);
    const t = sha("t");
    this.trees.set(t, tree);
    const c = sha("c");
    this.commits.set(c, { tree: t, parent: this.head, message });
    this.head = c;
  }

  async install(page: Page) {
    await page.route("https://api.github.com/**", (route) => this.handle(route));
  }

  private async handle(route: Route) {
    const req = route.request();
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type,x-github-api-version,accept",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    };
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: { ...cors, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (req.headers()["authorization"] !== `Bearer ${this.token}`)
      return json(401, { message: "Bad credentials" });

    const url = new URL(req.url());
    const base = `/repos/${this.owner}/${this.repo}`;
    const p = url.pathname;
    const m = req.method();
    const body = req.postData() ? JSON.parse(req.postData()!) : null;

    if (m === "GET" && p === base)
      return json(200, {
        full_name: `${this.owner}/${this.repo}`,
        private: false,
        default_branch: "main",
        html_url: `https://github.com${base}`,
      });
    if (!p.startsWith(base + "/")) return json(404, { message: "Not Found" });
    const rest = p.slice(base.length + 1);

    if (m === "GET" && rest === "git/ref/heads/main") return json(200, { object: { sha: this.head } });
    if (m === "GET" && rest.startsWith("contents/")) {
      const path = decodeURIComponent(rest.slice("contents/".length));
      const tree = this.treeAt(url.searchParams.get("ref") || this.head);
      const f = tree.get(path);
      if (f?.text != null)
        return route.fulfill({
          status: 200,
          headers: { ...cors, "content-type": "text/plain" },
          body: f.text,
        });
      const dir = [...tree.keys()]
        .filter((k) => k.startsWith(path + "/"))
        .map((k) => ({ path: k, type: "file" }));
      return dir.length ? json(200, dir) : json(404, { message: "Not Found" });
    }
    if (m === "GET" && rest.startsWith("git/commits/")) {
      const c = this.commits.get(rest.slice("git/commits/".length));
      return c
        ? json(200, { sha: rest.slice(12), tree: { sha: c.tree } })
        : json(404, { message: "Not Found" });
    }
    if (m === "POST" && rest === "git/blobs") {
      const s = sha("b");
      this.blobs.set(s, body.encoding === "base64" ? { base64: body.content } : { text: body.content });
      return json(201, { sha: s });
    }
    if (m === "POST" && rest === "git/trees") {
      const tree = new Map(this.trees.get(body.base_tree));
      for (const e of body.tree) {
        if (e.sha === null) {
          if (!tree.has(e.path)) return json(422, { message: "GitRPC::BadObjectState" });
          tree.delete(e.path);
        } else tree.set(e.path, this.blobs.get(e.sha)!);
      }
      const s = sha("t");
      this.trees.set(s, tree);
      (this as any)._lastEntries = body.tree;
      return json(201, { sha: s });
    }
    if (m === "POST" && rest === "git/commits") {
      const s = sha("c");
      this.commits.set(s, { tree: body.tree, parent: body.parents[0], message: body.message });
      this.recorded.push({
        sha: s,
        message: body.message,
        parent: body.parents[0],
        entries: ((this as any)._lastEntries || []).map((e: any) => ({
          path: e.path,
          sha: e.sha,
          content: e.sha ? this.blobs.get(e.sha) : undefined,
        })),
      });
      return json(201, { sha: s, html_url: `https://github.com${base}/commit/${s}` });
    }
    if (m === "PATCH" && rest === "git/refs/heads/main") {
      this.refUpdates++;
      if (this.interloper) {
        const edit = this.interloper;
        this.interloper = null;
        this.commitDirect("someone else", edit);
      }
      const c = this.commits.get(body.sha);
      if (!c || c.parent !== this.head) return json(422, { message: "Update is not a fast forward" });
      this.head = body.sha;
      return json(200, { object: { sha: body.sha } });
    }
    if (m === "GET" && rest === "actions/runs") {
      const head = url.searchParams.get("head_sha") || this.head;
      return json(200, {
        workflow_runs: [
          {
            name: "Deploy",
            path: ".github/workflows/deploy.yml",
            head_sha: head,
            status: "completed",
            conclusion: "success",
            html_url: `https://github.com${base}/actions/runs/1`,
            updated_at: new Date().toISOString(),
          },
        ],
      });
    }
    return json(404, { message: `Not Found: ${m} ${rest}` });
  }
}
