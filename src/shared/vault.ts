/**
 * Email + password sign-in without a server. The admin's GitHub token (fine-grained, limited to this
 * one repository) is encrypted with a key derived from the email and password (PBKDF2-SHA256 with many
 * iterations, then AES-256-GCM) and stored as data/admin-account.json. Only someone who knows both
 * can unlock it; each password guess is deliberately slow.
 */
export interface SealedAccount {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

export const DEFAULT_ITERATIONS = 1_000_000;
export const MIN_PASSWORD = 12;

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const secret = (email: string, password: string) => enc.encode(email.trim().toLowerCase() + "\n" + password);

async function deriveKey(email: string, password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", secret(email, password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function sealAccount(
  token: string,
  email: string,
  password: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<SealedAccount> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(email, password, salt, iterations);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(token)));
  return { v: 1, kdf: "PBKDF2-SHA256", iterations, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

/** The token, or null if the email or password is wrong. */
export async function openAccount(
  file: SealedAccount,
  email: string,
  password: string,
): Promise<string | null> {
  try {
    const key = await deriveKey(email, password, unb64(file.salt), file.iterations);
    const out = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(file.iv) }, key, unb64(file.data));
    return new TextDecoder().decode(out);
  } catch (e) {
    return null;
  }
}
