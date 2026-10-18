import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assetUrl, linkFor, loadContent, siteUrl } from "../shared/content";
import type { AudioMap, Client, Demo } from "../shared/types";
import { AdminCtx, type AdminApi } from "./context";
import {
  clearToken,
  GitHub,
  GitHubError,
  loadToken,
  LOCAL_API,
  localAdminConfig,
  type DeployStatus,
  type RepoState,
} from "./github";
import { copyText, loadSettings, storeSettings, useOnline, useToast, type AdminSettings } from "./hooks";
import { deleteClient, newSlug, saveClient, saveGeneral, type Draft } from "./ops";
import { Shell } from "./components/Shell";
import { SignIn } from "./components/SignIn";
import { ClientsPage } from "./components/ClientsPage";
import { GeneralPage } from "./components/GeneralPage";
import { IndustriesPage } from "./components/IndustriesPage";
import { SettingsPage } from "./components/SettingsPage";

const routeOf = () => (location.hash || "#/clients").replace(/^#\/?/, "") || "clients";

export function App() {
  const [gh, setGh] = useState<GitHub | null>(null);
  const [notice, setNotice] = useState("");
  const signOut = useCallback((msg?: string) => {
    clearToken();
    setGh(null);
    setNotice(msg || "");
  }, []);
  const [checkingLocal, setCheckingLocal] = useState(import.meta.env.DEV);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    localAdminConfig().then((cfg) => {
      if (cfg) setGh(new GitHub("", cfg, undefined, LOCAL_API));
      setCheckingLocal(false);
    });
  }, []);
  if (checkingLocal)
    return (
      <div className="boot">
        <div className="skeleton boot-sk" aria-label="Loading" />
      </div>
    );
  if (!gh)
    return (
      <SignIn
        initialToken={loadToken()}
        notice={notice}
        onSignedIn={(g) => {
          setNotice("");
          setGh(g);
        }}
      />
    );
  return <Admin gh={gh} signOut={signOut} />;
}

function Admin({ gh, signOut }: { gh: GitHub; signOut: (notice?: string) => void }) {
  const toast = useToast();
  const online = useOnline();
  const [route, setRoute] = useState(routeOf);
  const [content, setContent] = useState<{ demo: Demo; audio: AudioMap } | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [state, setState] = useState<RepoState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deploy, setDeploy] = useState<DeployStatus>({ state: "idle" });
  const [settings, setSettingsState] = useState<AdminSettings>(() => loadSettings("Verdant Partners"));
  const logoCache = useRef(new Map<string, string>());
  const stateRef = useRef(state);
  stateRef.current = state;
  const reloadRef = useRef<() => void>(() => {});

  useEffect(() => {
    const on = () => setRoute(routeOf());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const fail = useCallback(
    (e: unknown, what: string) => {
      if (e instanceof GitHubError) {
        if (e.signOut) return signOut(e.message);
        if (e.kind === "conflict")
          return toast("err", e.message, { label: "Reload", run: () => reloadRef.current() });
        return toast("err", `${what}: ${e.message}`);
      }
      toast("err", `${what}. ${e instanceof Error ? e.message : ""}`.trim());
    },
    [signOut, toast],
  );

  const load = useCallback(() => {
    setState(null);
    gh.readState()
      .then(setState)
      .catch((e) => {
        setLoadErr(e instanceof GitHubError ? e.message : "Couldn't load clients from GitHub.");
        fail(e, "Couldn't load clients");
      });
  }, [gh, fail]);
  reloadRef.current = load;

  useEffect(() => {
    loadContent()
      .then((c) => setContent({ demo: c.demo, audio: c.audio }))
      .catch(() => setLoadErr("Couldn't load the demo content (data/demo.json)."));
    load();
    gh.latestDeploy().then((d) => setDeploy((cur) => (cur.state === "idle" ? d : cur)));
  }, [gh, load]);

  /* Deploy status: poll the Actions run for the commit every 5 s. */
  useEffect(() => {
    if (deploy.state !== "publishing") return;
    const started = Date.now();
    const sha = deploy.sha;
    const iv = setInterval(async () => {
      if (Date.now() - started > 10 * 60 * 1000) {
        setDeploy({
          state: "unknown",
          reason: "Still publishing after 10 minutes. Check GitHub Actions.",
          url: `${gh.repoUrl}/actions`,
        });
        return;
      }
      try {
        const d = await gh.deployFor(sha);
        if (d.state !== "publishing" || d.url !== deploy.url) setDeploy(d);
      } catch (e) {}
    }, 5000);
    return () => clearInterval(iv);
  }, [deploy, gh]);

  const logoUrl = useCallback(
    (p: string | null | undefined) => (p ? logoCache.current.get(p) || assetUrl(p) : null),
    [],
  );

  /** Optimistic update -> commit -> confirm with the server state, or roll back with an explanation. */
  const run = useCallback(
    async <T,>(
      optimistic: RepoState | null,
      what: string,
      op: () => Promise<{ sha: string; state: RepoState } & T>,
    ) => {
      if (!online) {
        toast("err", "You're offline. Reconnect to save.");
        return null;
      }
      const before = stateRef.current;
      if (optimistic) setState(optimistic);
      setSaving(true);
      try {
        const r = await op();
        setState(r.state);
        setDeploy({ state: "publishing", sha: r.sha });
        return r;
      } catch (e) {
        setState(before);
        fail(e, what);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [online, toast, fail],
  );

  const api = useMemo<AdminApi | null>(() => {
    if (!content) return null;
    const { demo, audio } = content;
    const remember = (path: string | null, d: Draft) => {
      if (path && d.upload) logoCache.current.set(path, d.upload.dataUrl);
    };
    return {
      demo,
      audio,
      gh,
      state,
      settings,
      setSettings: (s) => {
        storeSettings(s);
        setSettingsState(s);
      },
      online,
      saving,
      logoUrl,
      reload: load,
      signOut,
      navigate: (r) => {
        location.hash = "#/" + r;
      },
      async saveClient(draft, slug) {
        const cur = stateRef.current;
        let optimistic: RepoState | null = null;
        if (cur) {
          const s = slug || newSlug(draft.name, cur.clients, demo);
          const c: Client = {
            slug: s,
            name: draft.name.trim(),
            ind: draft.ind,
            cur: draft.cur,
            accent: draft.accent,
            pres: draft.pres.trim(),
            logo: draft.upload ? draft.upload.dataUrl : draft.logo,
          };
          const has = cur.clients.some((x) => x.slug === s);
          optimistic = {
            ...cur,
            clients: has ? cur.clients.map((x) => (x.slug === s ? c : x)) : [...cur.clients, c],
          };
        }
        const r = await run(optimistic, "Couldn't save", () => saveClient(gh, demo, draft, slug));
        if (!r) return null;
        remember(r.client.logo, draft);
        if (slug) toast("ok", `Saved “${r.client.name}”. It's live in about a minute.`);
        else {
          const copied = await copyText(linkFor(r.client.slug));
          toast("ok", copied ? "Client saved. Link copied." : "Client saved.");
        }
        return r.client;
      },
      async deleteClient(slug) {
        const cur = stateRef.current;
        const name = cur?.clients.find((c) => c.slug === slug)?.name || slug;
        const optimistic = cur ? { ...cur, clients: cur.clients.filter((c) => c.slug !== slug) } : null;
        const r = await run(optimistic, "Couldn't delete", () => deleteClient(gh, slug, name));
        if (r) toast("ok", `Deleted “${name}”. Its link stops working once the site updates.`);
        return !!r;
      },
      async saveGeneral(draft) {
        const cur = stateRef.current;
        const optimistic = cur
          ? {
              ...cur,
              general: draft
                ? {
                    name: draft.name.trim(),
                    ind: draft.ind,
                    cur: draft.cur,
                    accent: draft.accent,
                    pres: draft.pres.trim(),
                    logo: draft.upload ? draft.upload.dataUrl : draft.logo,
                  }
                : null,
            }
          : null;
        const r = await run(optimistic, "Couldn't save the general link", () => saveGeneral(gh, draft));
        if (r) {
          remember(r.state.general?.logo || null, draft as Draft);
          toast("ok", draft ? "General link saved." : "General link reset to each industry's example.");
        }
        return !!r;
      },
    };
  }, [content, gh, state, settings, online, saving, logoUrl, load, signOut, run, toast]);

  if (!api)
    return (
      <div className="boot">
        {loadErr ? (
          <div className="boot-err" role="alert">
            <b>{loadErr}</b>
            <button className="btn" type="button" onClick={() => location.reload()}>
              Try again
            </button>
          </div>
        ) : (
          <div className="skeleton boot-sk" aria-label="Loading" />
        )}
      </div>
    );

  const [page, sub] = route.split("/");
  return (
    <AdminCtx.Provider value={api}>
      <Shell route={page} deploy={deploy} liveUrl={siteUrl()}>
        {page === "general" ? (
          <GeneralPage />
        ) : page === "industries" ? (
          <IndustriesPage detail={sub} />
        ) : page === "settings" ? (
          <SettingsPage />
        ) : (
          <ClientsPage />
        )}
      </Shell>
    </AdminCtx.Provider>
  );
}
