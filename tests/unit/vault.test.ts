import { describe, expect, it } from "vitest";
import { openAccount, sealAccount } from "../../src/shared/vault";

describe("email & password vault", () => {
  it("round-trips the token with the right email (any case) and password", async () => {
    const f = await sealAccount("github_pat_abc", "Me@Example.com", "correct horse battery", 1000);
    expect(f.data).not.toContain("github_pat_abc");
    expect(await openAccount(f, " me@example.com ", "correct horse battery")).toBe("github_pat_abc");
  });
  it("rejects a wrong password or email", async () => {
    const f = await sealAccount("github_pat_abc", "me@example.com", "correct horse battery", 1000);
    expect(await openAccount(f, "me@example.com", "wrong password!!")).toBeNull();
    expect(await openAccount(f, "you@example.com", "correct horse battery")).toBeNull();
  });
  it("uses a fresh salt and IV each time", async () => {
    const a = await sealAccount("t", "e@x.co", "p".repeat(12), 1000);
    const b = await sealAccount("t", "e@x.co", "p".repeat(12), 1000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });
});
