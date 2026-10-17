import { useEffect, useRef, useState } from "react";
import { BASE } from "../../shared/content";
import type { PreviewMessage } from "../../shared/types";
import { Icon } from "./Icon";

const SIZES = { desktop: { w: 1366, h: 800 }, mobile: { w: 400, h: 860 } };

/**
 * A scaled iframe of the real client view. Unsaved changes are posted in with postMessage
 * ({type: "jd-preview", client}); the client view only accepts it from this same origin.
 */
export function LivePreview({ client }: { client: PreviewMessage["client"] }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<keyof typeof SIZES>("desktop");
  const [width, setWidth] = useState(480);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (
        e.origin === location.origin &&
        e.source === frame.current?.contentWindow &&
        e.data?.type === "jd-preview-ready"
      )
        setReady(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const msg: PreviewMessage = { type: "jd-preview", client };
      frame.current?.contentWindow?.postMessage(msg, location.origin);
    }, 120);
    return () => clearTimeout(t);
  }, [client, ready]);

  const { w, h } = SIZES[mode];
  const scale = mode === "desktop" ? width / w : Math.min(1, 520 / h, width / w);
  return (
    <div className="preview">
      <div className="preview-bar">
        <span className="preview-title">
          <span className="live-dot" aria-hidden="true" />
          Live preview
        </span>
        <div className="seg" role="group" aria-label="Preview size">
          <button type="button" aria-pressed={mode === "desktop"} onClick={() => setMode("desktop")}>
            <Icon name="monitor" />
            Desktop
          </button>
          <button type="button" aria-pressed={mode === "mobile"} onClick={() => setMode("mobile")}>
            <Icon name="phone" />
            Mobile
          </button>
        </div>
      </div>
      <div className="preview-box" ref={box} style={{ height: h * scale }}>
        <iframe
          ref={frame}
          title="Live preview of the client view"
          src={`${BASE}?preview=1`}
          style={{
            width: w,
            height: h,
            transform: `scale(${scale})`,
            left: mode === "mobile" ? (width - w * scale) / 2 : 0,
          }}
        />
        {!ready && <div className="preview-loading skeleton" />}
      </div>
      <p className="hint">Changes show here as you type. Nothing is published until you save.</p>
    </div>
  );
}
