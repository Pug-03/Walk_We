import { SIAM, asReturningUser, expect, test } from './fixtures.ts';

// Phase 5 "Done when": SOS tests pass; sharing via LINE (the URL is checked
// here; opening LINE itself needs a real phone — see TESTING_CHECKLIST.md).

async function hold(page: import('@playwright/test').Page, ms: number) {
  const box = (await page.getByTestId('sos').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test.beforeEach(async ({ page, context }) => {
  await asReturningUser(page, {
    ww_emergency_contacts: [{ id: '1', name: 'แม่', phone: '0812345678' }],
    ww_self: { phone: '0899990000' },
  });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(SIAM);
});

test('release before 1 s → countdown never starts', async ({ page }) => {
  // Fake clock: "held for 900 ms" must mean exactly that, even on a busy machine.
  // install() alone lets time keep flowing at wall-clock speed, so on a busy
  // machine the hold could run past 1 s on its own; pause it so only runFor moves it.
  const t0 = new Date('2026-10-15T10:00:00+07:00');
  await page.clock.install({ time: t0 });
  await page.goto('/plan');
  await page.clock.pauseAt(new Date(t0.getTime() + 60_000));
  const box = (await page.getByTestId('sos').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(900);
  await expect(page.getByTestId('sos')).toHaveAttribute('data-state', 'holding');
  await page.mouse.up();
  // Let the app handle the release before moving the clock on (on a busy
  // machine the input event can queue behind other work).
  await expect(page.getByTestId('sos')).toHaveAttribute('data-state', 'idle');
  await page.clock.runFor(10_000);
  await expect(page.getByTestId('sos-countdown')).toHaveCount(0);
  await expect(page.getByTestId('sos')).toHaveAttribute('data-state', 'idle');
});

test('cancel within 5 s → nothing is sent', async ({ page }) => {
  await page.goto('/plan');
  await hold(page, 1300);
  await expect(page.getByTestId('sos-countdown')).toBeVisible();
  await expect(page.getByTestId('sos-countdown')).toContainText(/[1-5]/);
  await page.waitForTimeout(2000);
  await page.getByTestId('sos-cancel').click();
  await expect(page.getByTestId('sos-countdown')).toHaveCount(0);
  await page.waitForTimeout(5000);
  await expect(page.getByTestId('sos-send')).toHaveCount(0);
  await expect(page.getByTestId('sos')).toBeVisible();
});

test('full SOS → one-tap send via LINE / SMS with the location, and quick-dial numbers', async ({ page }) => {
  await page.goto('/plan');
  await hold(page, 1300);
  await expect(page.getByTestId('sos-send')).toBeVisible({ timeout: 8000 });

  const line = await page.getByTestId('sos-line').getAttribute('href');
  expect(line).toMatch(/^https:\/\/line\.me\/R\/share\?text=/);
  const text = decodeURIComponent(line!.split('text=')[1]!);
  expect(text).toContain('ขอความช่วยเหลือ');
  expect(text).toMatch(/https:\/\/maps\.google\.com\/\?q=13\.7456\d*,100\.5341\d*/);
  expect(text).toContain('เบอร์ติดต่อกลับ: 0899990000'); // own number from the safety setup

  const sms = await page.getByTestId('sos-sms').getAttribute('href');
  expect(sms).toMatch(/^sms:0812345678[?&]body=/);
  await expect(page.getByTestId('sos-sms')).toContainText('(1 คน)');

  for (const n of ['191', '1669', '1155']) await expect(page.getByTestId(`dial-${n}`)).toHaveAttribute('href', `tel:${n}`);
  await page.getByRole('button', { name: 'ปิด' }).click();
  await expect(page.getByTestId('sos-send')).toHaveCount(0);
});

test('SOS only on the planner and navigation screens, top-right, covering nothing', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('ww_onboarded'));
  for (const path of ['/welcome', '/setup', '/data', '/contacts', '/privacy']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByTestId('sos'), path).toHaveCount(0);
  }
  await page.evaluate(() => {
    localStorage.setItem('ww_onboarded', '1');
    localStorage.setItem('ww_setup_done', '1');
  });
  await page.goto('/plan');
  const sos = page.getByTestId('sos');
  await expect(sos).toBeVisible();
  const b = (await sos.boundingBox())!;
  expect(b.x + b.width).toBeGreaterThan(page.viewportSize()!.width - 80);
  expect(b.y).toBeLessThan(80);
  const overlaps = await page.evaluate(({ x, y, w, h }) => {
    return [...document.querySelectorAll<HTMLElement>('button, a[href], input')]
      .filter((el) => !el.closest('[data-testid="sos"]') && el.offsetParent !== null)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.left < x + w && r.right > x && r.top < y + h && r.bottom > y).length;
  }, { x: b.x, y: b.y, w: b.width, h: b.height });
  expect(overlaps).toBe(0);
});

test('emergency contacts: validated, stored on the device only', async ({ page }) => {
  await page.goto('/contacts');
  await expect(page.getByTestId('contact-list')).toContainText('แม่');
  await page.getByTestId('contact-name').fill('พี่');
  await page.getByTestId('contact-phone').fill('12');
  await page.getByRole('button', { name: 'เพิ่มผู้ติดต่อ' }).click();
  await expect(page.getByRole('alert')).toContainText('เบอร์ไม่ถูกต้อง');
  await page.getByTestId('contact-phone').fill('089-999-0000');
  await page.getByRole('button', { name: 'เพิ่มผู้ติดต่อ' }).click();
  await expect(page.getByTestId('contact-list')).toContainText('0899990000');
  const stored = await page.evaluate(() => localStorage.getItem('ww_emergency_contacts'));
  expect(stored).toContain('0899990000');
  await page.getByRole('button', { name: 'ลบ พี่' }).click();
  await expect(page.getByTestId('contact-list')).not.toContainText('0899990000');
});

test('share location from navigation: LINE link with location, destination and ETA', async ({ page, context }) => {
  await context.route(/api\.open-meteo\.com/, (route) => route.fulfill({ json: { hourly: { time: [], cloud_cover: [] } } }));
  await page.clock.install({ time: new Date('2026-10-15T14:00:00+07:00') });
  await page.clock.resume(); // start at that time, then let it run like a real clock
  await page.goto('/plan');
  await page.getByTestId('point-from').click();
  await page.getByTestId('use-current').click();
  await expect(page.getByRole('heading', { name: 'ไปที่ไหน' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'ค้นหาสถานที่' }).fill('central');
  await page.getByTestId('search-results').getByRole('button', { name: /centralwOrld/ }).click();
  await page.getByTestId('find-routes').click();
  await page.getByTestId('start-nav').click();
  // SOS is on the navigation screen too, clear of its exit button and status.
  const sos = (await page.getByTestId('sos').boundingBox())!;
  const status = (await page.getByTestId('nav-status').boundingBox())!;
  expect(sos.x).toBeGreaterThanOrEqual(status.x + status.width - 1);
  await page.getByTestId('share-location').click();
  await expect(page.getByText(/ไม่ใช่การติดตามสด/).first()).toBeVisible();
  await expect.poll(async () => decodeURIComponent((await page.getByTestId('share-line').getAttribute('href'))!.split('text=')[1]!)).toMatch(/ตอนนี้อยู่ที่: https:\/\/maps\.google\.com/);
  const text = decodeURIComponent((await page.getByTestId('share-line').getAttribute('href'))!.split('text=')[1]!);
  expect(text).toContain('กำลังไป: เซ็นทรัลเวิลด์'); // curated landmark name (landmarks.ts)
  expect(text).toMatch(/คาดว่าถึงราว \d\d:\d\d/);
});
