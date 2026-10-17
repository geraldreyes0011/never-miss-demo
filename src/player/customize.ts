import { CURS, CURRENCY_CODES } from "../shared/currency";
import { esc } from "../shared/format";
import { rankIndustries, WEAK_MATCH } from "../shared/search";
import { rerender, save } from "./engine";
import { $, st } from "./state";
import { brand } from "./welcome";

/* ---------- "Customize": a quick preview for visitors, kept for this visit only ---------- */
export const SWATCHES = ["#1D4ED8", "#0F766E", "#7C3AED", "#B45309", "#BE123C", "#0E7490", "#111827"];

/** Smart industry combobox (port of the reference makePicker). */
export function makePicker(
  qId: string,
  listId: string,
  valId: string,
  onPick: ((id: string) => void) | null,
) {
  const q = $<HTMLInputElement>(qId),
    list = $(listId),
    val = $<HTMLInputElement>(valId);
  let items: string[] = [],
    act = 0;
  const label = (id: string) => (st.demo.industries[id] ? st.demo.industries[id].label : "");
  function paint() {
    [...list.querySelectorAll(".pk-it")].forEach((li, i) => {
      li.classList.toggle("act", i === act);
      li.setAttribute("aria-selected", String(i === act));
      if (i === act) q.setAttribute("aria-activedescendant", li.id);
    });
  }
  function render() {
    const demo = st.demo;
    const has = !!q.value.trim() && q.value !== label(val.value),
      r = rankIndustries(demo, has ? q.value : "");
    items = (has ? r.slice(0, 6) : r).map((x) => x.id);
    act = 0;
    const weak = has && r[0].s < WEAK_MATCH;
    list.innerHTML =
      (has
        ? `<li class="pk-note" role="presentation">${weak ? "No exact match. Closest industries:" : "Best matches"}</li>`
        : `<li class="pk-note" role="presentation">${demo.order.length} industries · type to search</li>`) +
      items
        .map(
          (id, i) =>
            `<li role="option" id="${listId}-${i}" data-id="${id}" class="pk-it" aria-selected="false"><span>${esc(label(id))}</span>${id === val.value ? "<em>current</em>" : ""}</li>`,
        )
        .join("");
    paint();
    list.hidden = false;
    q.setAttribute("aria-expanded", "true");
  }
  function close() {
    list.hidden = true;
    q.setAttribute("aria-expanded", "false");
    q.removeAttribute("aria-activedescendant");
    q.value = label(val.value);
  }
  function pick(id: string) {
    val.value = id;
    q.value = label(id);
    list.hidden = true;
    q.setAttribute("aria-expanded", "false");
    q.removeAttribute("aria-activedescendant");
    if (onPick) onPick(id);
  }
  q.addEventListener("focus", () => {
    q.select();
    render();
  });
  q.addEventListener("input", render);
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (list.hidden) {
        render();
        return;
      }
      act = (act + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      paint();
      const a = list.querySelectorAll(".pk-it")[act];
      if (a) a.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!list.hidden && items[act]) pick(items[act]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  });
  list.addEventListener("mousedown", (e) => {
    const li = (e.target as Element).closest<HTMLElement>(".pk-it");
    if (li) {
      e.preventDefault();
      pick(li.dataset.id as string);
    }
  });
  q.addEventListener("blur", () =>
    setTimeout(() => {
      if (!list.hidden) close();
    }, 150),
  );
  return {
    set(id: string) {
      val.value = id;
      q.value = label(id);
    },
  };
}

let pkInd: ReturnType<typeof makePicker> | null = null;

function modeNote() {
  const C = st.CLIENT;
  $("modeNote").textContent =
    C && C.general
      ? "Showing the general link. Changes here are only a preview on this device."
      : C
        ? `Showing the link for ${C.name || st.S.biz}. Changes here are only a preview on this device.`
        : "Changes here are just for this visit and reset when you reopen the link.";
}

function fill() {
  const S = st.S;
  $<HTMLInputElement>("inPres").value = S.pres;
  $<HTMLInputElement>("inBiz").value = S.biz;
  $<HTMLInputElement>("inColor").value = S.accent;
  pkInd?.set(st.IND);
  $<HTMLSelectElement>("inCur").value = S.cur;
}

/** Called by boot() whenever the active demo changes. */
export function refreshCustomize() {
  modeNote();
  if ($("drawer").classList.contains("open")) fill();
}

function changed() {
  save();
  brand();
  rerender();
}

const readImg = (input: HTMLInputElement, cb: (d: string) => void) => {
  const f = input.files && input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => cb(r.result as string);
  r.readAsDataURL(f);
};

let lastFocus: HTMLElement | null = null;
const openD = () => {
  lastFocus = document.activeElement as HTMLElement | null;
  $("drawer").classList.add("open");
  $("drawer").removeAttribute("inert");
  $("scrim").hidden = false;
  fill();
  setTimeout(() => $("btnClose").focus(), 50);
};
export function closeD() {
  const d = $("drawer");
  if (!d.classList.contains("open")) return;
  d.classList.remove("open");
  d.setAttribute("inert", "");
  $("scrim").hidden = true;
  lastFocus?.focus?.();
}

export function initCustomize() {
  const demo = st.demo;
  const swatchHTML = SWATCHES.map(
    (c) => `<button type="button" style="background:${c}" data-c="${c}" aria-label="Colour ${c}"></button>`,
  ).join("");
  $("swatches").insertAdjacentHTML("afterbegin", swatchHTML);
  $("inCur").innerHTML = CURRENCY_CODES.map(
    (k) => `<option value="${k}">${CURS[k].s} ${CURS[k].n}</option>`,
  ).join("");
  pkInd = makePicker("inIndQ", "inIndList", "inInd", (id) => {
    location.hash = id;
  });
  const S = () => st.S;
  $("inCur").addEventListener("change", (e) => {
    S().cur = (e.target as HTMLSelectElement).value;
    changed();
  });
  $("inPres").addEventListener("input", (e) => {
    const s = S();
    s.pres = (e.target as HTMLInputElement).value.trim() || st.DEF.pres;
    if (s.pres !== demo.presenter.name && s.presLogo === "verdant") s.presLogo = "";
    changed();
  });
  $("inBiz").addEventListener("input", (e) => {
    S().biz = (e.target as HTMLInputElement).value.trim() || st.DEF.biz;
    changed();
  });
  $("inColor").addEventListener("input", (e) => {
    S().accent = (e.target as HTMLInputElement).value;
    changed();
  });
  $("swatches").addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("button[data-c]");
    if (b) {
      S().accent = b.dataset.c as string;
      $<HTMLInputElement>("inColor").value = S().accent;
      changed();
    }
  });
  $("inLogo").addEventListener("change", (e) =>
    readImg(e.target as HTMLInputElement, (d) => {
      S().logo = d;
      changed();
    }),
  );
  $("btnNoLogo").onclick = () => {
    S().logo = null;
    $<HTMLInputElement>("inLogo").value = "";
    changed();
  };
  $("inPresLogo").addEventListener("change", (e) =>
    readImg(e.target as HTMLInputElement, (d) => {
      S().presLogo = d;
      changed();
    }),
  );
  $("btnPresDefault").onclick = () => {
    S().pres = demo.presenter.name;
    S().presLogo = demo.presenter.logo || "";
    $<HTMLInputElement>("inPresLogo").value = "";
    fill();
    changed();
  };
  $("btnPresText").onclick = () => {
    S().presLogo = "";
    $<HTMLInputElement>("inPresLogo").value = "";
    changed();
  };
  $("btnReset").onclick = () => {
    st.S = Object.assign({}, st.DEF);
    $<HTMLInputElement>("inLogo").value = "";
    $<HTMLInputElement>("inPresLogo").value = "";
    fill();
    changed();
  };
  $("btnCustom").onclick = openD;
  $("btnClose").onclick = closeD;
  $("scrim").onclick = closeD;
}
