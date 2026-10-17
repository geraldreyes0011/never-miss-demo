# Never Miss a Customer: demo platform

A narrated, 1-minute interactive demo that shows a prospect how an AI assistant turns a missed call into a booked customer, plus a private admin to manage one tailored link per client.

| Link | Who it's for | What it shows |
|---|---|---|
| `https://<site>/` | Anyone (the **general link**) | `data/general.json` if set, otherwise HVAC with its example business |
| `https://<site>/#<client-slug>` | One client (e.g. `#michelle-baratt-psychology`) | Their name, logo, colour, currency, presenter and industry story |
| `https://<site>/#<industry-id>` | Anyone (e.g. `#plumbing`) | That industry with its example business |
| `https://<site>/admin/` | The agency only | Create/edit/delete client links, edit the general link, live preview, QR codes, voice check |

Unknown hashes fall back to the general link. Links work in any browser with no login; the admin needs a GitHub token.

## How it works

- **Client view** (`index.html`, `src/player/`): framework-free TypeScript, a faithful port of `reference/reference-implementation.html`. About 11 KB of JS gzipped. Music is generated live with the Web Audio API; voice clips play from `public/audio/`.
- **Admin** (`admin/index.html`, `src/admin/`): React 18. There's no server. Each save is **one atomic commit** to this repo through the GitHub Git Data API. The push triggers the deploy, and the change is live in about a minute.
- **Content** lives in the repo and is fetched at runtime (not bundled):
  - `data/demo.json`: every story (21 industries × 6 steps, intro, outro, search keywords)
  - `data/audio-map.json`: voice line → clip id (`dental/s3` → `public/audio/c….mp3`)
  - `data/clients.json`: client links · `data/general.json`: the general link (`null` = industry examples)
  - `public/logos/`: client logos (WebP, 256 px)
- **Shared code** (`src/shared/`): types, the `{biz}`/`{p:…}` token formatter, currency, smart industry search, slugs, content loading, merge logic.

## Local development

```bash
npm i
npm run dev          # http://localhost:5173/  and  http://localhost:5173/admin/
```

For the admin locally, either create `.env.local` with `VITE_GITHUB_OWNER` / `VITE_GITHUB_REPO` (see `.env.example`), or type the owner and repo on the sign-in screen. **Saving in the admin commits to the real repo**, even from localhost.

| Command | What it does |
|---|---|
| `npm run build` | Typecheck + production build to `dist/` (copies `data/` to `dist/data/`) |
| `npm run preview` | Serve `dist/` on http://localhost:4173 |
| `npm test` | Unit tests (Vitest): tokens, currency, search, slugs, merge, voice map |
| `npm run test:e2e` | Playwright against `vite preview` (run `npm run build` first) |
| `npm run lint` / `npm run format` | ESLint + Prettier check / fix |
| `npm run validate-content` | Checks every industry has 6 steps, every line has a voice clip, every token is known |

## Deploying (GitHub Pages)

1. Push this repo to GitHub (branch `main`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`, or run **Actions → Deploy → Run workflow**. The site appears at `https://<owner>.github.io/<repo>/`.
4. **Settings → Actions → General → Workflow permissions:** "Read and write" (the voice workflow commits clips and triggers a deploy).

**Base path.** By default the site builds for `/<repo>/`. For a **custom domain**:

- Add `public/CNAME` containing the domain (e.g. `demo.verdantpartners.com`).
- Set the repository variable **Settings → Secrets and variables → Actions → Variables → `VITE_BASE` = `/`**.
- Point DNS at GitHub Pages and set the domain under Settings → Pages.

The admin's owner and repo are baked in at build time from the repository the workflow runs in.

### Workflows

| Workflow | Runs on | Does |
|---|---|---|
| `ci.yml` | PRs and pushes | `npm ci`, typecheck, lint, validate-content, unit tests, build, Playwright |
| `deploy.yml` | Push to `main`, manual | Build with `VITE_BASE`, copy `data/` into the site, publish to Pages (concurrency group `pages`) |
| `voice.yml` | Push to `main` touching `data/demo.json`, manual | Records missing voice clips, updates `data/audio-map.json`, removes unused clips, commits `chore(voice): update voice-over [skip ci]`, triggers Deploy |

## Signing in to the admin

The admin uses a GitHub **fine-grained personal access token** scoped to this repo only:

1. Open [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new). The sign-in screen has a pre-filled link.
2. Name it "Demo admin" and choose an expiry.
3. **Resource owner:** the repo owner. **Repository access:** *Only select repositories* → this repo.
4. **Repository permissions:** **Contents: Read and write**, **Actions: Read-only**. Metadata read-only is added automatically.
5. Generate it, then paste it at `/admin/`. Tick **Remember on this device** to keep it in this browser; otherwise it lasts only for the tab session.

The token is never committed or logged. It is sent only to `api.github.com`. **Settings → Sign out** clears it. If GitHub rejects the token (401/403), the admin says why and returns to sign-in.

## Adding a client (about 30 seconds)

1. `/admin/` → **Client links** → **New client** (or press **N**).
2. Fill in the business name, then search for the industry (e.g. "psychologist", "aircon"). Pick a currency and brand colour, drop in a logo, and keep "Verdant Partners" or type another presenter name (shown as a wordmark).
3. Watch the live preview, then click **Create client link**. The link is copied to your clipboard.
4. The top-bar pill shows **Publishing…**, then **Live** after about a minute. Send the link.

Editing a client **never changes its slug**, so links you've sent keep working. Deleting a client also removes its logo file in the same commit. If two people save at once, the admin re-reads `clients.json`, applies the change on top (merged by slug) and retries once.

## Adding a new industry

1. Add the industry to `data/demo.json`, or to `tools/voice/make_demo.py` and regenerate from the `data/` folder (`cd data && python3 ../tools/voice/make_demo.py`, which overwrites `demo.json`). It needs:
   - `label` and search keywords `kw`
   - `business` (example name and accent colour)
   - `welcome` (3 points)
   - exactly **6 steps**
   - its id added to `order`
2. Run `npm run validate-content`. Missing voice clips are expected at this point.
3. Push to `main`. The **Voice-over** workflow records the new lines with the same voice (Kokoro `af_heart`), commits the clips and redeploys.

The voice-over always says **"your business"**, never a client's name (`{biz}` → "your business", `{cust}` → "Maya"). One recording serves every client. A clip id is a hash of its spoken words, so only lines whose words changed are re-recorded.

To record locally instead: `bash tools/voice/setup_tts.sh`, then `python3 tools/voice/voice_multi.py data/demo.json public/audio af_heart`. This needs Python 3, ffmpeg, cmake and about 360 MB for the model.

## Changing defaults

- **Default industry:** move its id to the front of `order` in `data/demo.json`. It's used by `/` when no general link is set.
- **What `/` shows:** admin → **General link**. Leave the name empty to use each industry's example business, or **Reset to defaults** to restore `null`.
- **Presenter:** `presenter` in `data/demo.json` sets the default ("Verdant Partners" shows `public/brand/verdant-logo.svg`). Per client, set "Presented by" in the admin. Admin → **Settings** sets the defaults for new clients on your device.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Admin says the token can't write | Recreate the token with **Contents: Read and write** on this repo. |
| Pill says "Saved" instead of "Live" | The token lacks **Actions: Read-only**. Saving still works. |
| "Someone else saved at the same time" | Click **Reload** and make the change again. |
| "GitHub's rate limit was reached" | Wait until the time shown. Saving resumes automatically. |
| Pages shows 404 / old content | Check Settings → Pages source is "GitHub Actions" and the latest **Deploy** run succeeded. Hard-refresh. |
| Site loads without styles or audio on a custom domain | Set the `VITE_BASE` variable to `/` and redeploy. |
| CI fails on `validate-content` after adding a line | Missing voice clips. The Voice-over workflow adds them; or run it manually from Actions. |
| No sound | Click **Watch** (browsers need a click before audio). Check the Voice/Music toggles. The demo still runs with timed captions if audio is blocked. |

`robots.txt` disallows `/admin/` and the admin page carries `noindex,nofollow`. On project pages (`/<repo>/`) crawlers ignore a sub-path `robots.txt`, so the meta tag is what keeps the admin out of search results.
