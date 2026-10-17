/**
 * One-time migration: move data: URI logos out of data/clients.json (and general.json) into
 * public/logos/<slug>-<hash>.<ext>, and store the relative path instead. Safe to re-run.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Client, General } from "../src/shared/types";
import { toRepoJson } from "../src/shared/merge";

const root = resolve(import.meta.dirname, "..");
const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

function extract(slug: string, logo: string | null): string | null {
  const m = logo && /^data:([^;,]+)(;base64)?,(.*)$/s.exec(logo);
  if (!m) return logo;
  const bytes = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]));
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
  const file = `logos/${slug}-${hash}.${EXT[m[1]] || "png"}`;
  mkdirSync(resolve(root, "public/logos"), { recursive: true });
  writeFileSync(resolve(root, "public", file), bytes);
  console.log(`  ${slug}: ${m[1]} ${bytes.length} bytes -> public/${file}`);
  return file;
}

const clientsPath = resolve(root, "data/clients.json");
const clients: Client[] = JSON.parse(readFileSync(clientsPath, "utf8"));
const next = clients.map((c) => ({ ...c, logo: extract(c.slug, c.logo) }));
writeFileSync(clientsPath, toRepoJson(next));

const generalPath = resolve(root, "data/general.json");
const general: General = JSON.parse(readFileSync(generalPath, "utf8"));
if (general && general.logo)
  writeFileSync(generalPath, toRepoJson({ ...general, logo: extract("general", general.logo) }));

console.log(`Migrated ${clients.length} client(s).`);
