import { describe, expect, it } from "vitest";
import { applyClientOp, toRepoJson } from "../../src/shared/merge";
import type { Client } from "../../src/shared/types";

const c = (slug: string, name = slug): Client => ({
  slug,
  name,
  ind: "hvac",
  accent: "#1D4ED8",
  pres: "Verdant Partners",
  logo: null,
});

describe("applyClientOp() merge by slug", () => {
  const latest = [c("a"), c("b"), c("other-admin-added")];
  it("appends a new client without dropping concurrent additions", () => {
    expect(applyClientOp(latest, { kind: "upsert", client: c("new") }).map((x) => x.slug)).toEqual([
      "a",
      "b",
      "other-admin-added",
      "new",
    ]);
  });
  it("replaces an existing client in place", () => {
    const out = applyClientOp(latest, { kind: "upsert", client: c("b", "B renamed") });
    expect(out.map((x) => x.name)).toEqual(["a", "B renamed", "other-admin-added"]);
    expect(latest[1].name).toBe("b"); // input untouched
  });
  it("deletes by slug and ignores unknown slugs", () => {
    expect(applyClientOp(latest, { kind: "delete", slug: "a" }).map((x) => x.slug)).toEqual([
      "b",
      "other-admin-added",
    ]);
    expect(applyClientOp(latest, { kind: "delete", slug: "zzz" })).toHaveLength(3);
  });
  it("re-adds a client that someone else deleted meanwhile (edit wins)", () => {
    expect(applyClientOp([c("a")], { kind: "upsert", client: c("b") }).map((x) => x.slug)).toEqual([
      "a",
      "b",
    ]);
  });
  it("pretty-prints with a 1-space indent", () => {
    expect(toRepoJson([{ a: 1 }])).toBe('[\n {\n  "a": 1\n }\n]\n');
  });
});
