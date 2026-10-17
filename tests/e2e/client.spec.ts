import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AudioMap, Client, Demo, General } from "../../src/shared/types";

const root = resolve(import.meta.dirname, "../..");
const read = <T>(p: string): T => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const demo = read<Demo>("data/demo.json");
const audio = read<AudioMap>("data/audio-map.json");
const clients = read<Client[]>("data/clients.json");
const general = read<General>("data/general.json");

/** Fail the test on any uncaught page error. */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("body[data-ready='1']")).toBeAttached();
}

test("general link opens on the default industry and plays every step through to the outro", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await ready(page, "/");
  const ind = general?.ind || demo.order[0];
  const biz = general?.name || demo.industries[ind].business.name;
  await expect(page.locator("#cname")).toHaveText(biz);
  await expect(page.locator("#welcome")).toBeVisible();
  // Idle state: step 1 already rendered behind the welcome brief.
  await expect(page.locator("#pBody > *").first()).toBeAttached();

  // Record every kicker the timeline shows.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as any).__kickers = seen;
    const k = document.getElementById("kicker")!;
    new MutationObserver(() => {
      if (seen[seen.length - 1] !== k.textContent) seen.push(k.textContent || "");
    }).observe(k, { childList: true, characterData: true, subtree: true });
  });
  await page.locator("#wPlay").click();
  await expect(page.locator("#welcome")).toBeHidden();
  await expect(page.locator("#kicker")).toHaveText(demo.outro.kicker, { timeout: 170_000 });
  await expect(page.locator(".outcomes .oc")).toHaveCount(3);
  await expect(page.locator("#alerts .alert")).toHaveCount(3);
  await expect(page.locator("#btnAgain")).toBeVisible();

  const kickers: string[] = await page.evaluate(() => (window as any).__kickers);
  const steps = kickers.filter((k) => /^Step \d of 6$/.test(k));
  expect(steps).toEqual([1, 2, 3, 4, 5, 6].map((n) => `Step ${n} of 6`));
  expect(errors).toEqual([]);
});

for (const id of demo.order) {
  test(`#${id} plays step 1 with its own voice clip`, async ({ page, request }) => {
    const errors = trackErrors(page);
    await ready(page, `/#${id}`);
    await expect(page.locator("#cname")).toHaveText(demo.industries[id].business.name);
    await page.locator("#wPlay").click();
    await page.keyboard.press("ArrowRight"); // skip the intro line, straight to step 1
    await expect(page.locator("#kicker")).toHaveText("Step 1 of 6");
    const src = await page.locator("#voice").evaluate((a: HTMLAudioElement) => a.src);
    expect(src).toMatch(new RegExp(`/audio/${audio[`${id}/s1`]}\\.mp3$`));
    const r = await request.get(src);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("audio");
    expect(errors).toEqual([]);
  });
}

test("Michelle Baratt Psychology's link shows her name and logo", async ({ page }) => {
  const michelle = clients.find((c) => c.slug === "michelle-baratt-psychology")!;
  await ready(page, "/#michelle-baratt-psychology");
  await expect(page.locator("#cname")).toHaveText("Michelle Baratt Psychology");
  const img = page.locator("#clogo img");
  await expect(img).toHaveAttribute("src", /logos\/michelle-baratt-psychology-[0-9a-f]{8}\.webp$/);
  await expect
    .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.locator(".pres .wm")).toHaveText(michelle.pres);
  const accent = await page.evaluate(() => document.documentElement.style.getPropertyValue("--accent"));
  expect(accent.toLowerCase()).toBe(michelle.accent.toLowerCase());
});

test("unknown hash falls back to the general link; industry hash uses its example business", async ({
  page,
}) => {
  await ready(page, "/#no-such-client");
  const ind = general?.ind || demo.order[0];
  await expect(page.locator("#cname")).toHaveText(general?.name || demo.industries[ind].business.name);
  await page.evaluate(() => (location.hash = "plumbing"));
  await expect(page.locator("#cname")).toHaveText(demo.industries.plumbing.business.name);
});

test("no horizontal scroll at 400 px", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 });
  await ready(page, "/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(400);
  await page.locator("#wPlay").click();
  await page.keyboard.press("ArrowRight");
  await page.locator(".dot").nth(3).click();
  await page.waitForTimeout(4500);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(400);
  await page.goto("/#michelle-baratt-psychology");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(400);
});

test("live preview messages are accepted from the same origin only", async ({ page }) => {
  await ready(page, "/");
  await page.evaluate(() =>
    window.postMessage(
      {
        type: "jd-preview",
        client: {
          slug: "x",
          name: "Preview Dental",
          ind: "dental",
          accent: "#7C3AED",
          pres: "Ana",
          logo: null,
        },
      },
      location.origin,
    ),
  );
  await expect(page.locator("#cname")).toHaveText("Preview Dental");
  await expect(page.locator(".pres .wm")).toHaveText("Ana");
  // A message dispatched with a foreign origin is ignored.
  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://evil.example",
        data: {
          type: "jd-preview",
          client: { slug: "y", name: "Evil", ind: "law", accent: "#000000", pres: "x", logo: null },
        },
      }),
    ),
  );
  await page.waitForTimeout(200);
  await expect(page.locator("#cname")).toHaveText("Preview Dental");
});

test("keyboard controls: arrows move between steps, Space pauses, Esc closes the welcome", async ({
  page,
}) => {
  await ready(page, "/#dental");
  await page.keyboard.press("Escape");
  await expect(page.locator("#welcome")).toBeHidden();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#kicker")).toHaveText("Step 1 of 6");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#kicker")).toHaveText("Step 2 of 6");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#kicker")).toHaveText("Step 1 of 6");
  await page.locator("body").press(" ");
  await expect(page.locator("#btnPause")).toHaveText("Resume");
});

for (const path of ["/", "/#michelle-baratt-psychology", "/#plumbing"]) {
  test(`visitors can't customize or edit anything on ${path}`, async ({ page }) => {
    await ready(page, path);
    await expect(page.getByRole("button", { name: /customi[sz]e|edit/i })).toHaveCount(0);
    await expect(page.locator("#drawer, input, select")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/client links|GitHub|token|customi[sz]e/i);
  });
}
