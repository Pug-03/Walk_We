// Route photos: placeholders + responsive variants (brief §4/§9).
//
//   npm run photos
//
// Source photos live in data/routes/photos/<name>.jpg — the names the route
// guides reference (siam-cw-01.jpg, …). Any missing one is created as a
// labelled placeholder. Drop a real photo in with the same name and run this
// again: it is detected (hash differs from the generated placeholder) and
// re-encoded. Output, served at /data/routes/photos/generated/:
//   <base>-<w>.avif / .webp / .jpg  for w in WIDTHS (never upscaled)
//   manifest.json                   size, blur placeholder, placeholder flag

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { photoManifestSchema, routeGuideSchema, type PhotoManifest } from '@walkwe/data';

const ROUTES = fileURLToPath(new URL('../data/routes/', import.meta.url));
const SRC = `${ROUTES}photos/`;
const OUT = `${SRC}generated/`;
const WIDTHS = [480, 960, 1440];
// Placeholders stay small: thin line art is costly to encode and they are not photos.
const PLACEHOLDER_W = 960, PLACEHOLDER_H = 720;

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Placeholders are a slice of the welcome page's street drawing (the 2400-wide
// panorama, a different stretch per step): clearly an illustration, never
// passed off as a photo, and no dev text that could reach a demo screen. The
// app badges them "รูปตัวอย่าง ยังไม่ใช่รูปจริง" from the manifest flag.
const PANORAMA = fileURLToPath(new URL('../apps/web/public/art/street-wide-day.svg', import.meta.url));
const panorama = existsSync(PANORAMA) ? await readFile(PANORAMA, 'utf8') : null;
function placeholderSvg(n: number): string {
  const inner = panorama ? panorama.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '') : '';
  // 4:3 window onto the street (sidewalk at the bottom), moved along per step.
  const w = 760, h = 570;
  const x = 40 + ((n - 1) * 197) % (2400 - w - 80);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PLACEHOLDER_W}" height="${PLACEHOLDER_H}" viewBox="${x} 300 ${w} ${h}">
  <rect x="${x}" y="300" width="${w}" height="${h}" fill="#050B1A"/>${inner}
</svg>`;
}

const guides = (await readdir(ROUTES)).filter((f) => f.endsWith('.json'));
const steps = new Map<string, string>();
for (const f of guides) {
  const g = routeGuideSchema.parse(JSON.parse(await readFile(`${ROUTES}${f}`, 'utf8')));
  for (const d of g.directions) for (const s of d.steps) steps.set(s.photo, s.caption.en);
}

await mkdir(OUT, { recursive: true });
const prevPath = `${OUT}manifest.json`;
const prev = existsSync(prevPath) ? photoManifestSchema.parse(JSON.parse(await readFile(prevPath, 'utf8'))) : null;
const hashesPath = `${OUT}placeholder-hashes.json`;
const placeholderHashes: Record<string, string> = existsSync(hashesPath) ? JSON.parse(await readFile(hashesPath, 'utf8')) : {};

const manifest: PhotoManifest = { updatedAt: new Date().toISOString(), photos: {} };
let i = 0;
for (const [photo] of steps) {
  i++;
  const src = `${SRC}${photo}`;
  // Missing, or still an untouched placeholder from an earlier run: (re)draw it.
  const stale = existsSync(src) && placeholderHashes[photo] === sha(await readFile(src));
  if (!existsSync(src) || stale) {
    const jpg = await sharp(Buffer.from(placeholderSvg(i))).jpeg({ quality: 82 }).toBuffer();
    await writeFile(src, jpg);
    placeholderHashes[photo] = sha(jpg);
    console.log(`created placeholder ${photo}`);
  }
  const buf = await readFile(src);
  const placeholder = placeholderHashes[photo] === sha(buf);
  const img = sharp(buf).rotate(); // respect EXIF orientation from phones
  const meta = await img.metadata();
  const width = meta.autoOrient?.width ?? meta.width!;
  const height = meta.autoOrient?.height ?? meta.height!;
  const base = photo.replace(/\.jpg$/, '');
  const widths = WIDTHS.filter((w) => w <= width);
  if (!widths.length) widths.push(width);
  for (const w of widths) {
    const resized = sharp(buf).rotate().resize({ width: w });
    await writeFile(`${OUT}${base}-${w}.avif`, await resized.clone().avif({ quality: 50 }).toBuffer());
    await writeFile(`${OUT}${base}-${w}.webp`, await resized.clone().webp({ quality: 72 }).toBuffer());
    await writeFile(`${OUT}${base}-${w}.jpg`, await resized.clone().jpeg({ quality: 78, mozjpeg: true }).toBuffer());
  }
  const blur = await sharp(buf).rotate().resize({ width: 24 }).blur(1.2).webp({ quality: 40 }).toBuffer();
  manifest.photos[photo] = { width, height, blur: `data:image/webp;base64,${blur.toString('base64')}`, placeholder, widths };
  const was = prev?.photos[photo]?.placeholder;
  if (was && !placeholder) console.log(`real photo detected: ${photo}`);
}

await writeFile(prevPath, JSON.stringify(photoManifestSchema.parse(manifest), null, 2));
await writeFile(hashesPath, JSON.stringify(placeholderHashes, null, 2));
const real = Object.values(manifest.photos).filter((p) => !p.placeholder).length;
console.log(`${Object.keys(manifest.photos).length} photos (${real} real, ${Object.keys(manifest.photos).length - real} placeholders) → ${OUT}`);
