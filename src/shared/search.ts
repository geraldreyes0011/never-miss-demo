import type { Demo, IndustryId } from "./types";

const STOP = [
  "and",
  "the",
  "a",
  "for",
  "my",
  "of",
  "in",
  "business",
  "company",
  "services",
  "service",
  "shop",
];

/** Trigram Jaccard similarity, with word-boundary padding. */
export function tri(a: string, b: string): number {
  const g = (x: string) => {
    x = " " + x + " ";
    const r = new Set<string>();
    for (let i = 0; i < x.length - 2; i++) r.add(x.slice(i, i + 3));
    return r;
  };
  const A = g(a),
    B = g(b);
  let n = 0;
  A.forEach((x) => {
    if (B.has(x)) n++;
  });
  return n / (A.size + B.size - n);
}

export interface Ranked {
  id: IndustryId;
  s: number;
}

/** Smart industry search: forgiving of vague words and typos. Port of the reference rankIndustries(). */
export function rankIndustries(demo: Pick<Demo, "order" | "industries">, q: string): Ranked[] {
  const qs = String(q).toLowerCase().trim();
  const words = qs.split(/[^a-z0-9]+/).filter((w) => w && !STOP.includes(w));
  return demo.order
    .map((id) => {
      const d = demo.industries[id];
      const hay = (d.label + " " + (d.kw || "")).toLowerCase();
      const toks = hay.split(/[^a-z0-9]+/).filter(Boolean);
      if (!words.length) return { id, s: 0 };
      let tot = 0;
      for (const w of words) {
        let best = 0;
        for (const t of toks) {
          let v: number;
          if (t === w) v = 3;
          else if (w.length >= 3 && t.startsWith(w)) v = 2.4;
          else if (t.length >= 4 && w.startsWith(t)) v = 2;
          else if (w.length >= 4 && t.includes(w)) v = 1.6;
          else v = tri(w, t) * 2.2;
          if (v > best) best = v;
        }
        tot += best;
      }
      let sc = tot / words.length;
      if (qs.length >= 3 && (" " + hay + " ").includes(" " + qs + " ")) sc += 1.2;
      return { id, s: sc };
    })
    .sort((a, b) => b.s - a.s || demo.order.indexOf(a.id) - demo.order.indexOf(b.id));
}

/** Below this top score the picker says "No exact match. Closest industries:". */
export const WEAK_MATCH = 1.15;
