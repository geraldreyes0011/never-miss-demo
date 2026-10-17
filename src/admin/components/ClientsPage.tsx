import { useEffect, useMemo, useRef, useState } from "react";
import { CURS } from "../../shared/currency";
import { linkFor } from "../../shared/content";
import type { Client } from "../../shared/types";
import { useAdmin } from "../context";
import { copyText, typingInField, useToast } from "../hooks";
import { ClientEditor } from "./ClientEditor";
import { Icon } from "./Icon";
import { ConfirmRow, LogoTile, QrModal } from "./bits";

type Sort = "newest" | "az";

export function ClientsPage() {
  const { demo, state, logoUrl, deleteClient, saving, online } = useAdmin();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [ind, setInd] = useState<string>("");
  const [sort, setSort] = useState<Sort>("newest");
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [qr, setQr] = useState<Client | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* Shortcuts: N = new client, / = focus search (Esc is handled by panels). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typingInField(e) || editing || qr) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setEditing("new");
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, qr]);

  const clients = useMemo(() => state?.clients ?? [], [state]);
  const label = (k: string) => demo.industries[k]?.label || k;
  const usedInds = useMemo(() => demo.order.filter((k) => clients.some((c) => c.ind === k)), [clients, demo]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = clients.map((c, i) => ({ c, i }));
    if (needle)
      list = list.filter(({ c }) => `${c.name} ${label(c.ind)} ${c.slug}`.toLowerCase().includes(needle));
    if (ind) list = list.filter(({ c }) => c.ind === ind);
    list.sort((a, b) => (sort === "az" ? a.c.name.localeCompare(b.c.name) : b.i - a.i));
    return list.map((x) => x.c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, q, ind, sort]);

  async function copy(c: Client) {
    if (await copyText(linkFor(c.slug))) {
      setCopied(c.slug);
      setTimeout(() => setCopied((s) => (s === c.slug ? null : s)), 1600);
      toast("ok", `Copied the link for ${c.name}.`);
    } else toast("err", "Couldn't copy. Select the link and press Cmd+C (or Ctrl+C).");
  }

  const loading = !state;
  return (
    <section className="page" aria-labelledby="clients-h">
      <div className="page-head">
        <div>
          <h2 id="clients-h" className="sr-only">
            Client links
          </h2>
          <p className="lead">
            Each client link opens the demo tailored to one business: their name, logo, colour, currency and
            industry story.
          </p>
        </div>
        <button
          className="btn primary"
          type="button"
          onClick={() => setEditing("new")}
          disabled={!online}
          aria-keyshortcuts="N"
        >
          <Icon name="plus" />
          New client
          <kbd>N</kbd>
        </button>
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input
            ref={searchRef}
            className="input"
            type="search"
            placeholder="Search clients or industries"
            aria-label="Search clients"
            aria-keyshortcuts="/"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setQ(""), (e.target as HTMLInputElement).blur())}
          />
          <kbd>/</kbd>
        </div>
        <label className="sort">
          <span>Sort</span>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">Newest first</option>
            <option value="az">A–Z</option>
          </select>
        </label>
      </div>
      {usedInds.length > 1 && (
        <div className="chips" role="group" aria-label="Filter by industry">
          <button type="button" className="chip" aria-pressed={!ind} onClick={() => setInd("")}>
            All <span>{clients.length}</span>
          </button>
          {usedInds.map((k) => (
            <button
              key={k}
              type="button"
              className="chip"
              aria-pressed={ind === k}
              onClick={() => setInd(ind === k ? "" : k)}
            >
              {label(k)} <span>{clients.filter((c) => c.ind === k).length}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="list" aria-busy="true" aria-label="Loading clients">
          {[0, 1, 2].map((i) => (
            <div key={i} className="row-card sk-row">
              <span className="skeleton sk-logo" />
              <span className="skeleton sk-line" />
              <span className="skeleton sk-line short" />
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="empty">
          <h3>No client links yet</h3>
          <p>
            Create one for each business you pitch. It takes about 30 seconds, and the link is ready to send
            as soon as it's live.
          </p>
          <button className="btn primary" type="button" onClick={() => setEditing("new")} disabled={!online}>
            <Icon name="plus" />
            New client
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty small">
          <p>
            No clients match{q ? ` “${q}”` : ""}
            {ind ? ` in ${label(ind)}` : ""}.
          </p>
          <button
            className="btn sm"
            type="button"
            onClick={() => {
              setQ("");
              setInd("");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="list" aria-label="Client links">
          {shown.map((c) => {
            const link = linkFor(c.slug);
            return (
              <li key={c.slug} className={`row-card${flash === c.slug ? " flash" : ""}`} data-slug={c.slug}>
                <div className="rc-main">
                  <LogoTile src={logoUrl(c.logo)} name={c.name} accent={c.accent} size={44} />
                  <div className="rc-info">
                    <b className="rc-name">{c.name}</b>
                    <span className="rc-meta">
                      <span className="accent-dot" style={{ background: c.accent }} aria-hidden="true" />
                      {label(c.ind)} · {CURS[c.cur || "USD"]?.s} {c.cur || "USD"} ·{" "}
                      {c.pres || demo.presenter.name}
                    </span>
                  </div>
                </div>
                <div className="rc-link">
                  <code title={link}>{link.replace(/^https?:\/\//, "")}</code>
                  <button
                    className="btn sm"
                    type="button"
                    onClick={() => copy(c)}
                    aria-label={`Copy link for ${c.name}`}
                  >
                    <Icon name={copied === c.slug ? "check" : "copy"} />
                    {copied === c.slug ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="rc-actions">
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => setQr(c)}
                    aria-label={`QR code for ${c.name}`}
                    title="QR code"
                  >
                    <Icon name="qr" />
                  </button>
                  <a
                    className="icon-btn"
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Preview ${c.name} in a new tab`}
                    title="Preview"
                  >
                    <Icon name="external" />
                  </a>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => setEditing(c)}
                    aria-label={`Edit ${c.name}`}
                    title="Edit"
                  >
                    <Icon name="pen" />
                  </button>
                  <button
                    className="icon-btn danger"
                    type="button"
                    onClick={() => setConfirm(c.slug)}
                    aria-label={`Delete ${c.name}`}
                    title="Delete"
                    disabled={!online}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
                {confirm === c.slug && (
                  <ConfirmRow
                    text={`Delete ${c.name}? Its link will stop working.`}
                    confirmLabel="Delete"
                    busy={saving}
                    onCancel={() => setConfirm(null)}
                    onConfirm={async () => {
                      setConfirm(null);
                      await deleteClient(c.slug);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ClientEditor
          client={editing === "new" ? null : editing}
          onClose={(saved) => {
            setEditing(null);
            if (saved) {
              setFlash(saved.slug);
              setTimeout(() => setFlash(null), 2400);
            }
          }}
        />
      )}
      {qr && <QrModal link={linkFor(qr.slug)} name={qr.name} file={qr.slug} onClose={() => setQr(null)} />}
    </section>
  );
}
