import { applyClientOp, toRepoJson } from "../shared/merge";
import { slugify, uniqueSlug } from "../shared/slug";
import type { Client, CurrencyCode, Demo, General } from "../shared/types";
import type { FileChange, GitHub, RepoState, SaveResult } from "./github";
import type { ProcessedLogo } from "./images";
import { sealAccount } from "../shared/vault";

/** The editable fields of a client link or the general link. */
export interface Draft {
  name: string;
  ind: string;
  cur: CurrencyCode;
  accent: string;
  pres: string;
  /** Existing stored logo (path or legacy data URI), or null. Ignored when `upload` is set. */
  logo: string | null;
  /** A newly processed upload, written to public/logos in the same commit. */
  upload?: ProcessedLogo | null;
}

const isLogoFile = (p: string | null | undefined): p is string => !!p && p.startsWith("logos/");

/** Slug for a new client: from the name, unique against current clients and industry ids. */
export const newSlug = (name: string, clients: Client[], demo: Demo) =>
  uniqueSlug(slugify(name), [...clients.map((c) => c.slug), ...Object.keys(demo.industries)]);

async function logoChanges(
  gh: GitHub,
  latest: RepoState,
  slug: string,
  draft: Draft,
  previous: string | null | undefined,
) {
  const files: FileChange[] = [];
  let logo = draft.upload ? null : draft.logo;
  if (draft.upload) {
    logo = `logos/${slug}-${draft.upload.hash}.${draft.upload.ext}`;
    if (logo !== previous) files.push({ path: `public/${logo}`, base64: draft.upload.base64 });
  }
  if (isLogoFile(previous) && previous !== logo) files.push(...(await removals(gh, latest, [previous])));
  return { logo, files };
}

/** Only delete logo files that actually exist at the base commit (a missing path would fail the tree). */
async function removals(gh: GitHub, latest: RepoState, paths: string[]): Promise<FileChange[]> {
  if (!paths.length) return [];
  const present = new Set(await gh.listDir("public/logos", latest.sha));
  return paths
    .map((p) => `public/${p}`)
    .filter((p) => present.has(p))
    .map((path) => ({ path, remove: true }));
}

const toClient = (slug: string, d: Draft, logo: string | null): Client => ({
  slug,
  name: d.name.trim(),
  ind: d.ind,
  cur: d.cur,
  accent: d.accent,
  pres: d.pres.trim(),
  logo,
});

/** Create (slug omitted) or update a client. Editing never changes the slug. */
export function saveClient(
  gh: GitHub,
  demo: Demo,
  draft: Draft,
  slug?: string,
): Promise<SaveResult & { client: Client }> {
  let client!: Client;
  return gh
    .save(async (latest) => {
      const s = slug || newSlug(draft.name, latest.clients, demo);
      const prev = latest.clients.find((c) => c.slug === s);
      const { logo, files } = await logoChanges(gh, latest, s, draft, prev?.logo);
      client = toClient(s, draft, logo);
      const clients = applyClientOp(latest.clients, { kind: "upsert", client });
      files.unshift({ path: "data/clients.json", text: toRepoJson(clients) });
      const verb = slug ? "update" : "add";
      return { message: `admin: ${verb} client "${client.name}"`, files, next: { ...latest, clients } };
    })
    .then((r) => ({ ...r, client }));
}

export function deleteClient(gh: GitHub, slug: string, name: string): Promise<SaveResult> {
  return gh.save(async (latest) => {
    const prev = latest.clients.find((c) => c.slug === slug);
    const clients = applyClientOp(latest.clients, { kind: "delete", slug });
    const files: FileChange[] = [{ path: "data/clients.json", text: toRepoJson(clients) }];
    if (isLogoFile(prev?.logo)) files.push(...(await removals(gh, latest, [prev.logo])));
    return { message: `admin: delete client "${name}"`, files, next: { ...latest, clients } };
  });
}

/** Save the general link. `null` resets it to "each industry's example business". */
export function saveGeneral(gh: GitHub, draft: Draft | null): Promise<SaveResult> {
  return gh.save(async (latest) => {
    const prev = latest.general?.logo;
    let general: General = null;
    let files: FileChange[] = [];
    if (draft) {
      const r = await logoChanges(gh, latest, "general", draft, prev);
      files = r.files;
      const { slug: _slug, ...rest } = toClient("", draft, r.logo);
      general = rest;
    } else if (isLogoFile(prev)) files = await removals(gh, latest, [prev]);
    files.unshift({ path: "data/general.json", text: toRepoJson(general) });
    return {
      message: draft ? "admin: update general link" : "admin: reset general link",
      files,
      next: { ...latest, general },
    };
  });
}

/** Email & password sign-in: lock this session's token with them and store the locked copy. */
export async function saveAccount(gh: GitHub, email: string, password: string): Promise<SaveResult> {
  if (!gh.credential) throw new Error("Sign in with a GitHub token first.");
  const sealed = await sealAccount(gh.credential, email, password);
  return gh.save((latest) => ({
    message: "admin: set email & password sign-in",
    files: [{ path: "data/admin-account.json", text: JSON.stringify(sealed, null, 1) + "\n" }],
    next: latest,
  }));
}
