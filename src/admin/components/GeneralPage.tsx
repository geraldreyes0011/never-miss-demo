import { useMemo, useState } from "react";
import { linkFor } from "../../shared/content";
import type { General } from "../../shared/types";
import { useAdmin } from "../context";
import { copyText, useToast } from "../hooks";
import type { Draft } from "../ops";
import { ClientForm } from "./ClientForm";
import { Icon } from "./Icon";
import { LivePreview } from "./LivePreview";
import { ConfirmRow, QrModal, Spinner } from "./bits";

export function GeneralPage() {
  const { state } = useAdmin();
  if (!state)
    return (
      <section className="page" aria-busy="true">
        <div className="skeleton sk-block" />
      </section>
    );
  // Remount the form when the stored general link changes (after a save or reload).
  return <GeneralForm key={JSON.stringify(state.general)} general={state.general} />;
}

function GeneralForm({ general }: { general: General }) {
  const { demo, settings, saving, online, logoUrl, saveGeneral } = useAdmin();
  const toast = useToast();
  const initial = useMemo<Draft>(() => {
    const ind = general?.ind && demo.industries[general.ind] ? general.ind : demo.order[0];
    return {
      name: general?.name || "",
      ind,
      cur: general?.cur || settings.defaultCur,
      accent: general?.accent || demo.industries[ind].business.accent,
      pres: general?.pres || settings.defaultPres || demo.presenter.name,
      logo: general?.logo || null,
      presLogo: general?.presLogo || null,
    };
  }, [general, demo, settings]);
  const [draft, setDraft] = useState(initial);
  const [qr, setQr] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [accentTouched, setAccentTouched] = useState(!!general);
  const dirty =
    JSON.stringify({ ...draft, upload: draft.upload?.hash, presUpload: draft.presUpload?.hash }) !==
    JSON.stringify({ ...initial, upload: undefined, presUpload: undefined });
  const link = linkFor("");
  const logoSrc = draft.upload ? draft.upload.dataUrl : logoUrl(draft.logo);
  const presLogoSrc = draft.presUpload ? draft.presUpload.dataUrl : logoUrl(draft.presLogo);
  const example = demo.industries[draft.ind]?.business;

  const patch = (p: Partial<Draft>) => {
    if (p.accent) setAccentTouched(true);
    setDraft((d) => {
      const next = { ...d, ...p };
      if (p.ind && !accentTouched && !p.accent) next.accent = demo.industries[p.ind].business.accent;
      return next;
    });
  };
  const previewClient = useMemo(
    () => ({
      general: true,
      name: draft.name.trim(),
      ind: draft.ind,
      cur: draft.cur,
      accent: draft.accent,
      pres: draft.pres.trim() || demo.presenter.name,
      logo: logoSrc,
      presLogo: presLogoSrc,
    }),
    [draft, logoSrc, presLogoSrc, demo],
  );

  return (
    <section className="page" aria-labelledby="general-h">
      <div className="page-head">
        <div>
          <h2 id="general-h" className="sr-only">
            General link
          </h2>
          <p className="lead">
            Your main demo link, for anyone who isn't a specific client.{" "}
            {general
              ? "It's customised below."
              : `Right now it shows ${demo.industries[demo.order[0]].label} with its example business.`}
          </p>
        </div>
      </div>
      <div className="link-card">
        <Icon name="globe" />
        <code>{link.replace(/^https?:\/\//, "")}</code>
        <div className="link-card-actions">
          <button
            className="btn sm"
            type="button"
            onClick={async () => {
              const ok = await copyText(link);
              toast(
                ok ? "ok" : "err",
                ok ? "Copied the general link." : "Couldn't copy. Select the link and press Cmd+C.",
              );
            }}
          >
            <Icon name="copy" />
            Copy
          </button>
          <button className="btn sm" type="button" onClick={() => setQr(true)}>
            <Icon name="qr" />
            QR
          </button>
          <a className="btn sm" href={link} target="_blank" rel="noreferrer">
            <Icon name="external" />
            Preview
          </a>
        </div>
      </div>

      <form
        className="split"
        onSubmit={async (e) => {
          e.preventDefault();
          await saveGeneral({ ...draft, pres: draft.pres.trim() || demo.presenter.name });
        }}
      >
        <div className="panel">
          <ClientForm
            demo={demo}
            draft={draft}
            onChange={patch}
            logoSrc={logoSrc}
            presLogoSrc={presLogoSrc}
            general
          />
          {!draft.name.trim() && example && (
            <p className="hint">
              With no name, visitors see <b>{example.name}</b> for this industry.
            </p>
          )}
          <div className="panel-foot">
            {confirmReset ? (
              <ConfirmRow
                text="Reset to each industry's example business?"
                confirmLabel="Reset"
                busy={saving}
                onCancel={() => setConfirmReset(false)}
                onConfirm={async () => {
                  setConfirmReset(false);
                  await saveGeneral(null);
                }}
              />
            ) : (
              <>
                {general && (
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    disabled={saving || !online}
                  >
                    Reset to defaults
                  </button>
                )}
                <span className="grow" />
                <button
                  className="btn"
                  type="button"
                  disabled={!dirty || saving}
                  onClick={() => setDraft(initial)}
                >
                  Discard
                </button>
                <button className="btn primary" type="submit" disabled={!dirty || saving || !online}>
                  {saving && <Spinner />}
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="panel">
          <LivePreview client={previewClient} />
        </div>
      </form>
      {qr && <QrModal link={link} name="General link" file="general" onClose={() => setQr(false)} />}
    </section>
  );
}
