import { useEffect, useState, type ReactNode } from "react";
import { useAdmin } from "../context";
import type { DeployStatus } from "../github";
import { Icon } from "./Icon";

const NAV = [
  { id: "clients", label: "Client links", icon: "users" },
  { id: "general", label: "General link", icon: "globe" },
  { id: "industries", label: "Industries", icon: "grid" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const time = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function DeployPill({ d }: { d: DeployStatus }) {
  if (d.state === "idle") return null;
  if (d.state === "publishing")
    return (
      <a className="pill pill-busy" href={d.url} target="_blank" rel="noreferrer" aria-live="polite">
        <span className="spinner sm" aria-hidden="true" />
        Publishing…
      </a>
    );
  if (d.state === "live")
    return (
      <a
        className="pill pill-ok"
        href={d.url}
        target="_blank"
        rel="noreferrer"
        aria-live="polite"
        title="Last deploy succeeded"
      >
        <span className="dot" aria-hidden="true" />
        Live · {time(d.at)}
      </a>
    );
  if (d.state === "failed")
    return (
      <a className="pill pill-err" href={d.url} target="_blank" rel="noreferrer" aria-live="polite">
        <Icon name="alert" />
        Deploy failed · View run
      </a>
    );
  return (
    <a className="pill" href={d.url} target="_blank" rel="noreferrer" title={d.reason} aria-live="polite">
      <Icon name="info" />
      Saved
    </a>
  );
}

export function Shell({
  route,
  deploy,
  liveUrl,
  children,
}: {
  route: string;
  deploy: DeployStatus;
  liveUrl: string;
  children: ReactNode;
}) {
  const { gh, online, signOut } = useAdmin();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [route]);
  const title = NAV.find((n) => n.id === route)?.label || "Client links";
  return (
    <div className="shell">
      <button className="skip" type="button" onClick={() => document.getElementById("main")?.focus()}>
        Skip to content
      </button>
      <aside className={`side${menu ? " open" : ""}`}>
        <div className="side-head">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="link" />
          </span>
          <div className="brand-text">
            <b>Demo admin</b>
            <span>Never Miss a Customer</span>
          </div>
          <button
            className="icon-only menu-btn"
            type="button"
            aria-expanded={menu}
            aria-controls="side-nav"
            aria-label="Menu"
            onClick={() => setMenu(!menu)}
          >
            <Icon name={menu ? "x" : "menu"} />
          </button>
        </div>
        <nav id="side-nav" aria-label="Admin sections">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#/${n.id}`}
              className="nav-item"
              aria-current={route === n.id ? "page" : undefined}
            >
              <Icon name={n.icon} />
              {n.label}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <a className="repo-link" href={gh.repoUrl} target="_blank" rel="noreferrer">
            {gh.cfg.owner}/{gh.cfg.repo}
          </a>
          {gh.local ? (
            <span className="repo-link">Signed in on this computer</span>
          ) : (
            <button className="nav-item" type="button" onClick={() => signOut()}>
              <Icon name="logout" />
              Sign out
            </button>
          )}
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <h1 className="page-title">{title}</h1>
          <div className="topbar-right">
            <DeployPill d={deploy} />
            <a className="btn sm" href={liveUrl} target="_blank" rel="noreferrer">
              View live site
              <Icon name="external" />
            </a>
          </div>
        </header>
        {!online && (
          <div className="banner warn" role="status">
            <Icon name="wifi" />
            You're offline. Saving is paused until you reconnect.
          </div>
        )}
        <main id="main" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
