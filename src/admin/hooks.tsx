import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { CurrencyCode } from "../shared/types";
import { Icon } from "./components/Icon";

/* ---------- toasts: bottom-right; success/info auto-dismiss after 4 s, errors stay until dismissed ---------- */
export type ToastKind = "ok" | "err" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  action?: { label: string; href?: string; run?: () => void };
}
type ToastFn = (kind: ToastKind, text: string, action?: Toast["action"]) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback<ToastFn>(
    (kind, text, action) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, kind, text, action }]);
      if (kind !== "err") setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications">
        <div aria-live="polite" className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === "err" ? "alert" : "status"}>
              <Icon name={t.kind === "err" ? "alert" : t.kind === "ok" ? "check" : "info"} />
              <span className="toast-text">{t.text}</span>
              {t.action &&
                (t.action.href ? (
                  <a className="toast-act" href={t.action.href} target="_blank" rel="noreferrer">
                    {t.action.label}
                  </a>
                ) : (
                  <button
                    className="toast-act"
                    type="button"
                    onClick={() => {
                      t.action?.run?.();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                ))}
              <button className="toast-x" type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <Icon name="x" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- focus trap for modals and slide-overs; restores focus on close ---------- */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(active: boolean, onEscape?: () => void) {
  const ref = useRef<T>(null);
  const esc = useRef(onEscape);
  esc.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const prev = document.activeElement as HTMLElement | null;
    const first =
      el.querySelector<HTMLElement>("[data-autofocus]") || el.querySelector<HTMLElement>(FOCUSABLE);
    setTimeout(() => (first || el).focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && esc.current && !e.defaultPrevented) {
        e.preventDefault();
        esc.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const a = items[0],
        z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [active]);
  return ref;
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/* ---------- admin settings (this device) ---------- */
export interface AdminSettings {
  defaultCur: CurrencyCode;
  defaultPres: string;
}
const SETTINGS_KEY = "jd-admin-settings";
export function loadSettings(fallbackPres: string): AdminSettings {
  let s: Partial<AdminSettings> = {};
  try {
    s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch (e) {}
  return { defaultCur: s.defaultCur || "USD", defaultPres: s.defaultPres || fallbackPres };
}
export function storeSettings(s: AdminSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {}
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {}
    ta.remove();
    return ok;
  }
}

/** True while focus is in a text field (so single-key shortcuts don't fire). */
export const typingInField = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
};
