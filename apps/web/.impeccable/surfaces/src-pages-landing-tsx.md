---
version: 1
slug: "src-pages-landing-tsx"
primary_target: "src/pages/Landing.tsx"
related_targets: []
---

# Landing (first visit)

Scope: `/welcome` and `/` for first-time visitors (plus `/start`). Visitor mode: Persuade.
Audience: Thai-first walkers opening a shared link on a phone, often outdoors. Action: tap "เริ่มเลย" to begin (onboarding → safety setup → planner). Proof: one real computed route; no testimonials or counts exist (do not invent).
Constraints: brand palette tokens, IBM Plex Sans Thai, red only for SOS (SOS button only on the planner and navigation screens, not on this page), ≥ 7:1 key text, transform/opacity motion ≤ 300 ms with reduced-motion fallback, Lighthouse ≥ 90.
Also in scope: new logo mark, circular single-tap language toggle (drawn Languages icon + active-language badge), page-to-page transitions app-wide.

## Direction contract

(Rewritten 15 Oct 2026: the user rejected the route-ticket direction and, later, the centred copy-left/art-right hero as "looks AI-made" and "empty on big screens". This records the shipped direction.)

THESIS: The welcome page is a Bangkok street drawn as faceted line art, and the sky above it is live: the real sun over Siam right now, on today's sun path, the same sun the shade engine uses. It refuses the copy-left/picture-right hero and the icon-card feature grid.
OWN-WORLD: Navy field #050B1A edge to edge; faceted line art in #EEF4FF (night #D3DCF5) with amber #F5A524 lamps; cyan-400 #3CC8F2 for the sun path dots, readout numbers and the flat primary button (navy text); IBM Plex Sans Thai; original rounded two-tone W logo (sky/violet) standing in for the first letter of the wordmark. Dotted sun-path rules divide sections.
STORY: Visitor sees a full-width city with walkers in the viaduct's shade, the sun sitting where it really is with time, altitude and bearing, reads the qualified promise "(ตามข้อมูลที่มี)", taps Start; scrolling down walks from day to night and ends on the same street lit by lamps.
FIRST VIEWPORT (desktop >= 960): wordmark (up to 96px), tagline and two buttons in the sky on the left; live sun, dashed path and readout on the right; 2400-wide panorama full-bleed along the bottom. Phones: centred brand, the 1000-wide street, full-width buttons in the thumb zone (unchanged).
BELOW THE FOLD: sections as heading-left (sticky) / body-right; features as hairline-separated editorial rows; team side by side; supporters frames; night panorama as the foot. No eyebrows.
APP SCREENS (desktop): planner sheet becomes a left side panel over a full map; navigation shows map left and step cards right; info/form pages are two columns with a street-art slice under the title.
SIGNATURE: The live sky (sun position by SunCalc, updated each minute; moon and next sunrise at night) and the day-to-night street bookends.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
