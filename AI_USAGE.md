# How Walk We uses AI

Walk We recommends walking routes in central Bangkok: shadier by day, safer (based on available data) by night. This page lists exactly which parts use AI and which parts are ordinary algorithms, so nobody has to guess.

The short version: **the AI reads and writes words. It never computes a route, a shadow, a score or a location.** Every number a user sees comes from code you can read and test.

## Where AI is used

Features 1, 2 and 4 call Claude (`claude-opus-5-5`) through the Anthropic API; feature 3 (read aloud) uses ElevenLabs text-to-speech.

### 1. Ask for a route in your own words (in the app)

The planner has a box: "บอกเป็นประโยคก็ได้" / "Or just say it". You can type or speak a request such as "จากที่นี่ไปสยามพารากอน ไม่อยากร้อน ขอผ่านเซเว่นด้วย".

- **What AI does:** turns the sentence into structured fields:
  - start and destination, as place names or "current location";
  - day or night preference;
  - departure time;
  - stops;
  - a clarifying question if the request isn't a walk.

  The output is forced into a JSON schema (`routeIntentSchema` in `packages/core/src/ai/adapter.ts`) and validated with Zod twice, once in the proxy and once in the browser.
- **What is not AI:**
  - Place names are looked up with the Photon geocoder.
  - "Current location" comes from the phone's GPS, on the device.
  - The route comes from Walk We's own A* router (`packages/core/src/routing/router.ts`).
  - Shade comes from the sun position (SunCalc) and building shadows.
- **Privacy:** only the typed text and the UI language are sent. The request schema has no coordinate field, and the proxy refuses any extra field.
- **Stops:** the router can't add stops yet. When a request asks for one, the app says so instead of pretending.
- **Code:**
  - `apps/web/src/components/plan/AskBox.tsx`
  - `apps/web/src/pages/Plan.tsx` (`onIntent`)

### 2. "Why this route" (in the app)

Under the route options, one sentence explains why the recommended route was chosen over the shortest.

- **What AI does:** rewrites the computed comparison as a natural sentence in Thai or English.
- **Input:** only numbers:
  - minutes and metres;
  - shade % (day) or safety score out of 10 (night);
  - the same numbers for the shortest route.

  No place names and no coordinates.
- **Guard against invented facts:**
  - Every number in the AI's sentence must be one of the computed numbers, or a difference between them (`explanationMatchesFacts`, unit-tested in `packages/core/test/ai.test.ts`).
  - The check runs in the proxy and again in the browser. A sentence that fails is thrown away.
- **Labelling:** a rule-based sentence from the same numbers shows straight away and stays if AI is off or fails. The label under the sentence says which one you are reading: "สรุปโดย AI จากตัวเลขที่ระบบคำนวณ" (AI) or "สรุปจากตัวเลขที่ระบบคำนวณ" (rule-based).
- **Code:** `apps/web/src/components/plan/RouteWhy.tsx`

### 3. Read aloud (in the app, ElevenLabs)

With **Read aloud** on (Accessibility, the ♿ button on the planner), each navigation step, the arrival and the SOS countdown are spoken.

- **What AI does:** turns the app's own step text into speech with ElevenLabs (`eleven_flash_v2_5`, Thai and English), through the same proxy (`POST /speak`), so the ElevenLabs key never reaches the browser.
- **What is sent:** only the sentence being read (max 300 characters), e.g. "เลี้ยวขวา เดินใต้ราง BTS 400 ม.". No location, no contacts.
- **Fallback:** without an ElevenLabs key, or if it fails, the phone's built-in speech engine reads the same text. Audio is cached per sentence for the session.
- **Code:** `apps/ai-proxy/src/index.ts` (`speak`), `apps/web/src/utils/speak.ts`, `apps/web/src/pages/Navigate.tsx`

### 4. Incident extraction from news (offline data pipeline, not in the app)

`scripts/extract-incidents.ts` reads Thai news articles and asks Claude for the street incidents in them:

- category;
- street or landmark;
- date;
- time of day.

The script then matches the place to pilot-area street segments with plain string and distance matching.

- **Human approval:** results go to `review/incidents-pending.json` with `status: "pending_review"`. Nothing is published until a person runs `--approve <id>`. Only then does the entry move into `data/incidents/bangkok.json`, the file the app uses, after passing the strict schema. That schema has no free-text field, so no names of people, schools or shops can be stored.
- **Not live yet:** no incidents are live today. The app's incident layer still holds labelled placeholders, which are stripped from production builds.

## Where AI is not used

| Part | How it works |
|---|---|
| Routing | A* over the OpenStreetMap walk graph, cost = distance × shade or safety weights |
| Shade | SunCalc sun position, plus building footprints and heights, covered walkways, skywalks and the space under the BTS |
| Night "safer" score | Counts of CCTV, street lamps, busy streets and past incidents, all from listed open data (see `/data` in the app) |
| Live sun on the welcome page | SunCalc, computed in the browser |
| Step-by-step navigation, offline mode, SOS | Ordinary app code |

## When AI is off or fails

The app works fully without AI:

- **No proxy configured:** if `VITE_AI_PROXY_URL` is empty, the "say it" box is hidden and the explanation uses the rule-based sentence.
- **AI unavailable:** on errors, rate limits or timeouts (15 s), the user sees a short message and picks the start and destination by hand as usual.

## Keys, limits and logging

- **API key:** the Claude API key lives only in the Cloudflare Worker (`apps/ai-proxy`) as a secret. It is never in the browser bundle.
- **Who can call the Worker:**
  - only listed origins (`ALLOWED_ORIGINS`);
  - only `POST /parse` and `POST /explain`;
  - request bodies capped at 4 KB;
  - 20 requests per minute per client (Workers Rate Limiting).
- **Logging:** request bodies and prompts are never logged, and Worker observability is off.
- **Prompt injection:** the user's text is passed as data, and the model can only answer inside the schema. Anything outside the schema is rejected.

## Tools used to build Walk We

Walk We was also built with AI coding assistance (Claude Code). That is separate from the AI features above, which are what the app itself runs.
