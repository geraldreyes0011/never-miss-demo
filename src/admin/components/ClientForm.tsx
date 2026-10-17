import { useEffect, useRef, useState } from "react";
import { CURRENCY_CODES, currencyLabel } from "../../shared/currency";
import type { Demo } from "../../shared/types";
import { ImageError, processLogo } from "../images";
import type { Draft } from "../ops";
import { Icon } from "./Icon";
import { IndustryPicker } from "./IndustryPicker";
import { Spinner } from "./bits";

export const SWATCHES = ["#1D4ED8", "#0F766E", "#7C3AED", "#B45309", "#BE123C", "#0E7490", "#111827"];
const HEX = /^#[0-9a-f]{6}$/i;

export function ClientForm({
  demo,
  draft,
  onChange,
  logoSrc,
  general,
  nameError,
  nameRef,
}: {
  demo: Demo;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  /** Resolved URL of the current logo (stored or uploaded). */
  logoSrc: string | null;
  general?: boolean;
  nameError?: string;
  nameRef?: React.Ref<HTMLInputElement>;
}) {
  const [logoErr, setLogoErr] = useState("");
  const [processing, setProcessing] = useState(false);
  const [drag, setDrag] = useState(false);
  const [hex, setHex] = useState(draft.accent);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setHex(draft.accent), [draft.accent]);
  const example = demo.industries[draft.ind]?.business.name || "";
  const presIsDefault = draft.pres.trim() === demo.presenter.name;

  async function take(file: File | undefined) {
    if (!file) return;
    setLogoErr("");
    setProcessing(true);
    try {
      onChange({ upload: await processLogo(file) });
    } catch (e) {
      setLogoErr(e instanceof ImageError ? e.message : "That image couldn't be processed. Try another file.");
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const setAccent = (c: string) => {
    setHex(c);
    onChange({ accent: c });
  };

  return (
    <div className="form">
      <div className="field">
        <label htmlFor="f-name">
          Business name
          {general ? (
            <span className="opt"> (optional)</span>
          ) : (
            <span className="req" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
        <input
          id="f-name"
          ref={nameRef}
          className={`input${nameError ? " invalid" : ""}`}
          type="text"
          value={draft.name}
          placeholder={
            general ? `Empty = each industry's example (e.g. ${example})` : "e.g. Joy Dental Clinic"
          }
          autoComplete="off"
          aria-required={!general}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? "f-name-err" : general ? "f-name-hint" : undefined}
          onChange={(e) => onChange({ name: e.target.value })}
          data-autofocus
        />
        {nameError && (
          <p className="field-err" id="f-name-err" role="alert">
            {nameError}
          </p>
        )}
        {general && !nameError && (
          <p className="hint" id="f-name-hint">
            Leave empty to show each industry's example business.
          </p>
        )}
      </div>

      <IndustryPicker demo={demo} value={draft.ind} onChange={(ind) => onChange({ ind })} id="f-ind" />

      <div className="field">
        <label htmlFor="f-cur">Currency</label>
        <select
          id="f-cur"
          className="input"
          value={draft.cur}
          onChange={(e) => onChange({ cur: e.target.value as Draft["cur"] })}
        >
          {CURRENCY_CODES.map((k) => (
            <option key={k} value={k}>
              {currencyLabel(k)}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="field">
        <legend>Brand colour</legend>
        <div className="swatches">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              className="swatch"
              style={{ background: c }}
              aria-label={`Colour ${c}`}
              aria-pressed={draft.accent.toLowerCase() === c.toLowerCase()}
              onClick={() => setAccent(c)}
            />
          ))}
          <label className="swatch custom" title="Custom colour">
            <span className="sr-only">Custom colour</span>
            <input
              type="color"
              value={HEX.test(draft.accent) ? draft.accent : "#1D4ED8"}
              onChange={(e) => setAccent(e.target.value)}
            />
          </label>
          <input
            className="input hex"
            aria-label="Colour hex code"
            value={hex}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value;
              setHex(v);
              if (HEX.test(v)) onChange({ accent: v });
            }}
            onBlur={() => setHex(draft.accent)}
          />
        </div>
      </fieldset>

      <div className="field">
        <span className="label" id="f-logo-lbl">
          Logo
        </span>
        <div
          className={`dropzone${drag ? " drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            take(e.dataTransfer.files[0]);
          }}
        >
          <div className="logo-preview" aria-hidden={!logoSrc}>
            {processing ? (
              <Spinner label="Processing logo" />
            ) : logoSrc ? (
              <img src={logoSrc} alt="Logo preview" />
            ) : (
              <Icon name="upload" />
            )}
          </div>
          <div className="dz-text">
            <b>Drop a logo here</b>
            <span>
              or{" "}
              <button type="button" className="linkish" onClick={() => fileRef.current?.click()}>
                browse
              </button>{" "}
              · PNG, JPG, WebP or SVG. Resized to 256 px.
            </span>
          </div>
          {logoSrc && (
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => onChange({ logo: null, upload: null })}
            >
              Remove
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-labelledby="f-logo-lbl"
            onChange={(e) => take(e.target.files?.[0])}
            tabIndex={-1}
          />
        </div>
        {logoErr && (
          <p className="field-err" role="alert">
            {logoErr}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="f-pres">Presented by</label>
        <input
          id="f-pres"
          className="input"
          type="text"
          value={draft.pres}
          autoComplete="off"
          aria-describedby="f-pres-hint"
          onChange={(e) => onChange({ pres: e.target.value })}
        />
        <p className="hint" id="f-pres-hint">
          {presIsDefault ? (
            <>Shows the {demo.presenter.name} logo.</>
          ) : (
            <>
              Shows as a wordmark: “PRESENTED BY {draft.pres.trim() || "…"}”.{" "}
              <button
                type="button"
                className="linkish"
                onClick={() => onChange({ pres: demo.presenter.name })}
              >
                Use {demo.presenter.name}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
