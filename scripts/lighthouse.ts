// Lighthouse (mobile preset) on every screen of the production build.
//
//   npm run build && npm run preview -- --port 4174 &   (or let this script start it)
//   npm run lighthouse
//
// The navigation screen needs a walk in progress, so a real Siam →
// CentralWorld session is computed with the router and injected into
// localStorage before that page loads. Fails (exit 1) if any page scores
// below 90 in any category. CHROME_PATH must point at a Chrome/Chromium
// (Playwright's works).

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';
import { bangkok } from '@walkwe/config';
import { Area, AreaRouter } from '@walkwe/core';
import { areaDatasetSchema, routeGuideSchema, toAreaInput } from '@walkwe/data';
import { buildSession } from '../apps/web/src/nav/session.ts';

const BASE = process.env.LH_BASE ?? 'http://localhost:4174';
const MIN = 90;

async function ensureServer() {
  try {
    await fetch(BASE);
    return null;
  } catch {
    const p = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { cwd: fileURLToPath(new URL('../apps/web/', import.meta.url)), stdio: 'ignore' });
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        await fetch(BASE);
        return p;
      } catch {
        /* not up yet */
      }
    }
    throw new Error('preview server did not start');
  }
}

async function navSession() {
  const ds = areaDatasetSchema.parse(JSON.parse(await readFile(new URL('../data/areas/siam.json', import.meta.url), 'utf8')));
  const guide = routeGuideSchema.parse(JSON.parse(await readFile(new URL('../data/routes/siam-centralworld.json', import.meta.url), 'utf8')));
  const router = new AreaRouter(new Area(toAreaInput(ds)), { timeZone: bangkok.timezone, defaultMallHours: bangkok.defaultMallHours, walkSpeedMps: bangkok.walkSpeedMps });
  const from = { lat: 13.74563, lng: 100.53412 }, to = { lat: 13.7465769, lng: 100.5390414 };
  const r = router.routeSync({ from, to, departAt: new Date('2026-10-15T14:00:00+07:00'), mode: 'day' });
  return buildSession(r.routes[0]!, 'day', from, to, [guide], 'centralwOrld');
}

const server = await ensureServer();
const session = await navSession();
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--enable-unsafe-swiftshader'] });
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });

const pages: Array<{ path: string; storage: Record<string, string> }> = [
  { path: '/welcome', storage: {} },
  { path: '/onboarding', storage: {} },
  { path: '/plan', storage: { ww_onboarded: '1' } },
  { path: '/navigate', storage: { ww_onboarded: '1', ww_nav: JSON.stringify(session) } },
  { path: '/data', storage: { ww_onboarded: '1' } },
  { path: '/contacts', storage: { ww_onboarded: '1' } },
];

let failed = false;
for (const p of pages) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((items: Record<string, string>) => {
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  }, p.storage);
  const result = await lighthouse(`${BASE}${p.path}`, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] }, undefined, page);
  const lhr = result!.lhr;
  const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]));
  const low = Object.entries(scores).filter(([, v]) => v < MIN);
  if (low.length) failed = true;
  const a = lhr.audits;
  console.log(
    `${low.length ? '✘' : '✓'} ${p.path.padEnd(11)} ${JSON.stringify(scores)}  FCP ${a['first-contentful-paint']!.displayValue}  LCP ${a['largest-contentful-paint']!.displayValue}  TBT ${a['total-blocking-time']!.displayValue}  CLS ${a['cumulative-layout-shift']!.displayValue}`,
  );
  await page.close();
}

await browser.disconnect();
await chrome.kill();
server?.kill();
process.exit(failed ? 1 : 0);
