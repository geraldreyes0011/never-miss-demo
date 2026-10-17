export type CurrencyCode = "USD" | "AUD" | "CAD" | "GBP" | "EUR" | "NZD" | "PHP";
export type IndustryId = string;
export type IconName =
  | "eye"
  | "chat"
  | "cal"
  | "check"
  | "pay"
  | "star"
  | "repeat"
  | "search"
  | "phone"
  | "bell"
  | "mail"
  | "user"
  | "chart"
  | "bolt"
  | "lock"
  | "link"
  | "trash"
  | "pen";

export interface Demo {
  id: string;
  title: string;
  customer: string;
  currency: CurrencyCode;
  presenter: { name: string; logo: "verdant" | "" };
  link?: string;
  intro: { kicker: string; say: string; voice?: string; lede: string };
  outro: {
    kicker: string;
    say: string;
    voice?: string;
    outcomes: { b: string; s: string }[];
    alerts: { ic: IconName; t: string; small?: string }[];
    cta: string;
  };
  order: IndustryId[];
  industries: Record<IndustryId, Industry>;
}

export interface Industry {
  label: string;
  kw: string;
  business: { name: string; accent: string };
  welcome: { tag: string; headline: string; sub: string; points: string[]; cta: string; note: string };
  steps: Step[];
}

export interface Step {
  name: string;
  time: string;
  who?: string;
  head: PhoneHeader;
  say: string;
  voice?: string;
  ev: TimelineEvent[];
}

export type PhoneHeader =
  | { type: "search"; text: string }
  | { type: "browser"; url: string }
  | { type: "chat" | "sms" | "email"; title?: string; sub?: string }
  | { type: "owner"; title?: string; sub?: string }
  | { type: "custom"; html: string };

export type EventKind =
  "me" | "them" | "ai" | "sys" | "html" | "notif" | "tap" | "alert" | "clear" | "head" | "who" | "time";
export type TimelineEvent = [seconds: number, kind: EventKind, payload?: any];

export interface Client {
  slug: string;
  name: string;
  ind: IndustryId;
  cur?: CurrencyCode;
  accent: string;
  /** Presenter name; "Verdant Partners" shows the Verdant logo, anything else a wordmark. */
  pres: string;
  /** "logos/<file>.webp" path, or a legacy data: URI. */
  logo: string | null;
}

export type General = Omit<Client, "slug"> | null;
export type AudioMap = Record<string, string>;

export interface Content {
  demo: Demo;
  audio: AudioMap;
  clients: Client[];
  general: General;
}

/** Live-preview message the admin posts into the client view iframe. */
export interface PreviewMessage {
  type: "jd-preview";
  client: (Partial<Client> & { general?: boolean }) | null;
}
