# Walk We — Real-Device Testing Checklist

Automated tests run in desktop Chromium with phone screen sizes. These checks need real phones,
real streets and real weather. Tick each box and note the phone, OS, browser and time.

## Setup

- [ ] Build and serve over HTTPS (GPS needs a secure context on phones):
      `npm run build && npm run preview`, then expose port 4173 through an HTTPS tunnel.
- [ ] Test on at least one iPhone (Safari) and one Android phone (Chrome).
- [ ] Clear site data before the first-time-user checks.

## First use

- [ ] Landing → onboarding (swipe a card, tap Next, Skip) → planner in under 30 seconds.
- [ ] "Use current location": the explainer appears **before** the system prompt.
- [ ] Decline location: search and drop-pin still work; no dead end.
- [ ] Save Home; close and reopen the app: tapping Home fills both points (≤ 2 taps to a route).
- [ ] Thai and English both read correctly; system text size at maximum doesn't break layouts.

## Walk in real sun (day mode)

- [ ] Plan Siam → CentralWorld around 09:00 and around 12:00 on a sunny day.
- [ ] **Compare computed vs real shadows at 9:00 and noon**: walk the route and note where the
      map's solid (shade) / dashed (sun) segments are wrong. Photograph mismatches with the time.
- [ ] Note any building whose shadow is clearly too long or too short (likely an estimated height).
- [ ] The shadiest card is selected by default; "balanced" and "shortest" compare sensibly.
- [ ] Screen stays readable in direct sunlight (day theme, brightness auto).

## Inside a mall (weak signal)

- [ ] Start navigation outside, walk into CentralWorld / Siam Paragon: steps still advance with
      "I'm here"; nothing hangs waiting for GPS.
- [ ] Check that routes never go through a mall outside its opening hours (try just before
      opening and just after closing).

## One-handed use

- [ ] Hold the phone in one hand, thumb only: pick points, start navigation, swipe steps back and
      forth, tap "I'm here", open and close a photo, open the map view.
- [ ] No accidental actions from a swipe that starts on the photo.
- [ ] SOS (top right) can be reached and held for 1 s without dropping the phone.

## At night (night mode)

- [ ] Plan after sunset: night mode is picked automatically; the factors (busy / CCTV / well lit)
      can be changed; at least one stays ticked.
- [ ] Cards say "ปลอดภัยกว่า (ตามข้อมูลที่มี)" and "not a guarantee" — never just "safe".
- [ ] Walk the safer route: note streets that were dark or deserted despite a good score.
- [ ] Night theme is comfortable; map is not blindingly bright.

## Airplane mode mid-route

- [ ] Start navigation online and wait for "พร้อมใช้ออฟไลน์" (Ready offline).
- [ ] Turn on airplane mode: the offline chip appears; steps, photos (including later steps) and
      the map view keep working.
- [ ] Reload the page while offline: the walk resumes on the same step.
- [ ] Turn airplane mode off again: nothing breaks.

## Screen lock and wake lock

- [ ] During navigation the screen stays on (Android Chrome; iOS Safari 16.4+).
- [ ] Lock and unlock the phone: navigation is still on the same step.
- [ ] Phones that support vibration give a light buzz on each step change.

## SOS and sharing

- [ ] Hold SOS < 1 s and release: nothing happens.
- [ ] Hold 1 s: full-screen 5 s countdown, vibration each second (Android); Cancel stops it and
      nothing is sent.
- [ ] Let it finish: the send screen shows SMS (with contacts), LINE and quick-dial 191 / 1669 /
      1155.
- [ ] **LINE really opens** with the message prefilled and lets you pick a chat; the map link in the
      message opens the right spot.
- [ ] SMS opens the messaging app with all emergency contacts and the message (iOS and Android).
- [ ] Quick-dial opens the phone dialer with the number (don't place the call).
- [ ] Share location from navigation via LINE: current location, destination and ETA are correct.
- [ ] Emergency contacts survive a reload and are not sent anywhere (check the network panel).

## Accessibility

- [ ] VoiceOver (iOS): complete the core flow — landing, onboarding, pick points, routes, start
      navigation, advance steps, SOS (double-tap-and-hold), cancel.
- [ ] TalkBack (Android): the same flow.
- [ ] Reduce Motion on: no swooping animations; everything still works.

## Add to Home Screen

- [ ] After the first completed route, the prompt appears once (Android: install button; iOS:
      illustrated steps). "Not now" stops it from coming back.
- [ ] The installed app opens full screen, offline, with the right icon and name.

## Data checks before launch

- [ ] Replace placeholder photos (`data/routes/photos/siam-cw-NN.jpg`), run `npm run photos`.
- [ ] Walk the photo guide and confirm every instruction, landmark and `validHours`; set
      `verified: true`.
- [ ] Add real incident entries with news links; remove placeholders.
- [ ] Confirm BMA CCTV data terms for commercial use.
- [ ] Point the geocoder and map tiles at production services (self-hosted or approved paid).
