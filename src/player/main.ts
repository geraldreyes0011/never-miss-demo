import "./styles.css";
import { loadContent } from "../shared/content";
import type { PreviewMessage } from "../shared/types";
import { initCustomize } from "./customize";
import { boot, initControls } from "./engine";
import { $, lsGet, st } from "./state";

/* Legacy keys from older versions: Customize used to persist; now it lasts for one visit only. */
try {
  Object.keys(localStorage).forEach((k) => {
    if (k.indexOf("jd-never-miss-") === 0 || k === "jd-ind" || k === "jd-cur") localStorage.removeItem(k);
  });
} catch (e) {}

st.prefs = Object.assign({ voice: true, music: true }, lsGet("jd-prefs") || {});

async function main() {
  try {
    st.content = await loadContent();
  } catch (e) {
    $("say").textContent = "This demo couldn't load. Check your connection and refresh the page.";
    document.body.dataset.ready = "1";
    return;
  }
  initCustomize();
  initControls();
  boot();
  // Reveal the page once, fully branded and in its real font, so nothing shifts as it loads.
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1000))]).catch(() => {});
  // The admin's live preview (?preview) opens on the branded page itself, not the welcome brief.
  if (!new URLSearchParams(location.search).has("preview")) $("welcome").hidden = false;
  document.body.dataset.ready = "1";

  window.addEventListener("hashchange", () => {
    boot();
  });

  /* Live preview from the admin: only accepted from this same origin, while framed. */
  window.addEventListener("message", (e: MessageEvent<PreviewMessage>) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== "jd-preview") return;
    const c = e.data.client;
    st.preview = c ? Object.assign({ slug: "" }, c, { general: c.general || !c.slug }) : null;
    boot();
  });
  if (window.parent !== window) window.parent.postMessage({ type: "jd-preview-ready" }, location.origin);
}

main();
