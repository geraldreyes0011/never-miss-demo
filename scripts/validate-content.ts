/**
 * Validates data/*.json: industry structure, voice clips for every line, known tokens only,
 * and well-formed client links. Exits non-zero on any error (fails CI).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isCurrency } from "../src/shared/currency";
import { TOKEN_RE, voiceText } from "../src/shared/format";
import { IC } from "../src/shared/icons";
import type { AudioMap, Client, Demo, General } from "../src/shared/types";

const root = resolve(import.meta.dirname, "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);

const demo = read<Demo>("data/demo.json");
const audio = read<AudioMap>("data/audio-map.json");
const clients = read<Client[]>("data/clients.json");
const general = read<General>("data/general.json");

const KINDS = new Set([
  "me",
  "them",
  "ai",
  "sys",
  "html",
  "notif",
  "tap",
  "alert",
  "clear",
  "head",
  "who",
  "time",
]);
const HEADS = new Set(["search", "browser", "chat", "sms", "email", "owner", "custom"]);
const HEX = /^#[0-9a-f]{6}$/i;

/** Every {…} in story text must be a known token. */
function checkTokens(where: string, v: unknown) {
  if (typeof v === "string") {
    const unknown = v.replace(TOKEN_RE, "").match(/\{[^{}\s]*\}/g);
    if (unknown) err(`${where}: unknown token(s) ${unknown.join(", ")}`);
  } else if (Array.isArray(v)) v.forEach((x, i) => checkTokens(`${where}[${i}]`, x));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => checkTokens(`${where}.${k}`, x));
}

function checkVoice(key: string, line: { say: string; voice?: string }) {
  const id = audio[key];
  if (!id) return err(`audio-map.json: no clip for "${key}"`);
  if (!existsSync(resolve(root, "public/audio", id + ".mp3")))
    err(`public/audio/${id}.mp3 missing (for "${key}")`);
  const want =
    "c" +
    createHash("md5")
      .update(voiceText(line.voice ?? line.say, demo.customer))
      .digest("hex")
      .slice(0, 8);
  if (want !== id) warnings.push(`"${key}" text changed since it was recorded (run the voice Action)`);
}

// Demo
if (!demo.order?.length) err("demo.order is empty");
for (const id of demo.order) if (!demo.industries[id]) err(`demo.order lists unknown industry "${id}"`);
for (const id of Object.keys(demo.industries))
  if (!demo.order.includes(id)) err(`industry "${id}" missing from demo.order`);
if (demo.outro.outcomes.length !== 3) err("outro.outcomes must have exactly 3 items");
checkTokens("intro", demo.intro);
checkTokens("outro", demo.outro);
checkVoice("intro", demo.intro);
checkVoice("outro", demo.outro);
for (const a of demo.outro.alerts)
  if (!(a.ic in IC)) warnings.push(`outro alert icon "${a.ic}" unknown, shows the check icon`);

for (const [id, ind] of Object.entries(demo.industries)) {
  const at = `industries.${id}`;
  if (!/^[a-z0-9-]+$/.test(id)) err(`${at}: id must be lowercase letters, digits or "-"`);
  if (!ind.label || !ind.business?.name) err(`${at}: needs a label and an example business`);
  if (!HEX.test(ind.business?.accent || "")) err(`${at}.business.accent must be a #RRGGBB colour`);
  if (ind.welcome?.points?.length !== 3) err(`${at}.welcome.points must have 3 items`);
  if (ind.steps.length !== 6) err(`${at}: has ${ind.steps.length} steps, needs exactly 6`);
  checkTokens(at, { welcome: ind.welcome, business: ind.business, steps: ind.steps });
  ind.steps.forEach((s, i) => {
    const sat = `${at}.steps[${i}]`;
    if (!s.name || !s.say) err(`${sat}: needs a name and a spoken line`);
    if (!HEADS.has(s.head?.type)) err(`${sat}.head.type "${s.head?.type}" unknown`);
    s.ev.forEach((e, j) => {
      if (typeof e[0] !== "number" || !KINDS.has(e[1]))
        err(`${sat}.ev[${j}]: bad event ${JSON.stringify(e).slice(0, 60)}`);
      if ((e[1] === "alert" || e[1] === "notif") && e[2]?.ic && !(e[2].ic in IC))
        warnings.push(`${sat}.ev[${j}]: icon "${e[2].ic}" unknown, shows the check icon`);
    });
    checkVoice(`${id}/s${i + 1}`, s);
  });
}

// Clients
const seen = new Set<string>();
function checkClient(at: string, c: Partial<Client>, needSlug: boolean) {
  if (needSlug) {
    if (!c.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug)) err(`${at}: bad slug "${c.slug}"`);
    else if (seen.has(c.slug)) err(`${at}: duplicate slug "${c.slug}"`);
    else if (demo.industries[c.slug]) err(`${at}: slug "${c.slug}" clashes with an industry id`);
    seen.add(c.slug || "");
    if (!c.name) err(`${at}: needs a name`);
  }
  if (c.ind && !demo.industries[c.ind]) err(`${at}: unknown industry "${c.ind}"`);
  if (needSlug && !c.ind) err(`${at}: needs an industry`);
  if (c.cur && !isCurrency(c.cur)) err(`${at}: unknown currency "${c.cur}"`);
  if (c.accent && !HEX.test(c.accent)) err(`${at}: accent must be a #RRGGBB colour`);
  for (const [field, v] of [
    ["logo", c.logo],
    ["presLogo", c.presLogo],
  ] as const) {
    if (!v || v.startsWith("data:")) continue;
    if (!/^logos\/[\w.-]+$/.test(v)) err(`${at}: ${field} must be "logos/<file>" or a data: URI`);
    else if (!existsSync(resolve(root, "public", v))) err(`${at}: public/${v} missing`);
  }
}
if (!Array.isArray(clients)) err("clients.json must be an array");
else clients.forEach((c, i) => checkClient(`clients[${i}] (${c.name})`, c, true));
if (general) checkClient("general.json", general, false);

for (const w of warnings) console.warn("warn:", w);
if (errors.length) {
  for (const e of errors) console.error("error:", e);
  console.error(`\n${errors.length} content error(s).`);
  process.exit(1);
}
const lines = Object.keys(demo.industries).length * 6 + 2;
console.log(
  `Content OK: ${demo.order.length} industries, ${lines} voice lines, ${clients.length} client link(s).`,
);
