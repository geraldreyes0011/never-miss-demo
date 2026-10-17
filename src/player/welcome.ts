import { esc, ini } from "../shared/format";
import { ic } from "../shared/icons";
import VERDANT_SVG from "../../public/brand/verdant-logo.svg?raw";
import { $, st, T } from "./state";

/** Header branding plus the welcome brief, with tokens resolved. */
export function brand() {
  const S = st.S;
  document.documentElement.style.setProperty("--accent", S.accent);
  const pl = S.presLogo;
  $("pres").innerHTML =
    pl === "verdant"
      ? VERDANT_SVG
      : pl
        ? `<img src="${pl}" alt="${esc(S.pres)}">`
        : `<span class="by">Presented by</span><span class="wm">${esc(S.pres)}</span>`;
  const cl = $("clogo");
  if (S.logo) {
    cl.classList.add("img");
    cl.innerHTML = `<img src="${S.logo}" alt="${esc(S.biz)} logo">`;
  } else {
    cl.classList.remove("img");
    cl.textContent = ini(S.biz);
  }
  $("cname").textContent = S.biz;
  const w = st.demo.industries[st.IND].welcome;
  $("wTag").innerHTML = T(w.tag || "Customer journey demo for {biz}");
  $("wH").innerHTML = T(w.headline);
  $("wSub").innerHTML = T(w.sub);
  $("wPts").innerHTML = w.points.map((p) => `<li><span>${ic("check")}</span>${T(p)}</li>`).join("");
  $("wCta").textContent = T(w.cta || "Watch the 1-minute demo");
  $("wNote").innerHTML = T(w.note || "Sound on · Presented by {presenter}");
  document.title = `${S.biz} · ${st.demo.title}`;
}
