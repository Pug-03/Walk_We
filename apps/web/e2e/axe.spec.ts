import AxeBuilder from '@axe-core/playwright';
import { SIAM, asReturningUser, expect, test } from './fixtures.ts';

// WCAG 2.1 AA scan (axe-core) of every screen and key state, in both themes.
// MapLibre's canvas/controls are third-party and excluded.

async function scan(page: import('@playwright/test').Page, label: string) {
  // Scan the settled screen: mid-fade colours aren't what users read. Wait
  // until no finite animation is running on two checks 250 ms apart (a lazy
  // screen may not have started its entrance animation at the first check).
  const settled = () =>
    page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  await settled();
  await page.waitForTimeout(250);
  await settled();
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.maplibregl-map')
    .analyze();
  const issues = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  expect(issues).toEqual([]);
}

for (const theme of ['day', 'night'] as const) {
  test(`axe: core flow in the ${theme} theme`, async ({ page, context }) => {
    await page.addInitScript((t) => localStorage.setItem('ww_theme', t), theme);
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(SIAM);
    await context.route(/api\.open-meteo\.com/, (route) => route.fulfill({ json: { hourly: { time: [], cloud_cover: [] } } }));
    await page.clock.install({ time: new Date(theme === 'day' ? '2026-10-15T14:00:00+07:00' : '2026-10-15T21:00:00+07:00') });
  await page.clock.resume(); // start at that time, then let it run like a real clock

    await page.goto('/welcome');
    await scan(page, 'landing');
    await page.getByRole('button', { name: 'เริ่มเลย' }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await scan(page, 'setup');
    await page.getByTestId('setup-skip').click();
    await expect(page.getByTestId('point-from')).toBeVisible();
    await scan(page, 'plan');

    await page.getByTestId('point-from').click();
    await page.getByTestId('use-current').click();
    await expect(page.getByRole('heading', { name: 'ไปที่ไหน' })).toBeVisible();
    await page.getByRole('searchbox', { name: 'ค้นหาสถานที่' }).fill('central');
    await expect(page.getByTestId('search-results')).toBeVisible();
    await scan(page, 'picker');
    await page.getByTestId('search-results').getByRole('button', { name: /centralwOrld/ }).click();
    await expect(page.getByTestId('ready')).toBeVisible();
    await scan(page, 'ready');

    await page.getByTestId('find-routes').click();
    await expect(page.locator('.route-option').first()).toBeVisible({ timeout: 15_000 });
    await scan(page, 'results');

    await page.getByTestId('start-nav').click();
    await expect(page.getByTestId('nav-status')).toBeVisible();
    await scan(page, 'navigate');
    await page.getByTestId('toggle-map').click();
    await scan(page, 'navigate-map');
  });
}

test('axe: data, contacts and SOS screens', async ({ page, context }) => {
  await asReturningUser(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(SIAM);
  await page.goto('/data');
  await expect(page.getByTestId('layer-walkways')).toBeVisible();
  await scan(page, 'data');
  await page.goto('/contacts');
  await scan(page, 'contacts');
  await page.goto('/plan');
  const b = (await page.getByTestId('sos').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await expect(page.getByTestId('sos-countdown')).toBeVisible();
  await scan(page, 'sos-countdown');
  await expect(page.getByTestId('sos-send')).toBeVisible({ timeout: 8000 });
  await scan(page, 'sos-send');
});
