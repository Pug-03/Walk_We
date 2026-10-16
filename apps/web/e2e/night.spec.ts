import { SIAM, asReturningUser, expect, test } from './fixtures.ts';

// Phase 4: night mode with factors, safety scores, data limitations page,
// and placeholder incidents never reaching the production build.

test.beforeEach(async ({ page, context }) => {
  await asReturningUser(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(SIAM);
  await context.route(/api\.open-meteo\.com/, (route) => route.fulfill({ json: { hourly: { time: [], cloud_cover: [] } } }));
  await page.clock.install({ time: new Date('2026-10-15T21:30:00+07:00') });
  await page.clock.resume(); // start at that time, then let it run like a real clock
});

async function pickPoints(page: import('@playwright/test').Page) {
  await page.goto('/plan');
  await page.getByTestId('point-from').click();
  await page.getByTestId('use-current').click();
  await expect(page.getByRole('heading', { name: 'ไปที่ไหน' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'ค้นหาสถานที่' }).fill('central');
  await page.getByTestId('search-results').getByRole('button', { name: /centralwOrld/ }).click();
  await expect(page.getByTestId('ready')).toBeVisible();
}

test('night: factors, safer-first card with a score, never a bare "safe"', async ({ page }) => {
  await pickPoints(page);
  await expect(page.getByTestId('mode-night')).toHaveAttribute('aria-pressed', 'true');
  // All three factors on by default; the last one can't be unticked.
  for (const f of ['crowded', 'cctv', 'lit']) await expect(page.getByTestId(`factor-${f}`)).toBeChecked();
  await page.getByTestId('factor-crowded').click();
  await page.getByTestId('factor-cctv').click();
  await expect(page.getByTestId('factor-lit')).toBeChecked();
  await expect(page.getByTestId('factor-lit')).toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('factor-lit').click({ force: true }); // try anyway
  await expect(page.getByTestId('factor-lit')).toBeChecked(); // still on
  await expect(page.getByText('ต้องเลือกอย่างน้อยหนึ่งข้อ')).toBeVisible();
  await page.getByTestId('factor-cctv').click();

  await page.getByTestId('find-routes').click();
  const first = page.locator('.route-option').first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  await expect(first).toContainText('ปลอดภัยกว่า');
  await expect(first).toContainText(/คะแนนความปลอดภัย \d+(\.\d)?\/10/);
  await expect(page.getByText('ปลอดภัยกว่า ไม่ใช่การรับประกัน')).toBeVisible();
  // Malls close by 22:00; the router reports skipping them.
  await expect(page.getByText(/เลี่ยงห้างที่ปิดอยู่ตอนนั้น/)).toBeVisible();

  // The selected route is drawn on screen, solid where better covered.
  const map = page.locator('.map-canvas');
  await expect.poll(async () => Number(await map.getAttribute('data-shade-runs')) + Number(await map.getAttribute('data-sun-runs')), { timeout: 10_000 }).toBeGreaterThan(0);

  // Nowhere in the UI is a route called just "safe".
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/(?<!ความ|ไม่)ปลอดภัย(?!กว่า)/);
});

test('data limitations page: every layer with source, license and date; no placeholders in production', async ({ page }) => {
  await page.goto('/plan');
  await page.getByText('ตั้งค่าและข้อมูล').click(); // settings live in a drawer at the foot of the sheet
  await page.getByTestId('settings-data-link').click();
  await expect(page).toHaveURL(/\/data$/);
  await expect(page.getByRole('heading', { name: 'ข้อจำกัดของข้อมูล' })).toBeVisible();
  for (const id of ['walkways', 'buildings', 'malls', 'cctv', 'lamps', 'incidents']) {
    const item = page.getByTestId(`layer-${id}`);
    await expect(item).toBeVisible();
    await expect(item).toContainText(/อัปเดต/);
    await expect(item.locator('.data-sources li').first()).toContainText('—');
  }
  await expect(page.getByTestId('layer-buildings')).toContainText(/ความสูงอาคาร \d+% เป็นค่าประมาณ/);
  await expect(page.getByTestId('layer-cctv')).toContainText(/permission/i); // BMA licence caveat
  // E2E runs the production build: placeholder incidents are stripped.
  await expect(page.getByTestId('layer-incidents')).toContainText('0 รายการ');
  await expect(page.getByText(/ข้อมูลตัวอย่างทั้งหมด/)).toHaveCount(0);
});
