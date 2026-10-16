// Real screens for the welcome page's phone walkthrough (HowItWorks.tsx).
//
//   npm run build && npx vite preview --port 4317 (in apps/web), then
//   npx tsx scripts/build-demo-shots.ts
//
// Drives the real app (production build) on an iPhone 15 viewport (393 × 852,
// minus the 54 px status bar the page draws itself)
// through the whole first-run flow with sample data: Start → your number →
// an emergency contact → From: current location (CentralWorld) → To: Siam →
// compare routes → navigate step by step → a practice SOS (cancelled) →
// arrive. Each screen is saved as an image, with where the next tap lands,
// so the page can replay it with a pointer. Nothing here touches real
// contacts: it runs in a throwaway browser profile.
//
// Writes apps/web/public/demo/<lang>-<n>.webp and
// apps/web/src/components/welcome/demoShots.json

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

const BASE = process.env.DEMO_BASE ?? 'http://localhost:4317';
// The whole iPhone 15 screen; ?mockup=iphone makes the app keep clear of the
// status bar (59 px) and home bar (34 px) the page draws over it.
const W = 393, H = 852;
// Overridable so a run can write to a scratch folder and be swapped in only when complete.
const OUT = process.env.DEMO_OUT ?? fileURLToPath(new URL('../apps/web/public/demo/', import.meta.url));
const JSON_OUT = process.env.DEMO_JSON ?? fileURLToPath(new URL('../apps/web/src/components/welcome/demoShots.json', import.meta.url));
const CENTRALWORLD = { latitude: 13.7466, longitude: 100.5393 };

/** frame: an in-between frame of a transition, played back like video (no pointer action, no cross-fade). */
type Action = 'tap' | 'type' | 'hold' | 'swipe' | 'none' | 'frame';
interface Shot {
  img: string;
  /** Where the pointer goes on this screen (screen px), and what it does there. */
  x: number;
  y: number;
  action: Action;
  /** Caption step 0..6 this screen belongs to (0 = the welcome page and its Start). */
  step: number;
  /** Colour of the top of the screen, for the phone's status bar. */
  bg: string;
  /** swipe: how far the page scrolled to the next screen (px), and whether the whole page moved. */
  dy?: number;
  page?: boolean;
}

async function run(lang: 'th' | 'en'): Promise<Shot[]> {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: lang === 'th' ? 'th-TH' : 'en-GB',
    timezoneId: 'Asia/Bangkok',
    geolocation: CENTRALWORLD,
    permissions: ['geolocation'],
  });
  await ctx.addInitScript((l) => localStorage.setItem('ww_lang', l), lang);
  // Place search answers like Photon does for these names (the public server is
  // rate-limited and slow from a headless run); everything else is the real app.
  await ctx.route(/photon\.komoot\.io\/api/, (route) =>
    route.fulfill({
      json: {
        features: [
          {
            geometry: { coordinates: [100.5348, 13.7462] },
            properties: { osm_type: 'W', osm_id: 2, name: lang === 'th' ? 'สยามพารากอน' : 'Siam Paragon', street: lang === 'th' ? 'ถนนพระรามที่ 1' : 'Rama I Road', district: lang === 'th' ? 'ปทุมวัน' : 'Pathum Wan', city: lang === 'th' ? 'กรุงเทพมหานคร' : 'Bangkok' },
          },
          {
            geometry: { coordinates: [100.53412, 13.74563] },
            properties: { osm_type: 'N', osm_id: 3, name: lang === 'th' ? 'สถานีสยาม' : 'Siam BTS Station', district: lang === 'th' ? 'ปทุมวัน' : 'Pathum Wan', city: lang === 'th' ? 'กรุงเทพมหานคร' : 'Bangkok' },
          },
        ],
      },
    }),
  );
  const page = await ctx.newPage();
  // A running clock from 14:00 (a frozen one would stop the SOS hold timer).
  await page.clock.install({ time: new Date('2026-10-15T14:00:00+07:00') });
  const shots: Shot[] = [];
  let n = 0;

  const centre = async (l: Locator) => {
    const b = (await l.boundingBox())!;
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  };
  const save = async (png: Buffer) => {
    const img = `${lang}-${String(n++).padStart(2, '0')}.webp`;
    await writeFile(`${OUT}${img}`, await sharp(png).webp({ quality: 72 }).toBuffer());
    const { data } = await sharp(png).extract({ left: 20, top: 2, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    return { img, bg: `#${[...data.subarray(0, 3)].map((c) => c.toString(16).padStart(2, '0')).join('')}` };
  };
  /** If `target` is below (or above) the screen, record a swipe that brings it into view first. */
  const reveal = async (step: number, target: Locator) => {
    const b = (await target.boundingBox())!;
    if (b.y >= 0 && b.y + b.height <= H - 16) return;
    const y0 = await page.evaluate(() => window.scrollY);
    const png = await page.screenshot({ type: 'png' });
    await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(500);
    const b2 = (await target.boundingBox())!;
    const y1 = await page.evaluate(() => window.scrollY);
    const shot = await save(png);
    shots.push({ ...shot, x: W / 2, y: Math.round(H * 0.72), action: 'swipe', step, dy: Math.round(b.y - b2.y), page: y1 !== y0 });
  };
  const snap = async (step: number, target: Locator | null, action: Action, settle = 900) => {
    if (target) await reveal(step, target);
    await page.waitForTimeout(settle);
    const shot = await save(await page.screenshot({ type: 'png' }));
    const at = target ? await centre(target) : { x: W / 2, y: H * 0.6 };
    if (target && (at.y < 0 || at.y > H)) throw new Error(`tap target off screen at y=${at.y}`);
    shots.push({ ...shot, ...at, action, step });
  };
  /** Type one character per screen, as a person would. */
  const typeInto = async (step: number, l: Locator, text: string) => {
    await l.click();
    for (const ch of text) {
      await l.pressSequentially(ch);
      await snap(step, l, 'type', 120);
    }
  };
  const q = (id: string) => page.getByTestId(id);
  /**
   * Record the screen as it moves for `ms` after an action, as video frames.
   * Uses Chrome's screencast (frames as they paint): page.screenshot is far
   * too slow (~1.5 s each) to catch a 300 ms transition.
   */
  const cdp = await ctx.newCDPSession(page);
  const film = async (step: number, ms = 480, fps = 14) => {
    const last = shots[shots.length - 1];
    const frames: Buffer[] = [];
    const onFrame = (f: { data: string; sessionId: number }) => {
      frames.push(Buffer.from(f.data, 'base64'));
      void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    };
    cdp.on('Page.screencastFrame', onFrame);
    await cdp.send('Page.startScreencast', { format: 'png', maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });
    await page.waitForTimeout(ms);
    await cdp.send('Page.stopScreencast');
    cdp.off('Page.screencastFrame', onFrame);
    // Even out to about `fps` frames per second of real time.
    const want = Math.max(1, Math.round((ms / 1000) * fps));
    const pick = frames.length <= want ? frames : Array.from({ length: want }, (_, k) => frames[Math.round((k * (frames.length - 1)) / Math.max(1, want - 1))]!);
    for (const png of pick) {
      const shot = await save(await sharp(png).resize(W * 2, H * 2, { fit: 'fill' }).png().toBuffer());
      // Before the first tap the pointer waits off-screen, then glides in.
      shots.push({ ...shot, x: last?.x ?? -60, y: last?.y ?? -60, action: 'frame', step });
    }
  };

  // 1. Welcome → Start
  // Starts dark, then the page builds itself piece by piece, as it opens for real.
  await page.goto(`${BASE}/welcome?mockup=iphone`, { waitUntil: 'load' });
  await film(0, 4600);
  await snap(0, q('landing-start'), 'tap', 600);
  await q('landing-start').click();
  await film(0);

  // 2. Your number, then an emergency contact
  await page.waitForURL(/\/setup$/);
  await snap(1, q('setup-self'), 'tap');
  // A number pattern, not a number that looks real.
  await typeInto(1, q('setup-self'), '0XX-XXX-XXXX');
  await snap(1, q('setup-add-contact'), 'tap', 300);
  await q('setup-add-contact').click();
  await film(1, 360);
  const contactName = lang === 'th' ? 'แม่' : 'Mum';
  await snap(1, q('setup-name-0'), 'tap');
  await typeInto(1, q('setup-name-0'), contactName);
  await snap(1, q('setup-phone-0'), 'tap', 300);
  await typeInto(1, q('setup-phone-0'), '0XX-XXX-XXXX');
  await snap(1, q('setup-save'), 'tap', 300);
  // Valid numbers go in just before Save (not recorded), so the flow carries on.
  await q('setup-self').fill('0812345678');
  await q('setup-phone-0').fill('0898765432');
  await q('setup-save').click();
  await film(2, 700);

  // 3. Planner: From = current location (CentralWorld), To = Siam
  await page.waitForURL(/\/plan/);
  await snap(2, q('point-from'), 'tap', 2500);
  await q('point-from').click();
  await film(2);
  const current = page.getByRole('button', { name: lang === 'th' ? /ตำแหน่งปัจจุบัน/ : /current location/i }).first();
  await snap(2, current, 'tap');
  await current.click();
  await film(2);
  // The planner goes straight on to "To" once "From" is set.
  const search = page.getByRole('searchbox');
  await search.waitFor({ timeout: 15000 });
  const word = lang === 'th' ? 'สยามพารากอน' : 'Siam Paragon';
  await snap(2, search, 'tap');
  await typeInto(2, search, word);
  const result = q('search-results').getByRole('button').first();
  await result.waitFor({ timeout: 15000 }).catch(async (e) => {
    await page.screenshot({ path: '/tmp/walkwe-new/shots-fail.png' });
    throw e;
  });
  await snap(2, result, 'tap', 600);
  await result.click();
  await film(2);

  // 4. Find routes → compare
  const find = q('find-routes');
  await find.waitFor();
  await snap(3, find, 'tap', 1500);
  await find.click();
  await film(3, 900);
  const startNav = q('start-nav');
  await startNav.waitFor({ timeout: 20000 });
  await snap(3, startNav, 'tap', 3500);
  await startNav.click();
  await film(4, 700);

  // 5. Navigate a couple of steps, then the SOS button for real: hold, the
  // whole 5 → 1 countdown, and the screen of ways to send and call. Then on
  // to the end without showing the walking screen again, so the captions only
  // ever move forward.
  await page.waitForURL(/\/navigate/);
  const here = q('im-here');
  await snap(4, here, 'tap', 2500);
  await here.click();
  await film(4);
  await snap(4, here, 'tap', 900);
  await here.click();
  await film(4);
  await snap(5, q('sos'), 'hold', 1200);
  const sos = await centre(q('sos'));
  await page.mouse.move(sos.x, sos.y);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await film(5, 400);
  await q('sos-countdown').waitFor();
  // The whole 5 → 1 countdown as video: the number popping, the ring draining.
  await film(5, 5300, 4);
  await q('sos-send').waitFor();
  await film(5, 450);
  await snap(5, null, 'none', 700);
  await page.getByRole('button', { name: lang === 'th' ? 'ปิด' : 'Close' }).click();
  // Walk to the end (not recorded).
  for (let i = 0; i < 12; i++) {
    const label = (await here.textContent()) ?? '';
    await here.click();
    await page.waitForTimeout(500);
    if (/ถึงแล้ว|Finish|จบ|arrived/i.test(label) && !(await here.isVisible().catch(() => false))) break;
    if (!(await here.isVisible().catch(() => false))) break;
  }
  await snap(6, null, 'none', 1500);

  await browser.close();
  return shots;
}

await mkdir(OUT, { recursive: true });
const th = await run('th');
const en = await run('en');
// v: changes every run, so browsers never pair new data with cached old images.
await writeFile(JSON_OUT, JSON.stringify({ v: String(Date.now()), w: W, h: H, th, en }, null, 1) + '\n');
console.log(`demo shots: th ${th.length}, en ${en.length}`);
