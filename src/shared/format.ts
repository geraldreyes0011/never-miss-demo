import { money } from "./currency";
import type { CurrencyCode } from "./types";

export const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

export const ini = (s: unknown) => (String(s).trim()[0] || "?").toUpperCase();

export interface TokenContext {
  biz: string;
  pres: string;
  accent: string;
  /** Resolved logo URL (path or data URI), or null. */
  logo: string | null;
  cur: string;
  customer: string;
  defaultCurrency?: CurrencyCode;
}

/** Every token story text may use. validate-content rejects anything else in braces. */
export const TOKEN_RE = /\{(biz|cust|presenter|accent|bizinitial|bizmark|p:\d+\|\d+)\}/g;

/** Resolve story text tokens: exact port of the reference tk(). */
export function tk(s: unknown, c: TokenContext): string {
  return String(s == null ? "" : s)
    .replace(/\{biz\}/g, esc(c.biz))
    .replace(/\{cust\}/g, esc(c.customer || "Maya"))
    .replace(/\{presenter\}/g, esc(c.pres))
    .replace(/\{accent\}/g, c.accent)
    .replace(/\{bizinitial\}/g, ini(c.biz))
    .replace(/\{p:(\d+)\|(\d+)\}/g, (_m, a, b) => money(+a, +b, c.cur, c.defaultCurrency))
    .replace(/\{bizmark\}/g, c.logo ? `<img src="${c.logo}" alt="">` : esc(ini(c.biz)));
}

/** The text the voice-over records: {biz} -> "your business", markup stripped. Mirrors voice_multi.py clean(). */
export function voiceText(s: string, customer = "Maya"): string {
  return s
    .replace(/\{biz\}/g, "your business")
    .replace(/\{cust\}/g, customer)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
