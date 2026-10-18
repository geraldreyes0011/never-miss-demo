import { useEffect, useRef, useState } from "react";
import { BASE } from "../../shared/content";
import { openAccount, type SealedAccount } from "../../shared/vault";
import {
  GitHub,
  GitHubError,
  repoConfig,
  repoFromEnv,
  saveRepoConfig,
  storeToken,
  tokenRemembered,
} from "../github";
import { Icon } from "./Icon";
import { Spinner } from "./bits";

export function SignIn({
  initialToken,
  notice,
  onSignedIn,
}: {
  initialToken: string;
  notice: string;
  onSignedIn: (gh: GitHub) => void;
}) {
  const cfg = repoConfig();
  const envRepo = repoFromEnv();
  const [owner, setOwner] = useState(cfg.owner);
  const [repo, setRepo] = useState(cfg.repo);
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(tokenRemembered());
  const [busy, setBusy] = useState(false);
  const [checkingSaved, setCheckingSaved] = useState(!!initialToken && !notice);
  const [error, setError] = useState(notice);
  const tokenRef = useRef<HTMLInputElement>(null);
  /** undefined while loading; null when no email & password sign-in has been set up yet. */
  const [account, setAccount] = useState<SealedAccount | null | undefined>(undefined);
  const [useToken, setUseToken] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const accountMode = !!account && !useToken;

  useEffect(() => {
    fetch(BASE + "data/admin-account.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => setAccount(a && a.v === 1 ? (a as SealedAccount) : null))
      .catch(() => setAccount(null));
  }, []);
  useEffect(() => {
    if (account === undefined || checkingSaved) return;
    (accountMode ? emailRef : tokenRef).current?.focus();
  }, [account, accountMode, checkingSaved]);

  async function signInWithPassword() {
    if (!account) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    const t = await openAccount(account, email, password);
    if (!t) {
      setBusy(false);
      setPassword("");
      setError("That email and password don't match. Check them and try again.");
      return;
    }
    attempt(t, remember);
  }

  async function attempt(t: string, rememberIt: boolean, silent = false) {
    if (!owner.trim() || !repo.trim()) {
      setError("Enter the repository owner and name.");
      return;
    }
    setBusy(true);
    setError("");
    const gh = new GitHub(t.trim(), { owner: owner.trim(), repo: repo.trim(), branch: cfg.branch });
    try {
      await gh.validate();
      storeToken(t.trim(), rememberIt);
      if (!envRepo) saveRepoConfig(owner.trim(), repo.trim());
      onSignedIn(gh);
    } catch (e) {
      setBusy(false);
      setCheckingSaved(false);
      if (!silent || !(e instanceof GitHubError && e.kind === "network"))
        setError(e instanceof GitHubError ? e.message : "Couldn't check the token. Try again.");
      setTimeout(() => (accountMode ? emailRef : tokenRef).current?.focus(), 0);
    }
  }

  useEffect(() => {
    if (initialToken && !notice) attempt(initialToken, tokenRemembered(), true);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newTokenUrl =
    "https://github.com/settings/personal-access-tokens/new?" +
    new URLSearchParams({
      name: "Demo admin",
      description: `Edits client links in ${owner || "<owner>"}/${repo || "<repo>"}`,
      ...(owner ? { target_name: owner } : {}),
      expires_in: "90",
      contents: "write",
      actions: "read",
    }).toString();

  if (checkingSaved || account === undefined)
    return (
      <main className="signin">
        <div className="signin-card center">
          <Spinner label="Loading" />
          <p className="muted">{checkingSaved ? "Signing you in…" : "Loading…"}</p>
        </div>
      </main>
    );

  return (
    <main className="signin">
      <div className="signin-card">
        <div className="signin-brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="lock" />
          </span>
          <div>
            <h1>Demo admin</h1>
            <p className="muted">Internal tool for managing client demo links.</p>
          </div>
        </div>
        {error && (
          <div className="banner err" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        )}
        {accountMode && (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              signInWithPassword();
            }}
          >
            <div className="field">
              <label htmlFor="si-email">Email</label>
              <input
                id="si-email"
                ref={emailRef}
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                spellCheck={false}
              />
            </div>
            <div className="field">
              <label htmlFor="si-password">Password</label>
              <input
                id="si-password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Keep me signed in on this device
            </label>
            <button className="btn primary lg" type="submit" disabled={busy}>
              {busy ? <Spinner /> : null}
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" className="linkish small-link" onClick={() => setUseToken(true)}>
              Use a GitHub token instead
            </button>
          </form>
        )}
        <form
          hidden={accountMode}
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!token.trim()) {
              setError("Paste your GitHub token first.");
              tokenRef.current?.focus();
              return;
            }
            attempt(token, remember);
          }}
        >
          {!envRepo && (
            <div className="row2">
              <div className="field">
                <label htmlFor="si-owner">Repository owner</label>
                <input
                  id="si-owner"
                  className="input"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="si-repo">Repository name</label>
                <input
                  id="si-repo"
                  className="input"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor="si-token">GitHub token</label>
            <input
              id="si-token"
              ref={tokenRef}
              className="input mono"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_…"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="hint">
              Repo: <b>{owner && repo ? `${owner}/${repo}` : "not set"}</b>. The token stays in this browser
              and is only sent to GitHub.
            </p>
          </div>
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember on this device
          </label>
          <button className="btn primary lg" type="submit" disabled={busy}>
            {busy ? <Spinner /> : null}
            {busy ? "Checking…" : "Sign in"}
          </button>
          {account && (
            <button type="button" className="linkish small-link" onClick={() => setUseToken(false)}>
              Sign in with email and password
            </button>
          )}
        </form>
        <details className="howto" open={!initialToken} hidden={accountMode}>
          <summary>How to create the token (2 minutes)</summary>
          <ol>
            <li>
              Open{" "}
              <a href={newTokenUrl} target="_blank" rel="noreferrer">
                GitHub → New fine-grained token <Icon name="external" />
              </a>
              .
            </li>
            <li>Name it “Demo admin” and pick an expiry (90 days is a good default).</li>
            <li>
              <b>Resource owner:</b> {owner || "the repo owner"}. <b>Repository access:</b> Only select
              repositories → <code>{owner && repo ? `${owner}/${repo}` : "this repo"}</code>.
            </li>
            <li>
              <b>Repository permissions:</b> Contents → <b>Read and write</b>; Actions → <b>Read-only</b>.
              (Metadata read-only is added automatically.)
            </li>
            <li>Click Generate token, copy it, and paste it above.</li>
          </ol>
        </details>
      </div>
    </main>
  );
}
