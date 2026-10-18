import { assetUrl, voiceKey } from "../shared/content";
import { ic } from "../shared/icons";
import { Music } from "./music";
import { apply, expand, phoneShow } from "./phone";
import { $, lsSet, st, T, type ActiveClient, type Brand } from "./state";
import { lightAll, lightUpTo, preload, setSay, speak, stopAudio, stopWords, voice } from "./voice";
import { brand } from "./welcome";

/* ---------- playback engine: a faithful port of the reference player ---------- */
let t = 0,
  idx = 0,
  evs: ReturnType<typeof expand> = [],
  last = 0,
  stepTimer = 0;

export const savePrefs = () => lsSet("jd-prefs", st.prefs);

export function presFor(name?: string): Pick<Brand, "pres" | "presLogo"> {
  const P = st.demo.presenter;
  return !name || name === P.name ? { pres: P.name, presLogo: P.logo || "" } : { pres: name, presLogo: "" };
}

/** Which demo: #client-slug, #industry, or the general link (also for unknown hashes). */
export function boot() {
  const { demo, clients, general } = st.content;
  const h = decodeURIComponent((location.hash || "").slice(1)).toLowerCase();
  let CLIENT: ActiveClient = null;
  if (st.preview) CLIENT = st.preview;
  else {
    CLIENT = clients.find((c) => c.slug === h) || null;
    if (!CLIENT && general && !demo.industries[h])
      CLIENT = Object.assign({}, general, { slug: "", general: true, name: general.name || "" });
  }
  st.CLIENT = CLIENT;
  let IND = CLIENT ? CLIENT.ind || demo.order[0] : demo.industries[h] ? h : demo.order[0];
  if (!demo.industries[IND]) IND = demo.order[0];
  st.IND = IND;
  const d = demo.industries[IND];
  st.DEF = CLIENT
    ? Object.assign(
        // A custom presenter logo replaces the Verdant logo / name wordmark.
        CLIENT.presLogo
          ? { pres: CLIENT.pres || demo.presenter.name, presLogo: assetUrl(CLIENT.presLogo) as string }
          : presFor(CLIENT.pres),
        {
          biz: CLIENT.name || d.business.name,
          logo: assetUrl(CLIENT.logo),
          accent: CLIENT.accent || d.business.accent,
          cur: CLIENT.cur || demo.currency || "USD",
        },
      )
    : Object.assign(presFor(""), {
        biz: d.business.name,
        logo: null,
        accent: d.business.accent,
        cur: demo.currency || "USD",
      });
  st.S = Object.assign({}, st.DEF);
  st.ST = d.steps;
  stopAudio();
  stopWords();
  brand();
  intro();
}

function renderDots() {
  $("dots").innerHTML = st.ST.map(
    (s, i) =>
      `<button class="dot${i === st.cur ? " cur" : ""}${i < st.cur ? " done" : ""}" data-i="${i}" type="button"${i === st.cur ? ' aria-current="step"' : ""}><i></i>${i + 1}. ${T(s.name)}</button>`,
  ).join("");
}

export function go(i: number) {
  stopWords();
  const ST = st.ST;
  if (i >= ST.length) {
    outro();
    return;
  }
  st.cur = Math.max(0, i);
  const s = ST[st.cur];
  $("kicker").textContent = `Step ${st.cur + 1} of ${ST.length}`;
  setSay(T(s.say));
  $("lede").textContent = "";
  $("action").innerHTML = "";
  $("ctrls").hidden = false;
  $<HTMLButtonElement>("btnBack").disabled = st.cur === 0;
  renderDots();
  phoneShow(st.cur);
  evs = expand(s.ev);
  idx = 0;
  t = 0;
  stepTimer = 0;
  st.playing = true;
  last = performance.now();
  setPause();
  speak(voiceKey(st.IND, st.cur + 1));
  preload(st.cur + 1 < ST.length ? voiceKey(st.IND, st.cur + 2) : "outro");
}

/** Idle state: step 1 already finished behind the welcome brief, so the first frame is never empty. */
export function intro() {
  const demo = st.demo;
  st.cur = -1;
  st.playing = false;
  stopAudio();
  $("kicker").textContent = T(demo.intro.kicker || "A 1-minute demo");
  setSay(T(demo.intro.say));
  lightAll();
  $("lede").textContent = T(demo.intro.lede || "");
  $("action").innerHTML =
    `<button class="play" id="btnPlay" type="button"><span class="c"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg></span>Watch the demo</button>`;
  $("btnPlay").onclick = start;
  $("ctrls").hidden = true;
  renderDots();
  phoneShow(0);
  expand(st.ST[0].ev).forEach((e) => apply(e, true));
}

export function start() {
  const demo = st.demo;
  st.started = true;
  $("welcome").hidden = true;
  if (st.prefs.music) Music.start();
  $("action").innerHTML = "";
  $("kicker").textContent = T(demo.intro.kicker || "A 1-minute demo");
  setSay(T(demo.intro.say));
  st.playing = true;
  speak("intro", () => {
    if (st.cur < 0) go(0);
  });
  preload(voiceKey(st.IND, 1));
}

export function outro() {
  const o = st.demo.outro,
    ST = st.ST;
  st.cur = ST.length;
  st.playing = false;
  renderDots();
  $("kicker").textContent = T(o.kicker || "That's it");
  setSay(T(o.say));
  $("lede").textContent = "";
  $("action").innerHTML =
    `<div class="outcomes">${o.outcomes.map((x) => `<div class="oc"><b>${T(x.b)}</b><span>${T(x.s)}</span></div>`).join("")}</div>
   <div class="row wrap" style="margin-top:18px;gap:12px"><button class="play" id="btnAgain" type="button"><span class="c"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/></svg></span>Watch again</button><span class="small">${T(o.cta || "Next: let's set this up for your business.")}</span></div>`;
  $("btnAgain").onclick = () => {
    if (st.prefs.music) Music.start();
    go(0);
  };
  $("ctrls").hidden = true;
  $("alerts").innerHTML = (o.alerts || [])
    .map(
      (a, i) =>
        `<div class="alert" style="animation-delay:${i * 0.15}s"><div class="ic">${ic(a.ic)}</div><div><small>${T(a.small || "Always on")}</small><b>${T(a.t)}</b></div></div>`,
    )
    .join("");
  speak("outro", () =>
    setTimeout(() => {
      if (st.cur >= st.ST.length) Music.stop();
    }, 2500),
  );
  if (!st.prefs.voice) lightAll();
}

export function setPause() {
  $("btnPause").textContent = st.playing ? "Pause" : "Resume";
}

/** Re-render the current screen in its finished state after a branding change. */
export function rerender() {
  if (st.cur < 0) intro();
  else if (st.cur >= st.ST.length) outro();
  else {
    const s = st.ST[st.cur];
    setSay(T(s.say));
    lightAll();
    phoneShow(st.cur);
    expand(s.ev).forEach((e) => apply(e, true));
    idx = evs.length;
    st.playing = false;
    stopAudio();
    setPause();
  }
}

function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const player = voice.player;
  if (voice.hiOn && player.duration > 0)
    lightUpTo(player.currentTime / Math.max(0.5, player.duration - 0.35));
  if (st.playing && st.cur >= 0 && st.cur < st.ST.length) {
    t += dt;
    while (idx < evs.length && evs[idx][0] <= t) apply(evs[idx++], false);
    const end = evs.length ? evs[evs.length - 1][0] + 1.6 : 3;
    if (idx >= evs.length && t >= end && voice.speechDone) {
      stepTimer += dt;
      if (stepTimer > 0.7) go(st.cur + 1);
    }
  }
  requestAnimationFrame(loop);
}

/* ---------- controls ---------- */
function dismissWelcome() {
  if (!st.started) {
    st.started = true;
    $("welcome").hidden = true;
  }
}

function setToggles() {
  $("btnVoice").setAttribute("aria-pressed", String(st.prefs.voice));
  $("btnMusic").setAttribute("aria-pressed", String(st.prefs.music));
}

export function initControls() {
  $("btnNext").onclick = () => go(st.cur + 1);
  $("btnBack").onclick = () => go(st.cur - 1);
  $("btnPause").onclick = () => {
    st.playing = !st.playing;
    const player = voice.player;
    try {
      if (st.playing) {
        if (!voice.speechDone) player.play().catch(() => {});
        if (st.prefs.music) Music.start();
      } else {
        player.pause();
        Music.stop();
      }
    } catch (e) {}
    setPause();
  };
  $("dots").onclick = (e) => {
    const d = (e.target as Element).closest<HTMLElement>(".dot");
    if (d) {
      dismissWelcome();
      if (st.prefs.music) Music.start();
      go(+(d.dataset.i as string));
    }
  };
  $("btnVoice").onclick = () => {
    st.prefs.voice = !st.prefs.voice;
    savePrefs();
    if (!st.prefs.voice) {
      stopAudio();
      voice.speechDone = true;
      lightAll();
    }
    setToggles();
  };
  $("btnMusic").onclick = () => {
    st.prefs.music = !st.prefs.music;
    savePrefs();
    if (st.prefs.music && st.started && st.cur < st.ST.length) Music.start();
    else Music.stop();
    setToggles();
  };
  document.addEventListener("keydown", (e) => {
    const target = e.target as Element | null;
    if (target && target.closest && target.closest("input,select,textarea")) return;
    const welcomeOpen = !$("welcome").hidden;
    if (welcomeOpen && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      start();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (!st.started) {
        dismissWelcome();
        if (st.prefs.music) Music.start();
      }
      if (st.cur < 0) go(0);
      else go(st.cur + 1);
    } else if (e.key === "ArrowLeft" && st.cur > 0) {
      e.preventDefault();
      go(st.cur - 1);
    } else if (e.key === " ") {
      e.preventDefault();
      if (st.cur < 0) start();
      else if (st.cur < st.ST.length) $("btnPause").click();
    } else if (e.key === "Escape") {
      if (welcomeOpen) $("welcome").hidden = true;
    }
  });
  $("wPlay").onclick = start;
  $("wSkip").onclick = () => {
    $("welcome").hidden = true;
  };
  setToggles();
  requestAnimationFrame((n) => {
    last = n;
    loop(n);
  });
}
