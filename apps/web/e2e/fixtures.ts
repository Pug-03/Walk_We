import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

export const SIAM = { latitude: 13.74563, longitude: 100.53412 };
export const CENTRALWORLD = { lat: 13.7465769, lng: 100.5390414 };

const photonResults = {
  features: [
    {
      geometry: { coordinates: [CENTRALWORLD.lng, CENTRALWORLD.lat] },
      properties: { osm_type: 'W', osm_id: 157482067, name: 'centralwOrld', street: 'ถนนราชดำริ', district: 'ปทุมวัน', city: 'กรุงเทพมหานคร' },
    },
    {
      geometry: { coordinates: [100.5348, 13.7462] },
      properties: { osm_type: 'W', osm_id: 2, name: 'Siam Paragon', street: 'ถนนพระรามที่ 1', district: 'ปทุมวัน', city: 'กรุงเทพมหานคร' },
    },
  ],
};

// A tiny valid style: the map renders (background only) without the network.
const blankStyle = (bg: string) => ({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': bg } }] });

/**
 * Deterministic network: fake geocoder, local map style, no tiles. Routed on
 * the context (not the page) so service-worker requests are covered too.
 */
export async function mockNetwork(context: BrowserContext) {
  await context.route(/photon\.komoot\.io\/api/, (route) => route.fulfill({ json: photonResults }));
  await context.route(/tiles\.openfreemap\.org\/styles\/(\w+)/, (route) =>
    route.fulfill({ json: blankStyle(route.request().url().includes('dark') ? '#0b1f3a' : '#e3eefc') }),
  );
  await context.route(/tiles\.openfreemap\.org\/(?!styles)/, (route) => route.abort());
}

/** Skip landing + setup as a returning user would. */
export async function asReturningUser(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript((items) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('ww_onboarded', '1');
    localStorage.setItem('ww_setup_done', '1');
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, extra);
}

/** Wait until a page transition (View Transitions API) has finished playing. */
export async function waitForPageTransition(page: Page) {
  await page.waitForFunction(() => !document.getAnimations().some((a) => /^vt/.test((a as CSSAnimation).animationName ?? '')));
}

/** Swipe an element horizontally with touch-like pointer moves. */
export async function swipeLeft(page: Page, selector: string) {
  await waitForPageTransition(page);
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width * 0.75;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 - i * 25, y, { steps: 2 });
  await page.mouse.up();
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
}

export async function expectCoords(page: Page, field: 'from' | 'to', lat: number, lng: number, tol = 0.0005) {
  const el = page.getByTestId(`point-${field}`);
  await expect(el).not.toHaveAttribute('data-coords', '');
  const [la, ln] = (await el.getAttribute('data-coords'))!.split(',').map(Number) as [number, number];
  expect(Math.abs(la - lat)).toBeLessThan(tol);
  expect(Math.abs(ln - lng)).toBeLessThan(tol);
}

// Console noise we can't act on: aborted tile requests (tiles are blocked on
// purpose) and SwiftShader performance notes.
const IGNORED_CONSOLE = [/GL Driver Message/, /Failed to load resource/, /AJAXError/];

export const test = base.extend<{ net: void; noErrors: void }>({
  net: [async ({ context }, use) => {
    await mockNetwork(context);
    await use();
  }, { auto: true }],
  // Any uncaught error or console.error fails the test (this is how a broken
  // MapLibre worker would surface even though tiles are mocked away).
  noErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(m.text()))) errors.push(`console.error: ${m.text()}`);
    });
    await use();
    expect(errors, 'browser errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

/** Both markers sit in the visible map: below the top bar, above the sheet. */
export async function expectMarkersInView(page: Page) {
  await expect(page.locator('.marker')).toHaveCount(2);
  await expect(async () => {
    const sheetTop = (await page.locator('.sheet').boundingBox())!.y;
    for (const m of await page.locator('.marker').all()) {
      const b = (await m.boundingBox())!;
      expect(b.y).toBeGreaterThan(60);
      expect(b.y + b.height).toBeLessThan(sheetTop);
      expect(b.x).toBeGreaterThan(0);
      expect(b.x + b.width).toBeLessThan(page.viewportSize()!.width);
    }
  }).toPass({ timeout: 5000 });
}
