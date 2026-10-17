import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { voiceKey } from "../../src/shared/content";
import { audioMap, demo, root } from "./helpers";

describe("voice-key mapping", () => {
  const keys = [
    "intro",
    "outro",
    ...demo.order.flatMap((id) => [1, 2, 3, 4, 5, 6].map((n) => voiceKey(id, n))),
  ];
  it("covers 21 industries × 6 steps + intro + outro", () => {
    expect(demo.order).toHaveLength(21);
    expect(keys).toHaveLength(128);
  });
  it.each(keys)("%s has a clip that exists in public/audio", (key) => {
    const id = audioMap[key];
    expect(id, `audio-map entry for ${key}`).toMatch(/^c[0-9a-f]{8}$/);
    expect(existsSync(resolve(root, "public/audio", id + ".mp3"))).toBe(true);
  });
});
