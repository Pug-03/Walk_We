# Walk We

Mobile-first PWA that recommends walking routes in central Bangkok around Siam
(walks up to 5 km): shadier by day, safer by night (based on available data).

**Live:** https://walkwe-web.walkwe.workers.dev · Built for U-Hackathon 2026 (Track: AI) by team **FTXZ**:
Nathaporn Saituptim (AI Engineer / Developer), Natsha Tatiyachaitaweesuk (Support / Marketing),
Siriphanaphorn Sirikun (Developer).

- **AI:** Claude (`claude-opus-5-5`) turns a typed or spoken sentence into a trip and explains the
  chosen route from the computed numbers; ElevenLabs reads navigation aloud (the phone's own voice
  is the fallback). Routes, shade and scores are computed by our own code. See `AI_USAGE.md`.
- **Accessibility:** avoid stairs (step-free routing), read aloud, larger text, vibrate on each step.
- **Safety:** SOS (hold 1 s, 5 s countdown) shares your location by SMS / LINE; contacts stay on the device.

### License & attribution

Map data © OpenStreetMap contributors (ODbL 1.0); the derived dataset `data/areas/siam.json` is
ODbL. Fonts: IBM Plex Sans Thai (OFL 1.1). Sponsor logos in `apps/web/public/sponsors/`
are trademarks of their owners, shown only to credit HACKaWORK sponsors.

## Layout

```
apps/web        React + Vite PWA (UI only)
packages/core   routing / shadow / scoring + adapter interfaces — runs in Node, no DOM
packages/data   Zod schemas (mirror future PostGIS tables) + dataset loaders
config/cities   per-city settings (time zone, bounds, emergency numbers, data sources)
apps/ai-proxy   Cloudflare Worker holding the Claude API key (AI features, see AI_USAGE.md)
```

Adapters (`packages/core/src/adapters`): `GeocoderAdapter` (Photon today),
`RoutingEngine` (Phase 2), `DataRepository` (static JSON today),
`PlatformAdapter` (browser today, Capacitor later). They are wired up in
`apps/web/src/services.ts` only.

## Commands

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run typecheck
npm run test:e2e     # Playwright on iPhone SE / iPhone 15 / Pixel 7 sizes (builds first)
npm run build
npm run lighthouse   # mobile Lighthouse on every screen; fails below 90 (needs CHROME_PATH)
npm run photos       # rebuild route photo variants after dropping in real photos
```

## AI features

See `AI_USAGE.md` for what uses AI and what doesn't. To turn them on:

```bash
cd apps/ai-proxy
npx wrangler secret put ANTHROPIC_API_KEY   # the key never goes in the web app
# set ALLOWED_ORIGINS in wrangler.toml to the web app's origin(s)
npm run deploy                              # prints the Worker URL
```

Or do it all in one go (proxy + web app on Cloudflare Workers, AI on):
`npx wrangler login`, set the secret as above, then `bash scripts/deploy.sh`.
Live: https://walkwe-web.walkwe.workers.dev

Then build the web app with `VITE_AI_PROXY_URL=<worker url>`. Without it the AI
controls are hidden and everything works by hand. Local: `npm run ai:dev`
(port 8787) with `VITE_AI_PROXY_URL=http://localhost:8787`.

News incidents (offline, human-approved): `ANTHROPIC_API_KEY=... npm run incidents:extract -- <article-url>`,
then `--list`, `--approve <id>` or `--reject <id>`.

See `ARCHITECTURE.md` for the design and scaling notes, and `TESTING_CHECKLIST.md` for the
real-device checks.

First E2E run: `npx playwright install chromium` inside `apps/web`.

## Data

```
data/areas/siam.json            pilot dataset (OSM + BMA CCTV), served at /data/areas/siam.json
data/areas/siam-prototype.json  prototype bake, imported for regression only (not served)
data/routes/siam-centralworld.json  photo guide (both directions) + data/routes/photos/
data/incidents/bangkok.json     past incidents by OSM way id; placeholder entries are dev-only
data/precomputed/               generated shade tables (git-ignored)
docs/shadow-regression.md       new engine vs prototype engine, same input
```

```bash
npx tsx packages/data/scripts/bake-area.ts        # re-bake the pilot area (Overpass + BMA, ~2 min)
npx tsx packages/data/scripts/import-prototype.ts # re-import the prototype's siam.json
npx tsx scripts/compare-prototype.ts              # regenerate docs/shadow-regression.md
npx tsx scripts/precompute-shade.ts 2026-10       # per-edge sun exposure every 30 min (also --year 2026)
```

Route photos: drop real photos into `data/routes/photos/` using the names the guide
references (`siam-cw-01.jpg` …), then run `npm run photos` to rebuild the AVIF/WebP/JPEG
variants and blur placeholders. Until then the app shows labelled placeholders.

Incidents: each entry needs `wayIds`, `category`, `occurredOn`, `window`, `severity` and at
least one `sources` link with a date; the schema rejects any other field, so names can't be
stored. Entries with `placeholder: true` are shown (labelled) in dev and stripped from builds.

Every layer in a dataset records its `source` (name, URL, license) and `updatedAt`.
The BMA CCTV layer has no stated license; commercial use needs BMA permission.

## Config

External URLs come from env (`apps/web/.env.example`): MapLibre styles
(OpenFreeMap), the Photon geocoder, and the optional error-tracking endpoint.
The public Photon server is fair-use and for development; point production at
a self-hosted instance before launch.

## Privacy

Saved places, recents and (later) emergency contacts live in localStorage
only. Location is never logged; the error reporter scrubs coordinates.
