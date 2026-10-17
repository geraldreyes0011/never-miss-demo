/** Lowercase, accents removed, non-alphanumerics -> "-", at most 40 characters. */
export const slugify = (s: string) =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "") || "client";

/** Make a slug unique against existing client slugs and industry ids. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  let s = base,
    n = 2;
  while (set.has(s)) s = base + "-" + n++;
  return s;
}
