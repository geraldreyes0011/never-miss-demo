import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "../../src/shared/slug";

describe("slugify()", () => {
  it("lowercases, strips accents and collapses punctuation", () => {
    expect(slugify("Joy Dental Clinic")).toBe("joy-dental-clinic");
    expect(slugify("  Café Olé & Señor's  ")).toBe("cafe-ole-senor-s");
    expect(slugify("Michelle Baratt Psychology")).toBe("michelle-baratt-psychology");
  });
  it("caps at 40 characters without a trailing dash", () => {
    const s = slugify("The Extremely Long Business Name Of A Company That Never Ends");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("falls back to 'client' for empty names", () => {
    expect(slugify("!!!")).toBe("client");
  });
});

describe("uniqueSlug()", () => {
  it("adds -2, -3… against clients and industry ids", () => {
    expect(uniqueSlug("joy", [])).toBe("joy");
    expect(uniqueSlug("joy", ["joy"])).toBe("joy-2");
    expect(uniqueSlug("joy", ["joy", "joy-2"])).toBe("joy-3");
    expect(uniqueSlug("dental", ["hvac", "dental"])).toBe("dental-2");
  });
});
