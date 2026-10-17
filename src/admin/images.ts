/* ---------- logo processing in the browser: longest side 256 px, WebP q0.9 (PNG fallback) ---------- */

export interface ProcessedLogo {
  dataUrl: string;
  base64: string;
  ext: "webp" | "png";
  /** First 8 hex chars of the SHA-256 of the bytes, used in the file name. */
  hash: string;
}

export class ImageError extends Error {}

const MAX = 256;
const MAX_INPUT = 15 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () =>
      rej(new ImageError("That file couldn't be read as an image. Try a PNG, JPG, WebP or SVG."));
    img.src = src;
  });
}

const readAsDataUrl = (f: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new ImageError("That file couldn't be read."));
    r.readAsDataURL(f);
  });

export async function shortHash(base64: string): Promise<string> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function processLogo(file: File): Promise<ProcessedLogo> {
  if (!file.type.startsWith("image/"))
    throw new ImageError(`"${file.name}" isn't an image. Choose a PNG, JPG, WebP or SVG file.`);
  if (file.size > MAX_INPUT) throw new ImageError("That image is over 15 MB. Choose a smaller file.");
  const img = await loadImage(await readAsDataUrl(file));
  const w = img.naturalWidth || img.width || MAX,
    h = img.naturalHeight || img.height || MAX;
  const k = Math.min(1, MAX / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext("2d");
  if (!g) throw new ImageError("Your browser couldn't process that image.");
  g.drawImage(img, 0, 0, c.width, c.height);
  let dataUrl = c.toDataURL("image/webp", 0.9);
  let ext: ProcessedLogo["ext"] = "webp";
  if (!dataUrl.startsWith("data:image/webp")) {
    dataUrl = c.toDataURL("image/png");
    ext = "png";
  }
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { dataUrl, base64, ext, hash: await shortHash(base64) };
}
