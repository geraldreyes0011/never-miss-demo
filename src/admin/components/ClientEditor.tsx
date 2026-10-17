import { useMemo, useRef, useState } from "react";
import { linkFor } from "../../shared/content";
import type { Client } from "../../shared/types";
import { useAdmin } from "../context";
import { useFocusTrap } from "../hooks";
import { newSlug, type Draft } from "../ops";
import { ClientForm } from "./ClientForm";
import { Icon } from "./Icon";
import { LivePreview } from "./LivePreview";
import { Spinner } from "./bits";

/** Slide-over panel to create or edit a client link, with a live preview of the unsaved state. */
export function ClientEditor({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: (saved?: Client) => void;
}) {
  const { demo, settings, state, saving, online, logoUrl, saveClient } = useAdmin();
  const initial = useMemo<Draft>(() => {
    if (client)
      return {
        name: client.name,
        ind: demo.industries[client.ind] ? client.ind : demo.order[0],
        cur: client.cur || demo.currency || "USD",
        accent: client.accent,
        pres: client.pres || demo.presenter.name,
        logo: client.logo,
      };
    const ind = demo.order[0];
    return {
      name: "",
      ind,
      cur: settings.defaultCur,
      accent: demo.industries[ind].business.accent,
      pres: settings.defaultPres || demo.presenter.name,
      logo: null,
    };
  }, [client, demo, settings]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [accentTouched, setAccentTouched] = useState(!!client);
  const [nameError, setNameError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const dirty =
    JSON.stringify({ ...draft, upload: draft.upload?.hash }) !==
    JSON.stringify({ ...initial, upload: undefined });

  const tryClose = () => {
    if (saving) return;
    if (dirty && !confirmClose) setConfirmClose(true);
    else onClose();
  };
  const ref = useFocusTrap<HTMLDivElement>(true, tryClose);

  const patch = (p: Partial<Draft>) => {
    setConfirmClose(false);
    if (p.accent) setAccentTouched(true);
    if (p.name !== undefined && nameError) setNameError("");
    setDraft((d) => {
      const next = { ...d, ...p };
      // A new client follows the industry's brand colour until a colour is picked.
      if (p.ind && !accentTouched && !p.accent) next.accent = demo.industries[p.ind].business.accent;
      return next;
    });
  };

  const slug = client
    ? client.slug
    : draft.name.trim()
      ? newSlug(draft.name, state?.clients || [], demo)
      : "";
  const logoSrc = draft.upload ? draft.upload.dataUrl : logoUrl(draft.logo);
  const previewClient = useMemo(
    () => ({
      slug: slug || "preview",
      name: draft.name.trim() || "Your business",
      ind: draft.ind,
      cur: draft.cur,
      accent: draft.accent,
      pres: draft.pres.trim() || demo.presenter.name,
      logo: logoSrc,
    }),
    [slug, draft, logoSrc, demo],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setNameError("Add the business name. It's used for the link and shown in the demo.");
      nameRef.current?.focus();
      return;
    }
    const saved = await saveClient(
      { ...draft, pres: draft.pres.trim() || demo.presenter.name },
      client?.slug,
    );
    if (saved) onClose(saved);
  }

  return (
    <div className="so-scrim" onMouseDown={(e) => e.target === e.currentTarget && tryClose()}>
      <div className="slideover" role="dialog" aria-modal="true" aria-labelledby="so-title" ref={ref}>
        <form className="so-inner" onSubmit={submit} noValidate>
          <header className="so-head">
            <div>
              <h2 id="so-title">{client ? `Edit ${client.name}` : "New client"}</h2>
              <p className="so-link">
                <Icon name="link" />
                {slug ? (
                  <span>
                    {linkFor(slug).replace(/^https?:\/\//, "")}
                    {client && <em> · link never changes</em>}
                  </span>
                ) : (
                  <span className="muted">The link is created from the business name</span>
                )}
              </p>
            </div>
            <button className="icon-only" type="button" aria-label="Close panel" onClick={tryClose}>
              <Icon name="x" />
            </button>
          </header>
          <div className="so-body">
            <div className="so-form">
              <ClientForm
                demo={demo}
                draft={draft}
                onChange={patch}
                logoSrc={logoSrc}
                nameError={nameError}
                nameRef={nameRef}
              />
            </div>
            <div className="so-preview">
              <LivePreview client={previewClient} />
            </div>
          </div>
          <footer className="so-foot">
            {confirmClose ? (
              <div className="confirm-row" role="alertdialog" aria-label="Discard unsaved changes?">
                <span>Discard unsaved changes?</span>
                <button className="btn danger sm" type="button" onClick={() => onClose()}>
                  Discard
                </button>
                <button className="btn sm" type="button" onClick={() => setConfirmClose(false)} autoFocus>
                  Keep editing
                </button>
              </div>
            ) : (
              <>
                <button className="btn" type="button" onClick={tryClose} disabled={saving}>
                  Cancel
                </button>
                <button
                  className="btn primary"
                  type="submit"
                  disabled={saving || !online}
                  title={online ? undefined : "You're offline"}
                >
                  {saving && <Spinner />}
                  {saving ? "Saving…" : client ? "Save changes" : "Create client link"}
                </button>
              </>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}
