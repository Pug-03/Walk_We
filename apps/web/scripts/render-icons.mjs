// Rasterises public/icon.svg into the PNG sizes the manifest and iOS need.
// Run: node scripts/render-icons.mjs (uses Playwright's Chromium).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [180, 192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url)), omitBackground: true });
}
await browser.close();
