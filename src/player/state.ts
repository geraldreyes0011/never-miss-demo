import { tk, type TokenContext } from "../shared/format";
import type { Client, Content, CurrencyCode, Demo, IndustryId, Step } from "../shared/types";

/** What the page is currently branded as (the reference's S / DEF). */
export interface Brand {
  biz: string;
  pres: string;
  /** "verdant", an image URL, or "" for a wordmark. */
  presLogo: string;
  /** Resolved image URL or data URI. */
  logo: string | null;
  accent: string;
  cur: CurrencyCode | string;
}

export type ActiveClient = (Partial<Client> & { slug: string; general?: boolean }) | null;

export const st = {
  content: null as unknown as Content,
  get demo(): Demo {
    return st.content.demo;
  },
  CLIENT: null as ActiveClient,
  IND: "" as IndustryId,
  S: {} as Brand,
  DEF: {} as Brand,
  KEY: "",
  ST: [] as Step[],
  /** Unsaved client sent by the admin's live preview (postMessage). */
  preview: null as ActiveClient,
  prefs: { voice: true, music: true },
  cur: -1,
  playing: false,
  started: false,
};

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function tokenCtx(): TokenContext {
  const S = st.S;
  return {
    biz: S.biz,
    pres: S.pres,
    accent: S.accent,
    logo: S.logo,
    cur: S.cur,
    customer: st.demo.customer || "Maya",
    defaultCurrency: st.demo.currency || "USD",
  };
}

/** Resolve story tokens against the current branding. */
export const T = (s: unknown) => tk(s, tokenCtx());

export const lsGet = (k: string) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null");
  } catch (e) {
    return null;
  }
};
export const lsSet = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};
/* Customize changes last for this visit only, so the general link always opens clean */
export const ssGet = (k: string) => {
  try {
    return JSON.parse(sessionStorage.getItem(k) || "null");
  } catch (e) {
    return null;
  }
};
export const ssSet = (k: string, v: unknown) => {
  try {
    sessionStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};
