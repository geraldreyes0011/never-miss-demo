# Build prompt: "Never Miss a Customer" demo platform

> **How to use:** create an empty GitHub repository and clone it in VS Code. Copy everything from this starter kit into the repo root (`PROMPT.md`, `reference/`, `data/`, `public/`, `tools/`). Then paste this whole file into Claude and say: *"Build this exactly as specified. Work through the phases in order and run the checks at the end of each phase."*

---

## 0. Your role and the goal

Act as a senior full-stack engineer and a top-tier product designer (UI and UX) on one team. You are rebuilding an existing, working product as a proper codebase that deploys from GitHub. It has two faces:

1. **Client view** (public). A narrated, 1-minute interactive "customer journey" demo. It shows a prospect's business how an AI assistant turns a missed call into a booked customer. There is one shared general link plus one tailored link per client business (their logo, name, colour, currency and industry story).
2. **Internal admin** (private, for the agency only). A dashboard where the owner creates, edits and deletes client links. The owner also edits what the general link shows, previews everything live and copies links. Clients never see this interface.

**Duplicate the existing product faithfully.** The working reference is `reference/reference-implementation.html`, a single file with all of its CSS, markup and JavaScript. It was built for another platform, so ignore its "artifact" self-publishing code (`regen`, `TPL_B64`, `claude.use`, `SKEL_HEAD`). Every visual, timing, animation, story, voice clip and interaction in the client view must match it. Where this prompt and the reference disagree, this prompt wins.

All story content and voice-over already exist. Do not rewrite stories or regenerate audio unless a phase says so.

---

## 1. Starter kit contents

| Path | What it is |
|---|---|
| `reference/reference-implementation.html` | Working reference: CSS, markup and the full engine (player, music, search, currency, Studio). Port from it. |
| `data/demo.json` | All content: 21 industries × 6 steps, welcome copy, intro and outro, search keywords. The source of truth for stories. |
| `data/audio-map.json` | Maps every voice line key (`intro`, `outro`, `<industry>/s1`…`s6`) to an audio clip id. |
| `public/audio/*.mp3` | 102 voice-over clips (Kokoro neural voice `af_heart`, 32 kbps mono). Identical lines share one clip. |
| `data/clients.json` | Existing client links. Includes **Michelle Baratt Psychology**, whose logo is a data URI. Must keep working at the same slug. |
| `data/general.json` | What the general link shows (`null` means each industry's example business). |
| `public/brand/verdant-logo.svg` | Default presenter logo (Verdant Partners), drawn in `currentColor`. |
| `tools/voice/` | `make_demo.py` (story source), `voice_multi.py` (voice generator), `setup_tts.sh` (installs espeak-ng and the Kokoro model). |

---

## 2. Tech stack and architecture

- **Build:** Vite with TypeScript (strict mode), as a multi-page app:
  - `index.html` is the client view.
  - `admin/index.html` is the internal admin.
- **Client view:** framework-free TypeScript, a faithful port of the reference engine. Keep it lightweight and fast on mobile; no React here.
- **Admin:** React 18 with TypeScript. Use plain CSS modules or one stylesheet built on the shared design tokens, with no UI kit. Use `qrcode` (npm) to generate QR codes for links.
- **Shared code:** `src/shared/` holds types, the token formatter, currency, slug helpers, the industry search and design tokens. Both apps use it.
- **Hosting:** GitHub Pages, deployed by GitHub Actions. Make the Vite `base` configurable through the `VITE_BASE` env var: `/` for a custom domain, `/<repo>/` for project pages.
- **Persistence:** no servers. Content lives in the repo under `data/` and `public/logos/`.
  - Admin saves commit straight to the repo through the GitHub REST API (Git Data API, so one save is one atomic commit).
  - The push triggers the deploy workflow, and the change is live in about a minute.
- **Voice pipeline:** a separate GitHub Action regenerates any missing voice clips when `data/demo.json` changes. Section 9 covers it.

### Repository layout to create

```
/
├─ index.html                     # client view entry
├─ admin/index.html               # admin entry (noindex)
├─ src/
│  ├─ shared/ (types.ts, tokens.css, format.ts, currency.ts, search.ts, slug.ts, content.ts)
│  ├─ player/ (main.ts, engine.ts, phone.ts, music.ts, voice.ts, welcome.ts, customize.ts, styles.css)
│  └─ admin/  (main.tsx, App.tsx, github.ts, images.ts, components/*, styles.css)
├─ data/ (demo.json, audio-map.json, clients.json, general.json)   # copied into dist at build
├─ public/ (audio/, logos/, brand/, robots.txt, favicon.svg)
├─ tools/voice/ (…kit files…)
├─ scripts/ (migrate-logos.ts, validate-content.ts)
├─ tests/ (unit + Playwright e2e)
└─ .github/workflows/ (deploy.yml, voice.yml, ci.yml)
```

The client view loads `data/*.json` at runtime with `fetch(…, {cache: "no-store"})`, not bundled. A content commit then needs no code rebuild beyond the copy step. Copy `data/` into `dist/data/` during the build.

---

## 3. Data model

Define these in `src/shared/types.ts` and validate them in `scripts/validate-content.ts`.

```ts
type IndustryId = string;              // e.g. "hvac", "dental", "therapy"
interface Demo {
  id: string; title: string; customer: string;        // customer = "Maya"
  currency: CurrencyCode;                              // default "USD"
  presenter: { name: string; logo: "verdant" | "" };
  intro: { kicker: string; say: string; voice?: string; lede: string };
  outro: { kicker: string; say: string; voice?: string;
           outcomes: { b: string; s: string }[];        // exactly 3
           alerts: { ic: IconName; t: string; small?: string }[]; cta: string };
  order: IndustryId[];                                 // display & default order (first = default industry)
  industries: Record<IndustryId, Industry>;
}
interface Industry {
  label: string; kw: string;                           // kw = space-separated search keywords/synonyms
  business: { name: string; accent: string };          // example business + brand colour
  welcome: { tag: string; headline: string; sub: string; points: string[]; cta: string; note: string };
  steps: Step[];                                       // exactly 6
}
interface Step { name: string; time: string; who?: string; head: PhoneHeader; say: string; voice?: string; ev: TimelineEvent[] }
type PhoneHeader =
  | { type: "search"; text: string } | { type: "browser"; url: string }
  | { type: "chat" | "sms" | "email"; title?: string; sub?: string }
  | { type: "owner"; title?: string; sub?: string } | { type: "custom"; html: string };
type TimelineEvent = [seconds: number, kind: EventKind, payload?: any];
type EventKind = "me"|"them"|"ai"|"sys"|"html"|"notif"|"tap"|"alert"|"clear"|"head"|"who"|"time";
interface Client {                                     // data/clients.json is Client[]
  slug: string; name: string; ind: IndustryId; cur?: CurrencyCode;
  accent: string; pres: string;                        // presenter name; "Verdant Partners" => Verdant logo, else wordmark
  logo: string | null;                                 // NEW: "logos/<file>.webp" path. Legacy: data: URI (must still render)
}
type General = Omit<Client, "slug"> | null;            // data/general.json; empty name => use industry example
type AudioMap = Record<string, string>;                // "dental/s3" -> "c1a2b3c4"  => public/audio/c1a2b3c4.mp3
type CurrencyCode = "USD"|"AUD"|"CAD"|"GBP"|"EUR"|"NZD"|"PHP";
```

**Text tokens.** Any story text may contain these tokens, so implement them exactly as in the reference function `tk()`:

| Token | Renders as |
|---|---|
| `{biz}` | Business name, HTML-escaped |
| `{cust}` | The demo customer name (`Maya`) |
| `{presenter}` | Presenter name |
| `{accent}` | Brand colour |
| `{bizinitial}` | First letter of the business name |
| `{bizmark}` | The logo as an `<img>`, or the initial if there's no logo |
| `{p:USD\|PHP}` | A formatted price; see currency below |

**Currency** (copy from the reference `CURS` / `money()`):

- Rates from USD: AUD ×1.5, CAD ×1.37, GBP ×0.79, EUR ×0.92, NZD ×1.65. PHP uses the second number in the token as-is.
- Values of 100,000 or more show in compact form: `$450K`, `₱7.8M`.
- For non-USD and non-PHP currencies, round to a nice number: to the nearest 50 if 1,000 or more, else to the nearest 5 if 100 or more, else to the nearest 1.
- Symbols: `$`, `A$`, `C$`, `£`, `€`, `NZ$`, `₱`.

**Voice text.** Each step's spoken line is `voice ?? say`. When recording, `{biz}` becomes "your business" and `{cust}` becomes "Maya". The voice never says a client's name, so one recording works for every client.

---

## 4. Client view: duplicate the reference exactly

### 4.1 Routing

| URL | What it opens |
|---|---|
| `/` | General link. Uses `general.json` if set, otherwise the first industry in `order` (HVAC) with its example business. |
| `/#<client-slug>` | That client's tailored demo: industry story, name, logo, colour, currency and presenter. |
| `/#<industry-id>` | That industry with its example business (e.g. `/#plumbing`). |
| Unknown hash | Falls back to the general link. |

- Listen for `hashchange` and re-boot without a reload.
- Keep hash routing so it works on GitHub Pages with no server rewrites.
- Michelle's existing link `/#michelle-baratt-psychology` must keep working.

### 4.2 Layout (match the reference pixel-for-pixel)

- **Header:**
  - Presenter on the left: the Verdant SVG when the presenter is "Verdant Partners", otherwise "PRESENTED BY" plus the name as a wordmark.
  - A divider, then the client logo tile (logo or initial on the accent colour) and the business name.
  - On the right: **Music** and **Voice** toggles (`aria-pressed`) and **Customize**.
- **Stage:** a two-column grid, `minmax(0,1fr) 380px`.
  - **Left:** a kicker ("STEP 2 OF 6"), the big spoken sentence (`clamp(28px,3.4vw,46px)`, weight 800), the lede, an action area, the step pills (done = green dot, current = accent) and the controls (Back / Pause / Next).
  - **Right:** a realistic phone (320 px wide, 46 px radius, notch, status-bar time, app header, scrolling body) with owner **alerts** floating to its left (at most 2 visible, slide-in) and a "YOUR CUSTOMER'S PHONE" label below it.
- **Responsive:** at 1100 px and below the alerts move closer. At 900 px and below everything stacks into one column, the alerts sit statically under the phone, and the page must not scroll sideways at 400 px.
- **Themes:** light and dark via `prefers-color-scheme`, plus `[data-theme]` overrides. Use the exact tokens from the reference `:root`. Plus Jakarta Sans 400–800 from Google Fonts, with a system fallback.
- **Reduced motion:** honour `prefers-reduced-motion` by turning off animations and transitions.

### 4.3 Welcome brief (modal on load)

- Shows the industry's `welcome` data with tokens resolved: a pill tag ("CUSTOMER JOURNEY DEMO FOR {biz}"), headline, sub, 3 green-check points, a big **Watch the 1-minute demo** button and the note "Turn your sound on · Presented by {presenter}".
- **Skip** closes it. Enter or Space starts the demo.
- The Watch click is the user gesture that unlocks audio. Start the music, then play the `intro` voice, then begin step 1.

### 4.4 Playback engine (port exactly)

- **Timeline:** each step plays its events at their times, measured from the start of the step.
  - `ai` expands into typing dots, then the reply 1 s later.
  - `tap` adds a ripple; on a `.slot` it also adds `sel`.
  - `alert` adds an owner card (keep 2 at most).
  - The phone body auto-scrolls smoothly.
- **Advancing:** go to the next step only when the last event plus 1.6 s has passed **and** the voice clip has ended, then wait another 0.7 s.
- **After the last step:** show the outro, with 3 outcome cards, 3 "Always on" alerts, **Watch again** and the CTA line.
- **Word highlighting:** words of the spoken sentence go from 22% to 100% opacity in sync with audio progress (`currentTime / (duration - 0.35)` against each word's character-offset ratio). With no audio, words reveal on a timer (about 3.8 s spread across the words).
- **Voice:** a single reused `Audio` element plays `audio/<clipId>.mp3` for key `intro`, `<ind>/s<n>` or `outro`. While the voice plays, the music ducks to 42% and returns to 100% afterwards. If playback fails, fall back to timed captions; never block progress.
- **Music:** port the reference `Music` module **verbatim**. It is a royalty-free lo-fi track generated live with the Web Audio API:
  - 84 BPM with swing 0.14 and a 4-chord progression (Fmaj7, Dm7, Bbmaj7, C).
  - Detuned sawtooth pads, FM electric-piano arpeggio, triangle bass, sine kick, noise snare and hats.
  - A convolution reverb, a compressor, a master gain of 0.5 and a duck node.
  - Do not replace it with an audio file.
- **Controls:**
  - Back and Next buttons.
  - Pause/Resume pauses the timeline, the voice and the music.
  - Clicking a step pill jumps to that step.
  - Keyboard: ← → move between steps, Space pauses or starts, Esc closes overlays.
  - Save the music and voice toggles to `localStorage` (`jd-prefs`).
- **Idle state:** before Watch is clicked, render step 1 in its finished state behind the modal, so the first frame is never empty.

### 4.5 "Customize" for visitors (quick preview)

- A right-side drawer.
- The fields: industry (with smart search), currency, presenter name and logo, business name, logo and colour, plus Reset.
- Changes last **for this visit only** (`sessionStorage`), so the general link always opens clean.
- On load, clear any legacy `localStorage` keys that start with `jd-never-miss-`, plus `jd-ind` and `jd-cur`.
- No admin features ever appear in the client view.

### 4.6 Smart industry search (shared by the client view and admin)

Port `rankIndustries()` and `makePicker()` from the reference.

- **Scoring:**
  - Tokenize the query and drop stop-words: and, the, a, for, my, of, in, business, company, services, service, shop.
  - Score each query word against every token of the label plus keywords, and keep the best score:
    - exact match = 3
    - the query word is a prefix of the token (query word 3+ characters) = 2.4
    - the token is a prefix of the query word (token 4+ characters) = 2
    - substring (query word 4+ characters) = 1.6
    - otherwise trigram Jaccard similarity × 2.2
  - Average across the query words, then add +1.2 if the whole query appears as whole words in the label or keywords.
- **Combobox UX:**
  - A search icon inside the input.
  - Focus shows every industry with an "N industries · type to search" note.
  - Typing shows the top 6 under "Best matches". If the top score is below 1.15, the note reads "No exact match. Closest industries:".
  - Arrow keys move, Enter picks, Esc closes, click picks. Mark the current choice "current".
  - Use the ARIA combobox pattern.
- **Required results** (put these in a unit test):

| Query | Top result |
|---|---|
| aircon | HVAC |
| aircn | HVAC |
| lawyr | Law firm |
| nails | Salon & spa |
| psychologist | Therapy & counseling |
| teeth whitening | Dental clinic |
| burst pipe | Plumbing |
| termites | Pest control |
| landlord | Property management |
| botox | Med spa & aesthetics |
| car | Auto repair |
| house cleaning | Home cleaning |
| roof leak | Roofing |
| coffee | Restaurant |
| yoga | Gym & fitness |
| solar panel | Solar installers |
| kitchen reno | Home remodeling & contractors |
| dog | Veterinary clinic |

### 4.7 Content rules to preserve

- **Narration** always names the **AI assistant** as the actor ("your AI assistant texts her back…").
- **Phone details:** the first business message reads "Hi! This is the {biz} AI assistant…", with a "🤖 Sent automatically by AI assistant" system label above it.
- **Therapy industry:**
  - No public review request.
  - Step 6 is "Ongoing care", with a "Private and secure" alert.
  - Step 2 shows the line "🔒 Private & secure · In crisis? Call your local emergency line".
- **Home-service industries** (HVAC, plumbing, electrical, pest, roofing): the reminder step says the technician is on the way, not "directions".

---

## 5. Internal admin (`/admin/`)

This is a polished internal tool, not the client view. Design it like a modern SaaS dashboard: calm, dense where useful, and keyboard-friendly. Use the same tokens and font as the client view, with neutral surfaces and the accent used sparingly.

### 5.1 Access and security

- Serve `admin/index.html` with `<meta name="robots" content="noindex,nofollow">`, and add it to `robots.txt`.
- **Sign-in screen:** the admin pastes a GitHub fine-grained personal access token scoped to **this repo only**, with *Contents: Read and write* and *Actions: Read*.
  - Validate it with `GET /repos/{owner}/{repo}`. Read owner and repo from `VITE_GITHUB_OWNER` / `VITE_GITHUB_REPO`.
  - Store the token in `sessionStorage`, plus `localStorage` only if "Remember on this device" is ticked. Provide a **Sign out** that clears both.
  - Show the exact token-creation steps with a deep link to GitHub's fine-grained token page.
- Never commit or log the token. If the API returns 401 or 403, explain plainly what's wrong and send the admin back to sign-in.
- The admin bundle can be public because it holds no secrets, but nothing works without a valid token.

### 5.2 Information architecture

A left sidebar with these items: **Client links** (default), **General link**, **Industries**, **Settings**. A top bar shows deploy status and a **View live site** link.

1. **Client links**
   - **Table or card list** of every client. Each row shows:
     - logo, name, industry, currency and presenter
     - the full link, with a **Copy** button that shows a "Copied" toast
     - a **QR** button that opens a modal with a downloadable PNG
     - **Preview**, which opens the live link in a new tab
     - **Edit** and **Delete** (with an inline confirmation)
   - **Search box:** filters by name or industry. Also an industry filter chip row and sorting (newest or A–Z).
   - **Empty state:** an illustration-free, friendly message plus a **New client** button.
   - **New / Edit client**: a slide-over panel on the right.
     - Fields: business name (required), industry (smart search picker), currency, brand colour (swatches `#1D4ED8 #0F766E #7C3AED #B45309 #BE123C #0E7490 #111827` plus a custom picker), logo upload (drag-and-drop or browse; preview on white; remove), presenter ("Verdant Partners" by default, or any name, which shows as a wordmark).
     - Logo processing in the browser: draw onto a canvas with the longest side at 256 px, export WebP at quality 0.9 (PNG fallback). Reject anything that isn't an image, with a clear message.
     - The slug comes from the name (lowercase, accents removed, non-alphanumerics → `-`, at most 40 characters). Make it unique against other clients and industry ids. It is shown read-only, and editing a client **never changes its slug**, so sent links keep working.
   - **Live preview:** inside the panel, a scaled iframe of the client view. Changes appear as you type, before saving, with no reload. Send the unsaved state to the iframe with `postMessage` (`{type: "jd-preview", client}`), and have the client view accept it only from the same origin.
2. **General link.** The same form, without a slug. The name may be empty, which means "use each industry's example business". Show the general link with Copy, QR and Preview.
3. **Industries** (read-only in v1). A grid of the 21 industries with search.
   - Each card shows the label, example business and accent colour, with **Open demo** (`/#<id>`) and **Copy link**.
   - A detail view lists the 6 steps with their spoken lines and a ▶ button that plays each step's voice clip, so you can confirm the voice-over for every industry.
4. **Settings.** Repo and token status, default currency, default presenter name, Sign out.

### 5.3 Saving and publishing (backend logic in `src/admin/github.ts`)

- **One save = one atomic commit** through the Git Data API:
  1. `GET /git/ref/heads/main` to get the base commit.
  2. Create blobs: updated `data/clients.json` or `data/general.json` (pretty-printed, 1-space indent), plus any new logo `public/logos/<slug>-<shortHash>.webp` (base64).
  3. `POST /git/trees` with `base_tree`, then `POST /git/commits` with a message like `admin: update client "Joy Dental Clinic"`, then `PATCH /git/refs/heads/main`.
- **Concurrency:** before saving, re-fetch the latest `clients.json` and apply the change on top of it (merge by slug). If the ref update fails because the branch moved, retry once from step 1. If it still fails, show "Someone else saved at the same time. Reload to see the latest."
- **Logos:** new uploads are stored as files, and the client record holds the relative path (`logos/…webp`). Deleting a client also deletes its logo file in the same commit.
- **Deploy status:** after a commit, poll `GET /actions/runs?head_sha=<sha>` every 5 s. Show a top-bar pill:
  - **Publishing…** with a spinner
  - **Live** (green) with the time
  - **Deploy failed** (red) with a link to the run
- **Optimistic UI:** update the list immediately and roll back on failure, with a toast that explains what happened.
- **Rate limits and offline:** respect `403` with rate-limit headers and show when to retry. Disable saving while offline.

### 5.4 UX quality bar for the admin

- Every action gives feedback within 100 ms (pressed state, spinner, toast).
- Toasts sit bottom-right and auto-dismiss after 4 s; errors stay until dismissed.
- Full keyboard support, with visible focus rings, labelled inputs and focus trapped in modals and slide-overs. **N** opens a new client, **/** focuses search and **Esc** closes panels.
- Loading skeletons for lists. No layout shift.
- Copy is plain and action-led: "Save changes", "Client saved. Link copied.", "Couldn't save: GitHub says the token can't write to this repo."
- Works on a laptop and an iPad. Phone width can collapse the sidebar into a top menu.

---

## 6. Migration (`scripts/migrate-logos.ts`, run once in phase 2)

- For every client in `data/clients.json` whose `logo` starts with `data:`, decode it, write it to `public/logos/<slug>-<hash>.webp` (or .png) and replace the field with the relative path.
- The client view must render both paths and legacy data URIs.
- After migration, `/#michelle-baratt-psychology` must look identical to before: same name, logo, colour, industry and presenter.

---

## 7. Accessibility and performance

- WCAG 2.2 AA contrast in both themes. Every control is reachable by keyboard. The live regions for the spoken sentence and the alerts use `aria-live="polite"`.
- **Client view budget:** at most 60 KB of JS gzipped (excluding audio). Fonts use `display=swap`. Audio clips load on demand per step. Preload the next step's clip during the current step.
- **Lighthouse targets** (mobile) for the client view: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.

---

## 8. Testing (`tests/`)

- **Unit tests (Vitest):**
  - the token formatter, including `{p:…}` in every currency
  - `rankIndustries`, using the table in 4.6
  - slugify and unique-slug logic
  - the merge-by-slug save logic
  - the voice-key mapping (every industry and step has an audio-map entry, and the file exists in `public/audio/`)
- **E2E tests (Playwright, Chromium with `--autoplay-policy=no-user-gesture-required`):**
  - The general link opens on HVAC (or the general.json business). Click Watch, and the timeline reaches the outro with steps 1–6 in order and no page errors.
  - For **each of the 21 industries**, opening `/#<id>` plays step 1, and the `Audio` element's `src` resolves to an existing clip (HTTP 200).
  - `/#michelle-baratt-psychology` shows her name and logo.
  - At 400 px wide, `document.documentElement.scrollWidth === 400`.
  - Admin with a mocked GitHub API: sign in, create a client (with a logo), edit its industry (slug unchanged), delete it. The correct commit payloads are sent.
- `scripts/validate-content.ts` checks that every industry has exactly 6 steps, every step has a voice clip and every token is known. It fails CI otherwise.

---

## 9. CI/CD workflows (`.github/workflows/`)

1. **`ci.yml`** runs on pull requests and pushes: `npm ci`, typecheck, lint, `validate-content`, unit tests, build, and Playwright against `vite preview`.
2. **`deploy.yml`** runs on push to `main` and on manual dispatch:
   - Build with `VITE_BASE` (from a repo variable, default `/<repo>/`), copy `data/` into `dist/data/`, then deploy with `actions/upload-pages-artifact` and `actions/deploy-pages`.
   - Use concurrency group `pages` and cancel runs in progress.
   - Document enabling **Settings → Pages → Source: GitHub Actions**, and adding a custom domain via `public/CNAME`.
3. **`voice.yml`** runs on push to `main` that changes `data/demo.json`, and on manual dispatch:
   1. Set up Python 3.11 and `pip install onnxruntime numpy`, plus ffmpeg via apt.
   2. Cache `~/tts`, keyed on the `tools/voice/setup_tts.sh` hash, then run `bash tools/voice/setup_tts.sh` (builds espeak-ng and downloads the Kokoro model from GitHub releases).
   3. Run `python tools/voice/voice_multi.py data/demo.json public/audio af_heart`. Adapt the script so it writes the key→clip map to `data/audio-map.json`, only creates clips that don't exist yet and removes clips no longer referenced.
   4. If anything changed, commit with `chore(voice): update voice-over [skip ci]`, then trigger `deploy.yml` via `workflow_dispatch`.

   This keeps the voice-over applied to every industry automatically whenever stories change. Document that the voice always says "your business", never the client name.

---

## 10. Build phases (do them in order and verify each)

1. **Scaffold.** Set up Vite multi-page, TypeScript, lint, Prettier, Vitest and Playwright, plus the folder layout and shared tokens. Check: `npm run build` succeeds.
2. **Client view port.** Port the engine, phone, music, voice, welcome, outro, Customize and search from the reference. Load `data/*.json`, and run the logo migration. Check: e2e tests pass for all 21 industries; a side-by-side screenshot comparison with the reference at 1366×800 and 400×860 shows no visible differences except the fixes in this prompt.
3. **Admin.** Build sign-in, the client list, the editor with live preview, the general link, industries with voice playback, and settings. Check: admin e2e tests pass with the mocked API.
4. **CI/CD.** Add `ci.yml`, `deploy.yml` and `voice.yml`. Check: deployed to GitHub Pages. The general link, an industry link and Michelle's link work in an incognito window with no login. A test client created in the admin goes live within about 2 minutes.
5. **Docs.** Write a `README.md` covering:
   - what the product is and the two links (client and admin)
   - local development (`npm i`, `npm run dev`, then `/` and `/admin/`)
   - creating the GitHub token and deploying
   - adding a client (about 30 seconds)
   - adding a new industry: edit `tools/voice/make_demo.py` or `data/demo.json`, push, and the voice Action records it
   - changing the default industry or presenter
   - troubleshooting

---

## 11. Acceptance checklist

- [ ] The client view is visually and behaviourally identical to the reference: same welcome, phone, alerts, timings, highlighting, music and outro.
- [ ] All 21 industries play their own story **with their own voice-over** for steps 1–6, plus the shared intro and outro.
- [ ] The general link, `/#<industry>` and `/#<client>` all work in incognito, with no login and no admin traces.
- [ ] Michelle Baratt Psychology's existing link works unchanged after migration.
- [ ] The admin is at `/admin/` behind token sign-in, with create, edit and delete for clients, editing of the general link, live preview, copy and QR, deploy status, and industry voice playback.
- [ ] Editing a client never changes its slug, and each save is one commit.
- [ ] Smart search returns the required results, and currency formatting matches the spec.
- [ ] Light, dark and reduced-motion modes work, there is no horizontal scroll at 400 px, and the Lighthouse targets are met.
- [ ] CI is green, Pages deploys on push, and the voice Action records new or changed lines automatically.
