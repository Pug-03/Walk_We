import {
  CENTRALWORLD,
  SIAM,
  asReturningUser,
  expect,
  expectCoords,
  expectMarkersInView,
  expectNoHorizontalOverflow,
  mockNetwork,
  test,
} from './fixtures.ts';

// Phase 1 "Done when": the flow up to two selected coordinates works on all
// three screen sizes (each test runs once per project in playwright.config).

test('new user: landing → setup → current location → search → two coordinates', async ({ page, context }) => {
  await context.setGeolocation(SIAM);
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'เริ่มเลย' }).click();

  // Safety setup, once: own number; contact fields open only after "Add".
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByTestId('setup-name-0')).toHaveCount(0);
  await page.getByTestId('setup-self').fill('081-111-2222');
  await page.getByTestId('setup-add-contact').click();
  await page.getByTestId('setup-name-0').fill('แม่');
  await page.getByTestId('setup-phone-0').fill('089 999 0000');
  await page.getByTestId('setup-save').click();
  await expect(page).toHaveURL(/\/plan$/);
  expect(await page.evaluate(() => localStorage.getItem('ww_self'))).toContain('0811112222');
  expect(await page.evaluate(() => localStorage.getItem('ww_emergency_contacts'))).toContain('0899990000');

  // Start: current location, with the explainer before the browser prompt.
  await page.getByTestId('point-from').click();
  await page.getByTestId('use-current').click();
  await expect(page.getByRole('dialog', { name: 'ขอใช้ตำแหน่งของคุณ' })).toBeVisible();
  await context.grantPermissions(['geolocation']);
  await page.getByTestId('geo-allow').click();

  // The picker moves straight on to the destination.
  await expect(page.getByRole('heading', { name: 'ไปที่ไหน' })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'ค้นหาสถานที่' });
  await search.fill('central');
  await page.getByTestId('search-results').getByRole('button', { name: /centralwOrld/ }).click();

  await expect(page.getByTestId('ready')).toBeVisible();
  await expectCoords(page, 'from', SIAM.latitude, SIAM.longitude);
  await expectCoords(page, 'to', CENTRALWORLD.lat, CENTRALWORLD.lng);
  await expectNoHorizontalOverflow(page);
  await expectMarkersInView(page);

  // Onboarding is remembered: the root now opens the plan screen directly.
  await page.goto('/');
  await expect(page).toHaveURL(/\/plan$/);
});

test('drop a pin on the map for the destination', async ({ page, context }) => {
  await asReturningUser(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(SIAM);
  await page.goto('/plan');

  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  // The map must fill the screen (MapLibre's own CSS once collapsed it to 0 px).
  const mapBox = (await page.locator('.map-canvas').boundingBox())!;
  expect(mapBox.height).toBe(page.viewportSize()!.height);
  await page.getByTestId('point-to').click();
  await page.getByTestId('choose-on-map').click();
  await expect(page.getByTestId('confirm-pin')).toBeVisible();

  // Pan the map a little, then use the spot under the centre pin.
  const canvas = page.locator('.maplibregl-canvas');
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 3;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 60, cy + 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.getByTestId('confirm-pin').click();

  // Destination set from the pin; the picker now asks for the start.
  await expect(page.getByRole('heading', { name: 'เริ่มจากที่ไหน' })).toBeVisible();
  await expect(page.getByTestId('point-to')).toHaveCount(0); // picker replaces the card
  await page.getByTestId('use-current').click();
  await expect(page.getByTestId('ready')).toBeVisible();
  await expectCoords(page, 'from', SIAM.latitude, SIAM.longitude);
  const to = await page.getByTestId('point-to').getAttribute('data-coords');
  expect(to).toMatch(/^13\.7\d+, 100\.5\d+$/);
});

test('returning user: one tap on Home fills both points', async ({ page, context }) => {
  await asReturningUser(page, {
    ww_saved_places: [
      { id: 'osm:W157482067', name: 'centralwOrld', detail: 'ปทุมวัน', location: CENTRALWORLD, slot: 'home', savedAt: 1 },
    ],
  });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(SIAM);
  await page.goto('/');
  await expect(page).toHaveURL(/\/plan$/);

  await page.getByTestId('slot-home').click();
  await expect(page.getByTestId('ready')).toBeVisible();
  await expectCoords(page, 'from', SIAM.latitude, SIAM.longitude);
  await expectCoords(page, 'to', CENTRALWORLD.lat, CENTRALWORLD.lng);
});

test('location declined: explains how to turn it on, retry works, search is the fallback', async ({ page, context }) => {
  await asReturningUser(page);
  await context.setGeolocation(SIAM);
  await page.goto('/plan');
  await page.getByTestId('point-from').click();
  await page.getByTestId('use-current').click();
  await page.getByTestId('geo-allow').click(); // the browser refuses: no permission granted

  // A help dialog with steps for this kind of phone, not a vague toast.
  await expect(page.getByTestId('geo-help-denied')).toBeVisible();
  await expect(page.getByTestId('geo-help-denied').locator('li').first()).toBeVisible();

  // The user allows location in settings, then taps "Try again".
  await context.grantPermissions(['geolocation']);
  await page.getByTestId('geo-retry').click();
  await expect(page.getByRole('heading', { name: 'ไปที่ไหน' })).toBeVisible();
  await page.getByRole('button', { name: 'กลับ' }).click();
  await expectCoords(page, 'from', SIAM.latitude, SIAM.longitude);
});

test('location declined → "search instead" leaves the picker usable', async ({ page }) => {
  await asReturningUser(page);
  await page.goto('/plan');
  await page.getByTestId('point-from').click();
  await page.getByTestId('use-current').click();
  await page.getByTestId('geo-allow').click();
  await page.getByRole('button', { name: 'ค้นหาหรือปักหมุดแทน' }).click();
  const search = page.getByRole('searchbox', { name: 'ค้นหาสถานที่' });
  await expect(search).toBeFocused();
  await search.fill('siam');
  await page.getByTestId('search-results').getByRole('button', { name: /Siam Paragon/ }).click();
  await expect(page.getByRole('heading', { name: 'ไปที่ไหน' })).toBeVisible();
});

test('opened inside LINE: says to open in a browser', async ({ browser }) => {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0',
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
  });
  await mockNetwork(ctx);
  const page = await ctx.newPage();
  await asReturningUser(page);
  await page.goto('/plan');
  await page.getByTestId('point-from').click();
  await page.getByTestId('use-current').click();
  await page.getByTestId('geo-allow').click();
  await expect(page.getByTestId('geo-help-in-app')).toContainText('LINE');
  await ctx.close();
});

test('safety setup: validates numbers, can be skipped, and is asked only once', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('ww_onboarded', '1');
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByTestId('setup-self').fill('12');
  await page.getByTestId('setup-add-contact').click();
  await page.getByTestId('setup-name-0').fill('พี่');
  await page.getByTestId('setup-save').click();
  await expect(page.getByText('เบอร์ไม่ถูกต้อง').first()).toBeVisible();
  await expect(page.getByText('ใส่เบอร์ของผู้ติดต่อด้วย')).toBeVisible();
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByTestId('setup-skip').click();
  await expect(page).toHaveURL(/\/plan$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/plan$/); // not asked again
  expect(await page.evaluate(() => localStorage.getItem('ww_self'))).toBeNull();
});

test('/start replays the first-run flow and keeps the user’s data', async ({ page }) => {
  await asReturningUser(page, {
    ww_emergency_contacts: [{ id: '1', name: 'แม่', phone: '0812345678' }],
    ww_saved_places: [{ id: 'osm:W1', name: 'centralwOrld', detail: '', location: { lat: 13.7466, lng: 100.539 }, slot: 'home', savedAt: 1 }],
  });
  await page.goto('/start');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'เริ่มเลย' }).click();
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByTestId('setup-skip').click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByTestId('slot-home')).toContainText('บ้าน'); // saved place kept
  expect(await page.evaluate(() => localStorage.getItem('ww_emergency_contacts'))).toContain('0812345678'); // contact kept
});

test('judges’ demo: no numbers, opens the planner with the sample route already planned', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'เริ่มเลย' }).click();
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByTestId('setup-demo')).toBeInViewport(); // seen without scrolling
  await page.getByTestId('setup-demo').click();
  await expect(page).toHaveURL(/\/plan\?demo=1$/);
  await expect(page.getByTestId('start-nav')).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => localStorage.getItem('ww_self'))).toBeNull();
});

test('setup has a back arrow to the welcome page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'เริ่มเลย' }).click();
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByTestId('setup-back').click();
  await expect(page.getByTestId('landing-start')).toBeVisible();
});
