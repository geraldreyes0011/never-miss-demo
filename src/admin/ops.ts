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
  /** Existing stored presenter logo path, or null (Verdant logo / name wordmark). */
  presLogo: string | null;
  /** A newly processed presenter logo upload. */
  presUpload?: ProcessedLogo | null;
}

const isLogoFile = (p: string | null | undefined): p is string => !!p && p.startsWith("logos/");

/** Slug for a new client: from the name, unique against current clients and industry ids. */
export const newSlug = (name: string, clients: Client[], demo: Demo) =>
  uniqueSlug(slugify(name), [...clients.map((c) => c.slug), ...Object.keys(demo.industries)]);

/** File changes for one logo slot: write a new upload, delete the file it replaces. */
async function logoChanges(
  gh: GitHub,
  latest: RepoState,
  stem: string,
  current: string | null,
  upload: ProcessedLogo | null | undefined,
  previous: string | null | undefined,
) {
  const files: FileChange[] = [];
  let logo = upload ? null : current;
  if (upload) {
    logo = `logos/${stem}-${upload.hash}.${upload.ext}`;
    if (logo !== previous) files.push({ path: `public/${logo}`, base64: upload.base64 });
  }
  if (isLogoFile(previous) && previous !== logo) files.push(...(await removals(gh, latest, [previous])));
  return { logo, files };
}

/** Both logo slots (business + presenter) for a client or the general link. */
async function allLogoChanges(
  gh: GitHub,
  latest: RepoState,
  stem: string,
  d: Draft,
  prev?: Partial<Client> | null,
) {
  const biz = await logoChanges(gh, latest, stem, d.logo, d.upload, prev?.logo);
  const pres = await logoChanges(gh, latest, `${stem}-presenter`, d.presLogo, d.presUpload, prev?.presLogo);
  return { logo: biz.logo, presLogo: pres.logo, files: [...biz.files, ...pres.files] };
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

const toClient = (slug: string, d: Draft, logo: string | null, presLogo: string | null): Client => ({
  slug,
  name: d.name.trim(),
  ind: d.ind,
  cur: d.cur,
  accent: d.accent,
  pres: d.pres.trim(),
  logo,
  ...(presLogo ? { presLogo } : {}),
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
      const { logo, presLogo, files } = await allLogoChanges(gh, latest, s, draft, prev);
      client = toClient(s, draft, logo, presLogo);
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
    files.push(...(await removals(gh, latest, [prev?.logo, prev?.presLogo].filter(isLogoFile))));
    return { message: `admin: delete client "${name}"`, files, next: { ...latest, clients } };
  });
}

/** Save the general link. `null` resets it to "each industry's example business". */
export function saveGeneral(gh: GitHub, draft: Draft | null): Promise<SaveResult> {
  return gh.save(async (latest) => {
    const prev = latest.general;
    let general: General = null;
    let files: FileChange[] = [];
    if (draft) {
      const r = await allLogoChanges(gh, latest, "general", draft, prev);
      files = r.files;
      const { slug: _slug, ...rest } = toClient("", draft, r.logo, r.presLogo);
      general = rest;
    } else files = await removals(gh, latest, [prev?.logo, prev?.presLogo].filter(isLogoFile));
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
