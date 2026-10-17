import { describe, expect, it } from "vitest";
import { money } from "../../src/shared/currency";
import { tk, voiceText, type TokenContext } from "../../src/shared/format";

const ctx = (o: Partial<TokenContext> = {}): TokenContext => ({
  biz: "Joy <Dental> & Co",
  pres: "Verdant Partners",
  accent: "#0F766E",
  logo: null,
  cur: "USD",
  customer: "Maya",
  ...o,
});

describe("tk() token formatter", () => {
  it("escapes the business name and resolves simple tokens", () => {
    expect(tk("Hi from {biz}", ctx())).toBe("Hi from Joy &lt;Dental&gt; &amp; Co");
    expect(tk("{cust} · {presenter} · {accent} · {bizinitial}", ctx())).toBe(
      "Maya · Verdant Partners · #0F766E · J",
    );
  });
  it("renders {bizmark} as the logo image, or the initial", () => {
    expect(tk("{bizmark}", ctx())).toBe("J");
    expect(tk("{bizmark}", ctx({ logo: "/logos/a.webp" }))).toBe('<img src="/logos/a.webp" alt="">');
  });
  it("handles null and leaves unknown text alone", () => {
    expect(tk(null, ctx())).toBe("");
    expect(tk("plain {nope}", ctx())).toBe("plain {nope}");
  });
  it("formats {p:USD|PHP} in every currency", () => {
    const p = (cur: string) => tk("{p:89|1500}", ctx({ cur }));
    expect(p("USD")).toBe("$89");
    expect(p("AUD")).toBe("A$135"); // 133.5 rounds to the nearest 5
    expect(p("PHP")).toBe("₱1,500");
  });
});

describe("money()", () => {
  it.each([
    // [usd, php, cur, expected]
    [89, 1500, "USD", "$89"],
    [89, 1500, "PHP", "₱1,500"],
    [89, 1500, "AUD", "A$135"],
    [89, 1500, "CAD", "C$120"],
    [89, 1500, "GBP", "£70"],
    [89, 1500, "EUR", "€82"],
    [89, 1500, "NZD", "NZ$145"],
    [1650, 25000, "USD", "$1,650"],
    [1650, 25000, "AUD", "A$2,500"],
    [1650, 25000, "GBP", "£1,300"],
    [1650, 25000, "PHP", "₱25,000"],
    [45, 800, "GBP", "£36"],
    [450000, 7800000, "USD", "$450K"],
    [450000, 7800000, "PHP", "₱7.8M"],
    [40000, 1100000, "PHP", "₱1.1M"],
    [40000, 1100000, "AUD", "A$60,000"],
    [460000, 8000000, "NZD", "NZ$759K"],
    [700000, 0, "EUR", "€644K"],
    [1200000, 0, "USD", "$1.2M"],
  ] as const)("money(%d, %d, %s)", (usd, php, cur, want) => {
    expect(money(usd, php, cur)).toBe(want);
  });
  it("falls back to the default currency for unknown codes", () => {
    expect(money(89, 1500, "XYZ")).toBe("$89");
    expect(money(89, 1500, "XYZ", "PHP")).toBe("₱1,500");
  });
});

describe("voiceText()", () => {
  it("never says the client's name", () => {
    expect(voiceText("Hi, {cust}! This is <b>{biz}</b>.  ")).toBe("Hi, Maya! This is your business.");
  });
});
