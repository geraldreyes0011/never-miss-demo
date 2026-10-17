import type { AudioMap, Client, Content, Demo, General } from "./types";

/** Site base path ("/" or "/<repo>/"). */
export const BASE: string = import.meta.env.BASE_URL || "/";

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Content lives in data/*.json and is fetched at runtime, so a content commit needs no code rebuild. */
export async function loadContent(): Promise<Content> {
  const [demo, audio, clients, general] = await Promise.all([
    getJson<Demo>("data/demo.json"),
    getJson<AudioMap>("data/audio-map.json"),
    getJson<Client[]>("data/clients.json").catch(() => [] as Client[]),
    getJson<General>("data/general.json").catch(() => null),
  ]);
  return { demo, audio, clients: Array.isArray(clients) ? clients : [], general: general || null };
}

/** Logos are relative repo paths ("logos/x.webp") or legacy data URIs; both must render. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(data:|blob:|https?:|\/)/.test(path)) return path;
  return BASE + path;
}

export const clipUrl = (id: string) => `${BASE}audio/${id}.mp3`;

/** Voice line key for a step (1-based) or "intro"/"outro". */
export const voiceKey = (ind: string, step: number) => `${ind}/s${step}`;

/** Absolute client-view link for a slug ("" = general link). */
export function linkFor(
  slug: string,
  origin = typeof location !== "undefined" ? location.origin : "",
): string {
  return origin + BASE + (slug ? "#" + slug : "");
}
