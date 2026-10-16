import { asReturningUser, expect, expectNoHorizontalOverflow, test } from './fixtures.ts';

// Brief §4: ≥ 48×48 px targets, no overflow at 200% text, English UI works.

async function smallTargets(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a[href], input')]
      // MapLibre's own attribution toggle is third-party chrome.
      .filter((el) => !el.closest('.maplibregl-ctrl'))
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.bottom > 0 && r.top < innerHeight)
      .filter(({ r }) => r.width < 47.5 || r.height < 47.5)
      .map(({ el, r }) => `${el.tagName} "${el.getAttribute('aria-label') ?? el.textContent?.trim()}" ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
}

test('tap targets are at least 48×48 on landing, setup and plan', async ({ page }) => {
  await page.goto('/');
  expect(await smallTargets(page)).toEqual([]);
  await page.getByRole('button', { name: 'เริ่มเลย' }).click();
  await expect(page).toHaveURL(/\/setup$/);
  expect(await smallTargets(page)).toEqual([]);
  await page.getByTestId('setup-skip').click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByTestId('point-from')).toBeVisible();
  expect(await smallTargets(page)).toEqual([]);
  await page.getByTestId('point-to').click();
  expect(await smallTargets(page)).toEqual([]);
});

test('200% text: no sideways scrolling, primary actions still reachable', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = 'html{font-size:200% !important}';
      document.head.appendChild(s);
    });
  });
  await page.goto('/');
  await expectNoHorizontalOverflow(page);
  const start = page.getByRole('button', { name: 'เริ่มเลย' });
  await start.scrollIntoViewIfNeeded();
  await expect(start).toBeInViewport();
  await start.click();
  await expect(page).toHaveURL(/\/setup$/);
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('setup-skip').scrollIntoViewIfNeeded();
  await page.getByTestId('setup-skip').click();
  await expect(page.getByTestId('point-to')).toBeInViewport();
  await expectNoHorizontalOverflow(page);
});

test('English UI and night theme', async ({ page }) => {
  await asReturningUser(page, { ww_lang: 'en' });
  await page.addInitScript(() => localStorage.setItem('ww_theme', 'night'));
  await page.goto('/plan');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Night mode')).toBeVisible();
  await page.getByTestId('point-to').click();
  await expect(page.getByRole('heading', { name: 'Go to' })).toBeVisible();
});

test('SOS works from the keyboard (hold Space)', async ({ page }) => {
  await asReturningUser(page);
  await page.goto('/plan');
  await page.getByTestId('sos').focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(1300);
  await page.keyboard.up('Space');
  await expect(page.getByTestId('sos-countdown')).toBeVisible();
  // Focus lands on Cancel, so Enter cancels.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('sos-countdown')).toHaveCount(0);
});

test('200% text on the navigation screen: instruction readable, main button reachable', async ({ page, context }) => {
  await asReturningUser(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 13.74563, longitude: 100.53412 });
  await context.route(/api\.open-meteo\.com/, (route) => route.fulfill({ json: { hourly: { time: [], cloud_cover: [] } } }));
  await page.clock.install({ time: new Date('2026-10-15T14:00:00+07:00') });
  await page.clock.resume(); // start at that time, then let it run like a real clock
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = 'html{font-size:200% !important}';
      document.head.appendChild(s);
    });
  });
  await page.goto('/plan');
  await page.getByTestId('point-from').click();
  await page.getByTestId('use-current').click();
  await expect(page.getByRole('heading', { name: 'ไปที่ไหน' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'ค้นหาสถานที่' }).fill('central');
  await page.getByTestId('search-results').getByRole('button', { name: /centralwOrld/ }).click();
  await page.getByTestId('find-routes').scrollIntoViewIfNeeded();
  await page.getByTestId('find-routes').click();
  await page.getByTestId('start-nav').scrollIntoViewIfNeeded();
  await page.getByTestId('start-nav').click();
  await expect(page.getByTestId('im-here')).toBeInViewport();
  await expect(page.getByTestId('step-instruction')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
