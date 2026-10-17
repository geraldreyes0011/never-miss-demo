import { describe, expect, it } from "vitest";
import { rankIndustries } from "../../src/shared/search";
import { demo } from "./helpers";

const TABLE: [string, string][] = [
  ["aircon", "HVAC"],
  ["aircn", "HVAC"],
  ["lawyr", "Law firm"],
  ["nails", "Salon & spa"],
  ["psychologist", "Therapy & counseling"],
  ["teeth whitening", "Dental clinic"],
  ["burst pipe", "Plumbing"],
  ["termites", "Pest control"],
  ["landlord", "Property management"],
  ["botox", "Med spa & aesthetics"],
  ["car", "Auto repair"],
  ["house cleaning", "Home cleaning"],
  ["roof leak", "Roofing"],
  ["coffee", "Restaurant"],
  ["yoga", "Gym & fitness"],
  ["solar panel", "Solar installers"],
  ["kitchen reno", "Home remodeling & contractors"],
  ["dog", "Veterinary clinic"],
];

describe("rankIndustries()", () => {
  it.each(TABLE)("%s -> %s", (q, label) => {
    const top = rankIndustries(demo, q)[0];
    expect(demo.industries[top.id].label.startsWith(label)).toBe(true);
  });
  it("returns every industry in display order for an empty query", () => {
    expect(rankIndustries(demo, "").map((r) => r.id)).toEqual(demo.order);
  });
  it("ignores stop-words", () => {
    expect(rankIndustries(demo, "my plumbing business")[0].id).toBe("plumbing");
  });
});
