import { clipUrl } from "../shared/content";
import { Music } from "./music";
import { $, st } from "./state";

/* ---------- voice: one reused <audio> element; captions highlight in sync ---------- */
const player = $<HTMLAudioElement>("voice");
player.preload = "auto";
const preloader = new Audio();
preloader.preload = "auto";

let wordTimer: ReturnType<typeof setInterval> | undefined;
let wordStarts: number[] = [];
let seq = 0;
export const voice = { speechDone: true, hiOn: false, player };

export function clip(key: string): string | null {
  const id = st.content.audio[key];
  return id ? clipUrl(id) : null;
}

/** Warm the cache for the next clip while the current step plays. */
export function preload(key: string) {
  const src = clip(key);
  if (src && st.prefs.voice && preloader.getAttribute("src") !== src) preloader.src = src;
}

export function setSay(text: string) {
  const el = $("say");
  el.innerHTML = text
    .split(" ")
    .map((w) => `<span class="w">${w}</span>`)
    .join(" ");
  const plain = el.textContent || "";
  let pos = 0;
  wordStarts = [...el.querySelectorAll(".w")].map((w) => {
    const f = pos / plain.length;
    pos += (w.textContent || "").length + 1;
    return f;
  });
}
export function lightAll() {
  document.querySelectorAll("#say .w").forEach((w) => w.classList.add("on"));
}
export function lightUpTo(f: number) {
  document.querySelectorAll("#say .w").forEach((w, i) => {
    if (wordStarts[i] <= f) w.classList.add("on");
  });
}
export function stopWords() {
  clearInterval(wordTimer);
}
function fallbackWords() {
  clearInterval(wordTimer);
  const sp = [...document.querySelectorAll("#say .w")];
  let i = 0;
  wordTimer = setInterval(
    () => {
      if (!st.playing) return;
      if (i < sp.length) sp[i++].classList.add("on");
      else clearInterval(wordTimer);
    },
    Math.max(150, 3800 / Math.max(1, sp.length)),
  );
}

export function stopAudio() {
  try {
    player.pause();
  } catch (e) {}
  voice.hiOn = false;
  Music.duck(false);
}

/** Play a voice line; on any failure fall back to timed captions so progress is never blocked. */
export function speak(key: string, onDone?: () => void) {
  clearInterval(wordTimer);
  stopAudio();
  const my = ++seq;
  let failed = false;
  const fail = () => {
    // Ignore late rejections from an earlier clip, and handle each failure once.
    if (failed || my !== seq) return;
    failed = true;
    voice.speechDone = true;
    voice.hiOn = false;
    Music.duck(false);
    fallbackWords();
    if (onDone) setTimeout(onDone, 3400);
  };
  const src = clip(key);
  if (!st.prefs.voice || !src) {
    fail();
    return;
  }
  voice.speechDone = false;
  voice.hiOn = true;
  Music.duck(true);
  player.onended = () => {
    if (my !== seq) return;
    voice.speechDone = true;
    voice.hiOn = false;
    Music.duck(false);
    lightAll();
    if (onDone) onDone();
  };
  player.onerror = fail;
  player.src = src;
  const pr = player.play();
  if (pr && pr.catch) pr.catch(fail);
}
