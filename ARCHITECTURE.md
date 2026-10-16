# Walk We — Architecture

Mobile-first PWA that recommends walking routes in Bangkok: shadier by day, safer by night
(based on available data). This document describes how the code is organised today and what
changes when the pilot grows to a whole city or several cities.

## Product rules that shape the code

- **Shade (day) and safety (night) come before distance.** The shadiest / safer routes have no
  length cap and are the default card; "balanced" (≤ 1.25× the shortest) is offered for people in
  a hurry; "shortest" is the comparison baseline. Safety outranks shade: a street segment with a
  recent incident costs far more than walking in the sun.
- **Never promise safety.** UI wording is always "ปลอดภัยกว่า (ตามข้อมูลที่มี)" / "Safer (based on
  available data)"; a unit test fails on a bare "safe".
- **Honest data.** Every dataset layer carries its sources, licenses and update time; estimates
  are flagged (building heights, lighting); a "Data limitations" page lists them.
- **Privacy.** No accounts. Saved places, recent searches, emergency contacts and the walk in
  progress live in `localStorage` only. Location is never logged (the error reporter scrubs
  coordinates) and never sent anywhere except inside links the user taps (LINE, SMS).

## Repository layout

```
apps/web          React 18 + Vite PWA (UI only)
  src/pages         Landing, Onboarding, Plan (map-first), Navigate, DataLimits, Contacts
  src/components    BottomSheet, SwipeDeck (onboarding), StepCarousel (navigation), MapView,
                    plan/*, nav/*, sos/*, ui (toast, dialog, skeletons)
  src/routing       Web Worker running the router + its message protocol
  src/nav           navigation session, step wording, offline prefetch, guide loading
  src/sos           SOS state machine, message/link builders
  src/store         React contexts: i18n, theme, places, contacts
  src/platform      PlatformAdapter for browsers
  e2e               Playwright specs (3 device sizes) incl. axe-core WCAG scans
packages/core     Pure TypeScript, runs in Node and in a Worker (no DOM)
  geo, sun, time    projection, SunCalc wrapper, city-zone time, opening_hours subset
  shadow            shadow maths, ShadeScene (buildings, trees, decks, overhead cover)
  area              Area = walk graph in metres + 10 m segments + lazy per-edge shade;
                    night attributes; incident weighting
  routing           AreaRouter (A*), profiles, turn-by-turn steps, photo-guide matching
  adapters          interfaces: Geocoder, RoutingEngine, DataRepository, Platform, LiveShare
packages/data     Zod schemas (mirroring future PostGIS tables) + JsonRepository
  scripts           bake-area (OSM + BMA → dataset), import-prototype
config            Per-city settings (config/cities/bangkok.ts)
data              Published datasets (served at /data/ and precached)
  areas/siam.json   walkways, buildings, trees, elevated decks, malls, CCTV, lamps, POIs
  routes/           photo guides + photos (placeholders until replaced)
  incidents/        incident register (placeholders are stripped from builds)
scripts           compare-prototype, precompute-shade, build-photos, lighthouse
docs              shadow-regression.md (new engine vs prototype)
```

Dependency direction: `apps/web → packages/data → packages/core → config`. Core never imports
data or the browser; data never imports the web app.

## Adapters (swap services without touching the UI)

| Interface | Today | Later |
|---|---|---|
| `GeocoderAdapter` | `PhotonGeocoder` (public komoot server in dev, URL from env) | self-hosted Photon, Longdo, Google |
| `RoutingEngine` | `WorkerRoutingEngine` → `AreaRouter` in a Web Worker | server endpoint / GraphHopper with custom weighting |
| `DataRepository` | `JsonRepository` over `/data/*.json` | API backed by Postgres/PostGIS |
| `PlatformAdapter` | `WebPlatform` (geolocation, share, vibrate, wake lock, tel:) | Capacitor plugins (background location, native share) |
| `CloudCoverProvider` | `OpenMeteoCloud` | any forecast API |
| `LiveShareService`, `ArrivalWatch` | interfaces + `shareToken()` only | Supabase Realtime (expiring, unguessable links; "alert if not arrived") |

All are chosen in one file, `apps/web/src/services.ts`. External URLs come from env
(`apps/web/.env.example`).

## How a route is computed

1. `bake-area.ts` turns OSM (Overpass) + BMA CCTV into `data/areas/siam.json` with heights tagged
   by source (`height`, `levels` × 3 m, per-type default, 10 m default).
2. The worker validates it with Zod and builds an `Area`: local metre projection, CSR walk graph,
   largest connected component for snapping, ~10 m segments per edge.
3. Per request: sun position (SunCalc) at departure, closed malls (opening hours + conservative
   default, must stay open 20 min), cloud factor, incident weights (half-life 1 year, 20 % outside
   their time window).
4. A* per profile. Day cost = `length × (1 + w_sun × cloud × sun-exposed share + w_inc × incident)`;
   night cost = `length × (1 + w × risk(chosen factors) + w_inc × incident)`. Shade per edge is
   computed lazily (only edges A* touches) and memoised per sun position.
5. Identical or not-meaningfully-better alternatives are folded into one card (≥ 5 shade points or
   ≥ 0.3 safety points, or fewer incidents, to stand alone).
6. Output: runs for the map (solid = shade / better covered, dashed = sun / less covered),
   stats, turn-by-turn steps; a hand-made photo guide replaces the steps when the route follows it.

Shade maths was regression-tested against the prototype on identical input
(`docs/shadow-regression.md`): mean per-edge difference 0.002 for the shared maths; the remaining
difference is the new permanent-shade layer (under BTS/expressway decks and tree crowns).

## Offline

`vite-plugin-pwa` (Workbox) precaches the app shell, the pilot dataset, route guides and the
incident register (~4 MB raw, **~1.1 MB gzip** — deploy behind a host that compresses JSON/JS).
When navigation starts, `nav/prefetch.ts` warms caches for that route after the current step has
loaded: every photo variant, both map styles with sprites and Thai/Latin glyphs, and vector tiles
around the route. The walk in progress is persisted, so an offline reload resumes on the same step.

## Performance budget

Lighthouse mobile (`npm run lighthouse`, simulated slow 4G + 4× CPU): every screen ≥ 90
(92–93 at the time of writing). Rules that keep it there:

- Landing and the planner ship in the main bundle; other screens are lazy chunks.
- MapLibre (~280 KB gzip) loads only after the first paint and the fonts; the day basemap is
  OpenFreeMap **positron** (55 layers) — liberty (111 layers + 3D buildings) cost ~2 s of main
  thread on a mid-range phone.
- Body fonts are preloaded; images are AVIF/WebP with srcset, blur placeholders and lazy loading.
- Animations use transform/opacity only, ≤ 300 ms, and respect `prefers-reduced-motion`.

## Scaling to the whole city

The pilot covers ~3 × 2 km (12k edges, 5.7k buildings) and runs entirely on the phone. Bangkok
as a whole is roughly 300× larger, which changes where work happens, not the interfaces:

1. **Data store.** Load OSM extracts into Postgres/PostGIS using the tables the Zod schemas
   mirror (walkways, buildings with `height_source`, elevated decks, malls with hours, CCTV,
   lamps, POIs, incidents, route guides). `DataRepository` becomes an API client.
2. **Tiles of data instead of one file.** Split the area dataset into tiles (e.g. z14) served by
   bbox; the worker loads the tiles a trip needs. `Area` already works on any bbox.
3. **Shade precompute.** Run `precompute-shade.ts` server-side per tile (every 30 min of daylight,
   one representative day per month) and serve per-edge exposure bytes; the router then reads
   exposure instead of casting shadows on the phone. The on-device engine stays as the fallback.
4. **Routing service.** Move A* behind `RoutingEngine` to a server (or GraphHopper with a custom
   weighting fed by the precomputed shade and night attributes) once trips span many tiles.
5. **Geocoding and tiles.** Self-host Photon and a vector-tile server (or a paid provider, after
   approval) instead of the public fair-use instances.
6. **Data quality.** Building heights (97 % estimated in the pilot) and street lighting (almost no
   lamp data) are the biggest accuracy limits; partner datasets (BMA, open LiDAR/DSM) would plug in
   as new sources with their own `heightSource` values.

## Adding another city

1. Add `config/cities/<city>.ts` (time zone, bounds, pilot bounds, emergency numbers, default mall
   hours, walk speed, data sources, guides, incident register) and register it in `config/index.ts`.
2. Bake its area: `bake-area.ts` with that city's bounds; add photo guides and an incident file.
3. Pick the city from user choice or location instead of `activeCity`.
4. Strings that name the pilot area (`landing.pilot`, `results.outside`) move to the city config.

Nothing in `packages/core` is Bangkok-specific; the only fixed-offset assumption left is in
`scripts/precompute-shade.ts`, which refuses to run for other zones until generalised.

## Testing

- Unit (Vitest): shadow/sun maths (incl. the brief's 67° and 36 m checks), routing profiles, mall
  hours, night factors, incidents, steps, guide matching, schemas, SOS state machine, messages,
  token contrast, wording.
- E2E (Playwright, iPhone SE / iPhone 15 / Pixel 7 sizes): full flow, offline navigation with
  airplane mode and reload, SOS, sharing links, 48 px targets, 200 % text, axe-core WCAG 2.1 AA in
  day and night themes.
- Real devices: `TESTING_CHECKLIST.md`.
