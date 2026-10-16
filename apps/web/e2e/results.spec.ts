import { SIAM, asReturningUser, expect, expectNoHorizontalOverflow, test } from './fixtures.ts';

// Phase 2 "Done when": shade/sun segments visible on the map, on all three
// screen sizes. Time is pinned so the sun (and so the result) is fixed.

const cloud = (pct: number) => ({
  hourly: {
    time: Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 9, 15) + i * 3_600_000).toISOString().slice(0, 13) + ':00'),
    cloud_cover: Array(48).fill(pct),
  },
});

async function pickSiamToCentralWorld(page: import('@playwright/test').Page) {
  await page.getByTestId('point-from').click();
  await page.getByTestId('use-current').click();
  await expect(page.getByRole('heading', { name: 'ไปที่ไหน' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'ค้นหาสถานที่' }).fill('central');
  await page.getByTestId('search-results').getByRole('button', { name: /centralwOrld/ }).click();
  await expect(page.getByTestId('ready')).toBeVisible();
}

test.beforeEach(async ({ page, context }) => {
  await asReturningUser(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(SIAM);
  await context.route(/api\.open-meteo\.com/, (route) => route.fulfill({ json: cloud(10) }));
});

test('daytime: route cards with shade, and shade/sun runs drawn on the map', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T14:00:00+07:00') });
  await page.clock.resume(); // start at that time, then let it run like a real clock
  await page.goto('/plan');
  await pickSiamToCentralWorld(page);

  // Auto mode from the time: day.
  await expect(page.getByTestId('mode-day')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('find-routes').click();

  const first = page.locator('.route-option').first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  await expect(first).toHaveAttribute('aria-pressed', 'true'); // shade first: shadiest is the default
  await expect(first).toContainText(/ร่มที่สุด/);
  await expect(first).toContainText(/ร่ม \d+%/);
  await expect(first).toContainText(/นาที/);

  // Rendered on screen: at least one shaded (solid) run and one sunny (dashed) run.
  const map = page.locator('.map-canvas');
  await expect.poll(async () => Number(await map.getAttribute('data-shade-runs')), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await map.getAttribute('data-sun-runs')), { timeout: 10_000 }).toBeGreaterThan(0);

  await expect(page.getByText(/ความสูงอาคาร \d+% เป็นค่าประมาณ/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('scheduled for the evening: night mode is picked and explained', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T14:00:00+07:00') });
  await page.clock.resume(); // start at that time, then let it run like a real clock
  await page.goto('/plan');
  await pickSiamToCentralWorld(page);

  await page.getByRole('button', { name: 'ตั้งเวลา' }).click();
  await page.getByTestId('walk-time-input').fill('2026-10-15T21:30');
  await expect(page.getByTestId('mode-night')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('find-routes').click();

  await expect(page.locator('.route-option').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.route-option').first()).toContainText(/ปลอดภัยกว่า/);
  await expect(page.getByText('ปลอดภัยกว่า ไม่ใช่การรับประกัน')).toBeVisible();
  // Malls close at 21:00–22:00: the router reports skipping them.
  await expect(page.getByText(/เลี่ยงห้างที่ปิดอยู่ตอนนั้น/)).toBeVisible();
});

test('back from results returns to the planner with both points kept', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T10:30:00+07:00') });
  await page.clock.resume(); // start at that time, then let it run like a real clock
  await page.goto('/plan');
  await pickSiamToCentralWorld(page);
  await page.getByTestId('find-routes').click();
  await expect(page.locator('.route-option').first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'กลับ' }).click();
  await expect(page.getByTestId('point-to')).toHaveAttribute('data-coords', /^13\.74646/); // curated landmark point (landmarks.ts)
});
