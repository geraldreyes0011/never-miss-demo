import { ini } from "../shared/format";
import { ic } from "../shared/icons";
import type { PhoneHeader, TimelineEvent } from "../shared/types";
import { $, st, T } from "./state";

/* ---------- the customer's phone: header, bubbles and owner alerts ---------- */
const bizAv = () =>
  st.S.logo
    ? `<div class="av"><img src="${st.S.logo}" alt=""></div>`
    : `<div class="av">${ini(st.S.biz)}</div>`;

export function headHTML(h?: PhoneHeader): string {
  h = h || { type: "chat" };
  switch (h.type) {
    case "search":
      return `<div class="search">${ic("search")}<span>${T(h.text)}</span></div>`;
    case "browser":
      return `<div class="url">${ic("lock")}<span>${T(h.url)}</span></div>`;
    case "sms":
      return `${bizAv()}<div><div class="t">${T(h.title || "{biz}")}</div><div class="s">${T(h.sub || "Text message")}</div></div>`;
    case "email":
      return `<div class="av" style="background:#0F172A">${ic("mail")}</div><div><div class="t">${T(h.title || "Inbox")}</div><div class="s">${T(h.sub || "Email")}</div></div>`;
    case "owner":
      return `<div class="av" style="background:#111827">${ini(h.title || st.S.pres)}</div><div><div class="t">${T(h.title || "{presenter} assistant")}</div><div class="s">${T(h.sub || "For the owner")}</div></div>`;
    case "custom":
      return T(h.html);
    default:
      return `${bizAv()}<div><div class="t">${T(h.title || "{biz}")}</div><div class="s"><b></b>${T(h.sub || "Replies instantly")}</div></div>`;
  }
}

export function phoneShow(i: number) {
  const s = st.ST[i];
  $("pTime").textContent = s.time || "9:41";
  $("pHead").innerHTML = headHTML(s.head);
  $("pBody").innerHTML = "";
  $("alerts").innerHTML = "";
  $("who").textContent = T(s.who || "Your customer's phone");
}

type Expanded = [number, string, any?];

/** "ai" becomes typing dots, then the reply 1 s later. */
export function expand(ev: TimelineEvent[]): Expanded[] {
  const out: Expanded[] = [];
  ev.forEach((e) => {
    if (e[1] === "ai") {
      out.push([e[0], "type"]);
      out.push([e[0] + 1, "untype", e[2]]);
    } else out.push(e);
  });
  return out.sort((a, b) => a[0] - b[0]);
}

const bubble = (cls: string, txt: string) => `<div class="b ${cls}">${T(txt)}</div>`;

export function apply(e: Expanded, silent: boolean) {
  const type = e[1],
    p = e[2],
    body = $("pBody");
  const add = (html: string) => {
    const w = document.createElement("div");
    w.innerHTML = html;
    const el = w.firstElementChild;
    if (!el) return;
    if (!silent) el.classList.add("pop");
    body.appendChild(el);
  };
  if (type === "me") add(bubble("me", p));
  else if (type === "them") add(bubble("them", p));
  else if (type === "untype") {
    const ty = body.querySelector(".typing");
    if (ty) ty.remove();
    add(bubble("them", p));
  } else if (type === "sys") add(`<div class="sys">${T(p)}</div>`);
  else if (type === "html") add(T(p));
  else if (type === "notif")
    add(
      `<div class="notif"><div class="ap">${ic(p.ic || "bell")}</div><div><b>${T(p.t)}</b><span class="mut">${T(p.s || "")}</span></div></div>`,
    );
  else if (type === "type") {
    if (!silent) add(`<div class="b them typing"><i></i><i></i><i></i></div>`);
  } else if (type === "tap") {
    const el = body.querySelector(`[data-tap="${p}"]`);
    if (el) {
      if (el.classList.contains("slot")) el.classList.add("sel");
      if (!silent) el.classList.add("tapped");
    }
  } else if (type === "clear") {
    body.innerHTML = "";
  } else if (type === "head") {
    $("pHead").innerHTML = headHTML(p);
  } else if (type === "who") {
    $("who").textContent = T(p);
  } else if (type === "time") {
    $("pTime").textContent = p;
  } else if (type === "alert") {
    const a = $("alerts");
    a.insertAdjacentHTML(
      "beforeend",
      `<div class="alert"${silent ? ' style="animation:none"' : ""}><div class="ic">${ic(p.ic)}</div><div><small>${T(p.small || "For you")}</small><b>${T(p.t)}</b></div></div>`,
    );
    while (a.children.length > 2) a.firstElementChild?.remove();
  }
  if (silent) body.scrollTop = body.scrollHeight;
  else body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
}
