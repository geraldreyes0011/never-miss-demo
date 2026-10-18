import { useState } from "react";
import { CURRENCY_CODES, currencyLabel } from "../../shared/currency";
import type { CurrencyCode } from "../../shared/types";
import { useAdmin } from "../context";
import { tokenRemembered } from "../github";
import { useToast } from "../hooks";
import { Icon } from "./Icon";

export function SettingsPage() {
  const { gh, settings, setSettings, signOut, demo, state, reload } = useAdmin();
  const toast = useToast();
  const [cur, setCur] = useState<CurrencyCode>(settings.defaultCur);
  const [pres, setPres] = useState(settings.defaultPres);
  const remembered = tokenRemembered();
  return (
    <section className="page narrow">
      <div className="panel">
        <h2 className="panel-h">Repository</h2>
        <dl className="kv">
          <dt>Repo</dt>
          <dd>
            <a href={gh.repoUrl} target="_blank" rel="noreferrer">
              {gh.cfg.owner}/{gh.cfg.repo} <Icon name="external" />
            </a>
          </dd>
          <dt>Branch</dt>
          <dd>
            <code>{gh.cfg.branch}</code>
            {state && <span className="muted"> at {state.sha.slice(0, 7)}</span>}
          </dd>
          <dt>Access</dt>
          <dd>
            <span className="status-ok">
              <Icon name="check" /> Connected
            </span>{" "}
            ·{" "}
            {gh.local
              ? "using this computer's GitHub login"
              : remembered
                ? "token remembered on this device"
                : "token for this browser session only"}
          </dd>
          <dt>Content</dt>
          <dd>
            {state ? `${state.clients.length} client link(s)` : "Loading…"} · {demo.order.length} industries
          </dd>
        </dl>
        <div className="panel-foot">
          <button className="btn" type="button" onClick={reload}>
            Reload from GitHub
          </button>
          <span className="grow" />
          {!gh.local && (
            <button className="btn danger" type="button" onClick={() => signOut()}>
              <Icon name="logout" />
              Sign out
            </button>
          )}
        </div>
      </div>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          setSettings({ defaultCur: cur, defaultPres: pres.trim() || demo.presenter.name });
          toast("ok", "Settings saved on this device.");
        }}
      >
        <h2 className="panel-h">Defaults for new clients</h2>
        <p className="hint">Saved in this browser. Existing links don't change.</p>
        <div className="form">
          <div className="field">
            <label htmlFor="s-cur">Default currency</label>
            <select
              id="s-cur"
              className="input"
              value={cur}
              onChange={(e) => setCur(e.target.value as CurrencyCode)}
            >
              {CURRENCY_CODES.map((k) => (
                <option key={k} value={k}>
                  {currencyLabel(k)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-pres">Default presenter name</label>
            <input id="s-pres" className="input" value={pres} onChange={(e) => setPres(e.target.value)} />
            <p className="hint">
              “{demo.presenter.name}” shows the logo; any other name shows as a wordmark.
            </p>
          </div>
        </div>
        <div className="panel-foot">
          <span className="grow" />
          <button className="btn primary" type="submit">
            Save settings
          </button>
        </div>
      </form>
    </section>
  );
}
