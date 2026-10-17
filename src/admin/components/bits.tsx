import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ini } from "../../shared/format";
import { useFocusTrap } from "../hooks";
import { Icon } from "./Icon";

/** Client logo on white, or the initial on the brand colour. Falls back to the initial if the image fails. */
export function LogoTile({
  src,
  name,
  accent,
  size = 40,
}: {
  src: string | null;
  name: string;
  accent: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (src && !broken)
    return (
      <span className="logo-tile img" style={style}>
        <img src={src} alt="" onError={() => setBroken(true)} />
      </span>
    );
  return (
    <span className="logo-tile" style={{ ...style, background: accent || "#64748B" }} aria-hidden="true">
      {ini(name || "?")}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role={label ? "status" : undefined} aria-label={label} />;
}

/** Centred modal dialog with focus trap; Esc and the scrim close it. */
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useFocusTrap<HTMLDivElement>(true, onClose);
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-only" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function QrModal({
  link,
  name,
  file,
  onClose,
}: {
  link: string;
  name: string;
  file: string;
  onClose: () => void;
}) {
  const [png, setPng] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(link, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0F172A", light: "#FFFFFF" },
    })
      .then(setPng)
      .catch(() => setPng(null));
  }, [link]);
  return (
    <Modal title={`QR code · ${name}`} onClose={onClose}>
      <div className="qr-body">
        <div className="qr-img">
          {png ? <img src={png} alt={`QR code for ${link}`} /> : <Spinner label="Generating QR code" />}
        </div>
        <code className="qr-link">{link}</code>
        <a
          className={`btn primary${png ? "" : " disabled"}`}
          href={png || undefined}
          download={`${file}-qr.png`}
          aria-disabled={!png}
        >
          <Icon name="download" />
          Download PNG
        </a>
      </div>
    </Modal>
  );
}

/** Inline "are you sure" row: focus lands on the safe choice. */
export function ConfirmRow({
  text,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => keep.current?.focus(), []);
  return (
    <div
      className="confirm-row"
      role="alertdialog"
      aria-label={text}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <span>{text}</span>
      <button className="btn danger sm" type="button" onClick={onConfirm} disabled={busy}>
        {busy ? <Spinner /> : <Icon name="trash" />}
        {confirmLabel}
      </button>
      <button className="btn sm" type="button" onClick={onCancel} ref={keep}>
        Keep
      </button>
    </div>
  );
}
