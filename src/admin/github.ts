import type { Client, General } from "../shared/types";

/* ---------- GitHub REST client: every admin save is one atomic commit via the Git Data API ---------- */

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

const API = "https://api.github.com";
const CFG_KEY = "jd-admin-repo";

/** Owner/repo come from VITE_GITHUB_OWNER / VITE_GITHUB_REPO; a local override is allowed when unset. */
export function repoConfig(): RepoConfig {
  const env = {
    owner: import.meta.env.VITE_GITHUB_OWNER || "",
    repo: import.meta.env.VITE_GITHUB_REPO || "",
  };
  let saved: Partial<RepoConfig> = {};
  try {
    saved = JSON.parse(localStorage.getItem(CFG_KEY) || "{}");
  } catch (e) {}
  return {
    owner: env.owner || saved.owner || "",
    repo: env.repo || saved.repo || "",
    branch: import.meta.env.VITE_GITHUB_BRANCH || "main",
  };
}
export const repoFromEnv = () => !!(import.meta.env.VITE_GITHUB_OWNER && import.meta.env.VITE_GITHUB_REPO);
export function saveRepoConfig(owner: string, repo: string) {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify({ owner, repo }));
  } catch (e) {}
}

export type ErrorKind =
  "auth" | "forbidden" | "rate" | "conflict" | "notfound" | "network" | "invalid" | "other";

export class GitHubError extends Error {
  constructor(
    public kind: ErrorKind,
    message: string,
    public status = 0,
    public retryAt?: Date,
  ) {
    super(message);
  }
  /** 401/403 mean the token is the problem: the admin is sent back to sign-in. */
  get signOut() {
    return this.kind === "auth" || this.kind === "forbidden";
  }
}

const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export interface FileChange {
  path: string;
  /** UTF-8 text content. */
  text?: string;
  /** Base64 binary content. */
  base64?: string;
  /** Remove the file in this commit. */
  remove?: boolean;
}

export interface RepoState {
  sha: string;
  clients: Client[];
  general: General;
}

export interface SaveResult {
  sha: string;
  url: string;
  state: RepoState;
}

export type DeployStatus =
  | { state: "idle" }
  | { state: "publishing"; sha: string; url?: string }
  | { state: "live"; at: Date; url?: string }
  | { state: "failed"; url?: string }
  | { state: "unknown"; reason: string; url?: string };

export class GitHub {
  constructor(
    private token: string,
    public cfg: RepoConfig,
    private fetcher: typeof fetch = (...a) => fetch(...a),
  ) {}

  get repoPath() {
    return `/repos/${this.cfg.owner}/${this.cfg.repo}`;
  }
  get repoUrl() {
    return `https://github.com/${this.cfg.owner}/${this.cfg.repo}`;
  }

  private async req<T = any>(
    method: string,
    path: string,
    body?: unknown,
    accept = "application/vnd.github+json",
  ): Promise<T> {
    if (typeof navigator !== "undefined" && navigator.onLine === false)
      throw new GitHubError("network", "You're offline. Reconnect, then try again.");
    let r: Response;
    try {
      r = await this.fetcher(API + path, {
        method,
        cache: "no-store",
        headers: {
          Accept: accept,
          Authorization: `Bearer ${this.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new GitHubError("network", "Couldn't reach GitHub. Check your connection and try again.");
    }
    if (r.ok) {
      if (r.status === 204) return undefined as T;
      return (accept.includes("raw") ? await r.text() : await r.json()) as T;
    }
    let msg = "";
    try {
      msg = ((await r.json()) as { message?: string }).message || "";
    } catch (e) {}
    const remaining = r.headers.get("x-ratelimit-remaining");
    if (r.status === 429 || (r.status === 403 && (remaining === "0" || /rate limit/i.test(msg)))) {
      const reset = Number(r.headers.get("x-ratelimit-reset")) * 1000;
      const retryAfter = Number(r.headers.get("retry-after")) * 1000;
      const at = new Date(reset || Date.now() + (retryAfter || 60000));
      throw new GitHubError(
        "rate",
        `GitHub's rate limit was reached. Try again at ${fmtTime(at)}.`,
        r.status,
        at,
      );
    }
    if (r.status === 401)
      throw new GitHubError(
        "auth",
        "GitHub didn't accept this token. It may have expired or been revoked. Sign in with a new token.",
        401,
      );
    if (r.status === 403)
      throw new GitHubError(
        "forbidden",
        method === "GET"
          ? "GitHub says this token can't read this repo. Check its repository access."
          : "GitHub says the token can't write to this repo. Give it Contents: Read and write.",
        403,
      );
    if (r.status === 404)
      throw new GitHubError("notfound", `Not found on GitHub (${path.split("?")[0]}).`, 404);
    if (r.status === 409 || (r.status === 422 && /fast.?forward|reference/i.test(msg)))
      throw new GitHubError("conflict", "The branch moved while saving.", r.status);
    if (r.status === 422)
      throw new GitHubError("invalid", `GitHub rejected the change: ${msg || "invalid request"}.`, 422);
    throw new GitHubError("other", `GitHub error ${r.status}${msg ? `: ${msg}` : ""}.`, r.status);
  }

  /** Validate the token by reading the repo. */
  async validate() {
    try {
      return await this.req<{
        full_name: string;
        private: boolean;
        default_branch: string;
        html_url: string;
      }>("GET", this.repoPath);
    } catch (e) {
      if (e instanceof GitHubError && e.kind === "notfound")
        throw new GitHubError(
          "forbidden",
          `Couldn't open ${this.cfg.owner}/${this.cfg.repo}. Check the repo name and that the token has access to it.`,
          404,
        );
      throw e;
    }
  }

  async headSha(): Promise<string> {
    const ref = await this.req<{ object: { sha: string } }>(
      "GET",
      `${this.repoPath}/git/ref/heads/${this.cfg.branch}`,
    );
    return ref.object.sha;
  }

  async readText(path: string, ref: string): Promise<string | null> {
    try {
      return await this.req<string>(
        "GET",
        `${this.repoPath}/contents/${path}?ref=${encodeURIComponent(ref)}`,
        undefined,
        "application/vnd.github.raw+json",
      );
    } catch (e) {
      if (e instanceof GitHubError && e.kind === "notfound") return null;
      throw e;
    }
  }

  /** Latest clients.json + general.json at the branch head. */
  async readState(sha?: string): Promise<RepoState> {
    const head = sha || (await this.headSha());
    const [c, g] = await Promise.all([
      this.readText("data/clients.json", head),
      this.readText("data/general.json", head),
    ]);
    const clients = c ? (JSON.parse(c) as Client[]) : [];
    const general = g ? (JSON.parse(g) as General) : null;
    return { sha: head, clients: Array.isArray(clients) ? clients : [], general: general || null };
  }

  async listDir(path: string, ref: string): Promise<string[]> {
    try {
      const items = await this.req<{ path: string }[]>(
        "GET",
        `${this.repoPath}/contents/${path}?ref=${encodeURIComponent(ref)}`,
      );
      return Array.isArray(items) ? items.map((i) => i.path) : [];
    } catch (e) {
      if (e instanceof GitHubError && e.kind === "notfound") return [];
      throw e;
    }
  }

  /** Steps 2–3: blobs, tree on top of base, commit, then fast-forward the branch. */
  private async commitFiles(
    baseSha: string,
    message: string,
    files: FileChange[],
  ): Promise<{ sha: string; url: string }> {
    const base = await this.req<{ tree: { sha: string } }>("GET", `${this.repoPath}/git/commits/${baseSha}`);
    const tree = await Promise.all(
      files.map(async (f) => {
        if (f.remove) return { path: f.path, mode: "100644", type: "blob", sha: null };
        const blob = await this.req<{ sha: string }>(
          "POST",
          `${this.repoPath}/git/blobs`,
          f.base64 != null
            ? { content: f.base64, encoding: "base64" }
            : { content: f.text ?? "", encoding: "utf-8" },
        );
        return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
      }),
    );
    const newTree = await this.req<{ sha: string }>("POST", `${this.repoPath}/git/trees`, {
      base_tree: base.tree.sha,
      tree,
    });
    const commit = await this.req<{ sha: string; html_url: string }>("POST", `${this.repoPath}/git/commits`, {
      message,
      tree: newTree.sha,
      parents: [baseSha],
    });
    await this.req("PATCH", `${this.repoPath}/git/refs/heads/${this.cfg.branch}`, {
      sha: commit.sha,
      force: false,
    });
    return { sha: commit.sha, url: commit.html_url };
  }

  /**
   * One save = one commit. `build` receives the latest repo state and returns the files to write, so
   * the change is always applied on top of what's there now. If the branch moved, retry once.
   */
  async save(
    build: (
      latest: RepoState,
    ) =>
      | Promise<{ message: string; files: FileChange[]; next: RepoState }>
      | { message: string; files: FileChange[]; next: RepoState },
  ): Promise<SaveResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const latest = await this.readState();
      const { message, files, next } = await build(latest);
      try {
        const c = await this.commitFiles(latest.sha, message, files);
        return { ...c, state: { ...next, sha: c.sha } };
      } catch (e) {
        if (e instanceof GitHubError && e.kind === "conflict" && attempt === 0) continue;
        if (e instanceof GitHubError && e.kind === "conflict")
          throw new GitHubError(
            "conflict",
            "Someone else saved at the same time. Reload to see the latest.",
            e.status,
          );
        throw e;
      }
    }
    throw new GitHubError("conflict", "Someone else saved at the same time. Reload to see the latest.");
  }

  /** Deploy workflow run for a commit (Actions: Read). */
  async deployFor(sha: string): Promise<DeployStatus> {
    try {
      const r = await this.req<{ workflow_runs: Run[] }>(
        "GET",
        `${this.repoPath}/actions/runs?head_sha=${sha}&per_page=20`,
      );
      return runStatus(pickDeploy(r.workflow_runs), sha);
    } catch (e) {
      if (e instanceof GitHubError && (e.kind === "forbidden" || e.kind === "notfound"))
        return {
          state: "unknown",
          reason: "Saved. Deploy status needs the token's Actions: Read permission.",
        };
      throw e;
    }
  }

  /** Most recent deploy on the branch, for the top-bar pill on load. */
  async latestDeploy(): Promise<DeployStatus> {
    try {
      const r = await this.req<{ workflow_runs: Run[] }>(
        "GET",
        `${this.repoPath}/actions/runs?branch=${encodeURIComponent(this.cfg.branch)}&per_page=20`,
      );
      const run = pickDeploy(r.workflow_runs);
      return run ? runStatus(run, run.head_sha) : { state: "idle" };
    } catch (e) {
      return { state: "idle" };
    }
  }
}

interface Run {
  name: string;
  path?: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  updated_at: string;
}

const pickDeploy = (runs: Run[] = []) =>
  runs.find((r) => (r.path || "").endsWith("deploy.yml") || /deploy/i.test(r.name || ""));

function runStatus(run: Run | undefined, sha: string): DeployStatus {
  if (!run) return { state: "publishing", sha };
  if (run.status !== "completed") return { state: "publishing", sha, url: run.html_url };
  if (run.conclusion === "success") return { state: "live", at: new Date(run.updated_at), url: run.html_url };
  if (run.conclusion === "cancelled" || run.conclusion === "skipped")
    return { state: "unknown", reason: "Deploy was superseded by a newer one.", url: run.html_url };
  return { state: "failed", url: run.html_url };
}

/* ---------- token storage: sessionStorage, plus localStorage only if "Remember on this device" ---------- */
const TOKEN_KEY = "jd-admin-token";
export function loadToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
  } catch (e) {
    return "";
  }
}
export function storeToken(token: string, remember: boolean) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    if (remember) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {}
}
export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {}
}
export const tokenRemembered = () => {
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return false;
  }
};
