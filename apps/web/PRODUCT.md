# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People walking in Bangkok, holding a phone in one hand, often in harsh sun or at night. Their job: get from here to there on foot along a route that keeps them in the shade by day and is safer (based on available data) by night. First-time visitors are mostly Thai speakers opening a shared link on a phone.

## Product Purpose

Walk We recommends walking routes: shadier by day (computed from the real sun position, building shadows, covered walkways, skywalks and space under the BTS) and safer by night (busy streets, CCTV, lighting, past incidents). Shade and safety come before distance. Success: a new visitor gets a first route in about 30 seconds; a returning visitor in two taps.

## Positioning

Not a generic map: it routes by shade at the exact walk time and by night-time safety signals, and says plainly what its data can and cannot tell you.

## Operating Context

Mobile-first PWA, no sign-up or login. Thai by default, English available. Day and night themes (automatic by sun time, manual override). Pilot area: central Bangkok around Siam (Ratchathewi–Sam Yan, Pathum Wan–Phloen Chit), walks up to 5 km. Accessibility: avoid stairs, read aloud, larger text, vibrate. Step-by-step navigation with real photos, works offline mid-route. SOS (hold 1 s, 5 s countdown) on the planner and navigation screens only (user decision, 15 Oct 2026), and location sharing over LINE/SMS. Emergency contacts and the user's own number are stored on the device only.

## Capabilities and Constraints

- Wording is always "ปลอดภัยกว่า (ตามข้อมูลที่มี)" / "Safer (based on available data)" — never a bare "safe", never a guarantee.
- Lighthouse mobile ≥ 90; animate transform/opacity only, ≤ 300 ms, honour reduced motion.
- Key text contrast ≥ 7:1, everything else ≥ 4.5:1 (legible in direct sun); tap targets ≥ 48 px; 200 % text scaling.
- Red is for SOS only.

## Brand Commitments

- Name: "Walk We" (logo may be redesigned).
- Blue palette from the brief: navy-900 #0B1F3A, blue-700 #1E4FA8, blue-500 #3B82F6, sky-300 #7CC4F5, sky-50 #EEF6FF, amber-500 #F5A524 for sun, red-500 #E5484D for SOS only.
- Thai is the primary language, with English.

## Evidence on Hand

None yet: no real photos, partners, testimonials, user counts or press. Do not fabricate any; describe only what the app actually does.

## Product Principles

1. Shade by day and safety by night come before distance.
2. Honest about data: estimates are labelled, never promise safety.
3. One hand, harsh light: big targets, high contrast, primary actions in the thumb zone.
4. Private by default: no accounts, personal data stays on the device.

## Accessibility & Inclusion

WCAG 2.1 AA (axe-clean in both themes), VoiceOver/TalkBack-usable core flow, reduced-motion support, 200 % text.
