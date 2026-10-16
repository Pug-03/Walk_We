import { defineConfig, devices } from '@playwright/test';

// The three target screens from the brief. Chromium with mobile emulation
// (viewport, DPR, touch, UA); real iOS Safari is covered by the manual
// TESTING_CHECKLIST.md.
const iPhoneUA = devices['iPhone 15']!.userAgent;
const webgl = { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] };

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    trace: 'retain-on-failure',
    launchOptions: webgl,
  },
  projects: [
    {
      name: 'iphone-se',
      use: { browserName: 'chromium', viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: iPhoneUA },
    },
    {
      name: 'iphone-15',
      use: { browserName: 'chromium', viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: iPhoneUA },
    },
    {
      name: 'pixel-7',
      use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } },
    },
  ],
  webServer: {
    // Test the production build, not the dev server.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
