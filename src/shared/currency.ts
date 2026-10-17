import type { CurrencyCode } from "./types";

export const CURS: Record<CurrencyCode, { s: string; r?: number; n: string }> = {
  USD: { s: "$", r: 1, n: "US dollar" },
  AUD: { s: "A$", r: 1.5, n: "Australian dollar" },
  CAD: { s: "C$", r: 1.37, n: "Canadian dollar" },
  GBP: { s: "£", r: 0.79, n: "British pound" },
  EUR: { s: "€", r: 0.92, n: "Euro" },
  NZD: { s: "NZ$", r: 1.65, n: "New Zealand dollar" },
  PHP: { s: "₱", n: "Philippine peso" },
};

export const CURRENCY_CODES = Object.keys(CURS) as CurrencyCode[];

export const isCurrency = (k: unknown): k is CurrencyCode => typeof k === "string" && k in CURS;

/** Format a price token {p:USD|PHP} in the given currency (port of the reference money()). */
export function money(usd: number, php: number, cur: string, fallback: CurrencyCode = "USD"): string {
  const k: CurrencyCode = isCurrency(cur) ? cur : fallback;
  let v = k === "PHP" ? php : usd * (CURS[k].r as number);
  const sym = CURS[k].s;
  if (v >= 100000) return sym + (v >= 1e6 ? Math.round(v / 1e5) / 10 + "M" : Math.round(v / 1e3) + "K");
  if (k !== "PHP" && k !== "USD")
    v = v >= 1000 ? Math.round(v / 50) * 50 : v >= 100 ? Math.round(v / 5) * 5 : Math.round(v);
  return sym + Math.round(v).toLocaleString("en-US");
}

export const currencyLabel = (k: CurrencyCode) => `${CURS[k].s} ${CURS[k].n}`;
