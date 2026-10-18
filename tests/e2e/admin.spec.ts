import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { FakeGitHub } from "./fake-github";

const LOGO = resolve(import.meta.dirname, "../../public/logos/michelle-baratt-psychology-72daf16d.webp");

async function signIn(page: Page, gh: FakeGitHub, token = gh.token) {
  await gh.install(page);
  await page.goto("/admin/");
  await expect(page.getByRole("heading", { name: "Demo admin" })).toBeVisible();
  const owner = page.getByLabel("Repository owner");
  if (await owner.isVisible()) {
    await owner.fill(gh.owner);
    await page.getByLabel("Repository name").fill(gh.repo);
  }
  await page.getByLabel("GitHub token").fill(token);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test("admin is noindex", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
});

test("sign in, create a client with a logo, change its industry, delete it: one commit each", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const gh = new FakeGitHub();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page, gh);

  // Existing client from the repo is listed.
  const list = page.getByRole("list", { name: "Client links" });
  await expect(list.getByText("Michelle Baratt Psychology")).toBeVisible();

  // ---- create (N shortcut opens the panel)
  await page.keyboard.press("n");
  const panel = page.getByRole("dialog", { name: "New client" });
  await expect(panel).toBeVisible();
  await panel.getByLabel(/Business name/).fill("Joy Dental Clinic");
  await expect(panel.getByText(/#joy-dental-clinic/)).toBeVisible();
  const ind = panel.getByRole("combobox", { name: "Industry" });
  await ind.click();
  await ind.fill("teeth whitening");
  await page.keyboard.press("Enter");
  await expect(ind).toHaveValue("Dental clinic");
  await panel.locator('input[type="file"]').setInputFiles(LOGO);
  await expect(panel.getByAltText("Logo preview")).toBeVisible();
  // Live preview shows the unsaved name.
  await expect(panel.frameLocator("iframe").locator("#cname")).toHaveText("Joy Dental Clinic");
  await panel.getByRole("button", { name: "Create client link" }).click();
  await expect(page.getByText("Client saved. Link copied.")).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(list.getByText("Joy Dental Clinic")).toBeVisible();

  expect(gh.recorded).toHaveLength(1);
  const create = gh.recorded[0];
  expect(create.message).toBe('admin: add client "Joy Dental Clinic"');
  const logoEntry = create.entries.find((e) => e.path.startsWith("public/logos/"));
  expect(logoEntry?.path).toMatch(/^public\/logos\/joy-dental-clinic-[0-9a-f]{8}\.webp$/);
  expect(logoEntry?.content?.base64?.length).toBeGreaterThan(100);
  const clients1 = gh.json("data/clients.json");
  const joy = clients1.find((c: any) => c.slug === "joy-dental-clinic");
  expect(joy).toMatchObject({
    name: "Joy Dental Clinic",
    ind: "dental",
    pres: "Verdant Partners",
    logo: logoEntry!.path.slice("public/".length),
  });
  expect(clients1.map((c: any) => c.slug)).toEqual(["michelle-baratt-psychology", "joy-dental-clinic"]);
  expect(gh.file("data/clients.json")!.text).toMatch(/^\[\n \{\n {2}"slug"/); // 1-space indent
  expect(gh.refUpdates).toBe(1);

  // Deploy status pill goes live.
  await expect(page.getByText(/^Live ·/)).toBeVisible({ timeout: 12_000 });

  // ---- edit industry: slug unchanged, no new logo upload
  await list.getByRole("button", { name: "Edit Joy Dental Clinic" }).click();
  const edit = page.getByRole("dialog", { name: "Edit Joy Dental Clinic" });
  await expect(edit.getByText("link never changes")).toBeVisible();
  const ind2 = edit.getByRole("combobox", { name: "Industry" });
  await ind2.click();
  await ind2.fill("burst pipe");
  await page.keyboard.press("Enter");
  await expect(ind2).toHaveValue("Plumbing");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  expect(gh.recorded).toHaveLength(2);
  expect(gh.recorded[1].message).toBe('admin: update client "Joy Dental Clinic"');
  expect(gh.recorded[1].entries.map((e) => e.path)).toEqual(["data/clients.json"]);
  const joy2 = gh.json("data/clients.json").find((c: any) => c.name === "Joy Dental Clinic");
  expect(joy2.slug).toBe("joy-dental-clinic");
  expect(joy2.ind).toBe("plumbing");
  expect(joy2.logo).toBe(joy.logo);

  // ---- delete: inline confirmation, logo file removed in the same commit
  await list.getByRole("button", { name: "Delete Joy Dental Clinic" }).click();
  await list.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(list.getByText("Joy Dental Clinic")).toBeHidden();
  await expect.poll(() => gh.recorded.length).toBe(3);
  const del = gh.recorded[2];
  expect(del.message).toBe('admin: delete client "Joy Dental Clinic"');
  expect(del.entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "data/clients.json" }),
      { path: `public/${joy.logo}`, sha: null, content: undefined },
    ]),
  );
  expect(gh.json("data/clients.json").map((c: any) => c.slug)).toEqual(["michelle-baratt-psychology"]);
  expect(gh.file(`public/${joy.logo}`)).toBeUndefined();
  expect(gh.refUpdates).toBe(3);
  expect(errors).toEqual([]);
});

test("a concurrent save is merged by slug and retried once", async ({ page }) => {
  const gh = new FakeGitHub();
  await signIn(page, gh);
  await expect(page.getByText("Michelle Baratt Psychology")).toBeVisible();
  // Another admin adds a client between our read and our ref update.
  gh.interloper = (tree) => {
    const list = JSON.parse(tree.get("data/clients.json")!.text!);
    list.push({
      slug: "other-co",
      name: "Other Co",
      ind: "law",
      accent: "#111827",
      pres: "Verdant Partners",
      logo: null,
    });
    tree.set("data/clients.json", { text: JSON.stringify(list, null, 1) + "\n" });
  };
  await page
    .getByRole("button", { name: /New client/ })
    .first()
    .click();
  const panel = page.getByRole("dialog", { name: "New client" });
  await panel.getByLabel(/Business name/).fill("Acme Roofing");
  await panel.getByRole("button", { name: "Create client link" }).click();
  await expect(page.getByText("Client saved. Link copied.")).toBeVisible();
  expect(gh.refUpdates).toBe(2); // first attempt rejected, retry succeeded
  expect(gh.json("data/clients.json").map((c: any) => c.slug)).toEqual([
    "michelle-baratt-psychology",
    "other-co",
    "acme-roofing",
  ]);
  await expect(page.getByText("Other Co")).toBeVisible();
});

test("general link: save a name, then reset", async ({ page }) => {
  const gh = new FakeGitHub();
  await signIn(page, gh);
  await page.getByRole("link", { name: "General link" }).click();
  await page.getByLabel(/Business name/).fill("Verdant Demo Co");
  await expect(page.frameLocator("iframe").locator("#cname")).toHaveText("Verdant Demo Co");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("General link saved.")).toBeVisible();
  expect(gh.recorded.at(-1)!.message).toBe("admin: update general link");
  expect(gh.json("data/general.json")).toMatchObject({ name: "Verdant Demo Co", ind: "hvac" });
  await page.getByRole("button", { name: "Reset to defaults" }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText(/General link reset/)).toBeVisible();
  expect(gh.file("data/general.json")!.text).toBe("null\n");
});

test("a rejected token sends the admin back to sign-in with a plain explanation", async ({ page }) => {
  const gh = new FakeGitHub();
  await signIn(page, gh, "github_pat_wrong");
  await expect(page.getByRole("alert")).toContainText("didn't accept this token");
  await expect(page.getByLabel("GitHub token")).toBeVisible();
});

test("industries: grid search and per-step voice playback", async ({ page }) => {
  const gh = new FakeGitHub();
  await signIn(page, gh);
  await page.getByRole("link", { name: "Industries" }).click();
  await page.getByLabel("Search industries").fill("botox");
  await expect(page.locator(".ind-card").first()).toContainText("Med spa");
  await page.locator(".ind-card").first().locator(".ind-open").click();
  await expect(page.getByRole("heading", { name: /Med spa/ })).toBeVisible();
  await expect(page.locator(".voice-row")).toHaveCount(8);
  await page.getByRole("button", { name: /Play voice-over: 1\./ }).click();
  await expect(page.getByRole("button", { name: /Stop voice-over: 1\./ })).toBeVisible();
});

test("sign out clears the token", async ({ page }) => {
  const gh = new FakeGitHub();
  await signIn(page, gh);
  await expect(page.getByText("Michelle Baratt Psychology")).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("main").getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("GitHub token")).toBeVisible();
  expect(
    await page.evaluate(
      () => sessionStorage.getItem("jd-admin-token") || localStorage.getItem("jd-admin-token"),
    ),
  ).toBeNull();
});

test("email & password: set up in Settings, then sign in with them", async ({ page, context }) => {
  test.setTimeout(60_000);
  const gh = new FakeGitHub();
  await signIn(page, gh);
  await expect(page.getByText("Michelle Baratt Psychology")).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("New password").fill("short");
  await page.getByLabel("Confirm password").fill("short");
  await page.getByRole("button", { name: "Save email & password" }).click();
  await expect(page.getByRole("alert")).toContainText("at least 12 characters");
  await page.getByLabel("New password").fill("orbit-velvet-canyon-42");
  await page.getByLabel("Confirm password").fill("orbit-velvet-canyon-42");
  await page.getByRole("button", { name: "Save email & password" }).click();
  await expect(page.getByText(/Email & password saved/)).toBeVisible({ timeout: 20_000 });
  const commit = gh.recorded.at(-1)!;
  expect(commit.message).toBe("admin: set email & password sign-in");
  const sealed = gh.file("data/admin-account.json")!.text!;
  expect(sealed).not.toContain(gh.token); // only the locked copy is stored
  expect(JSON.parse(sealed)).toMatchObject({ v: 1, kdf: "PBKDF2-SHA256" });

  // A fresh browser on another device: the site now serves the locked account file.
  const page2 = await context.newPage();
  await page2.route("**/data/admin-account.json", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: sealed }),
  );
  await gh.install(page2);
  await page2.addInitScript(() => {
    sessionStorage.clear();
    localStorage.removeItem("jd-admin-token");
  });
  await page2.goto("/admin/");
  await expect(page2.getByLabel("GitHub token")).toBeHidden();
  await page2.getByLabel("Email").fill("owner@example.com");
  await page2.getByLabel("Password").fill("wrong-password-123");
  await page2.getByRole("button", { name: "Sign in" }).click();
  await expect(page2.getByRole("alert")).toContainText("don't match", { timeout: 20_000 });
  await page2.getByLabel("Password").fill("orbit-velvet-canyon-42");
  await page2.getByRole("button", { name: "Sign in" }).click();
  await expect(page2.getByText("Michelle Baratt Psychology")).toBeVisible({ timeout: 20_000 });
});
