// Precompute per-edge sun exposure for the pilot area: every 30 minutes of
// daylight, on the 15th of each month (shade changes slowly across a month).
// Output is for future server-side use (an API can serve it instead of every
// phone computing shade); the app itself still computes on the device.
//
//   npx tsx scripts/precompute-shade.ts                 # current month
//   npx tsx scripts/precompute-shade.ts 2026-10 2026-11 # given months
//   npx tsx scripts/precompute-shade.ts --year 2026     # all 12 months
//
// Writes data/precomputed/shade/siam-YYYY-MM.json:
//   { area, datasetUpdatedAt, edges, slots: [{ at, sun, exposure: base64(Uint8[edges]) }] }
// exposure byte = round(sun share × 255), edge order = Area edge order
// (walkways in file order, consecutive node pairs).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { activeCity } from '@walkwe/config';
import { Area, sunPosition } from '@walkwe/core';
import { areaDatasetSchema, toAreaInput } from '@walkwe/data';

const args = process.argv.slice(2);
const months: string[] = args[0] === '--year'
  ? Array.from({ length: 12 }, (_, i) => `${args[1]}-${String(i + 1).padStart(2, '0')}`)
  : args.length
    ? args
    : [new Date().toISOString().slice(0, 7)];

const ds = areaDatasetSchema.parse(JSON.parse(await readFile(new URL('../data/areas/siam.json', import.meta.url), 'utf8')));
const area = new Area(toAreaInput(ds));
const outDir = fileURLToPath(new URL('../data/precomputed/shade/', import.meta.url));
await mkdir(outDir, { recursive: true });

// Bangkok has no DST; derive the offset from the city zone once.
const offset = '+07:00';
if (activeCity.timezone !== 'Asia/Bangkok') throw new Error('Set the UTC offset for this city before precomputing.');

for (const month of months) {
  const t0 = performance.now();
  const slots = [];
  for (let m = 6 * 60; m <= 19 * 60; m += 30) {
    const at = new Date(`${month}-15T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00${offset}`);
    const sun = sunPosition(at, area.proj.origin);
    if (sun.altitude <= 0) continue;
    const bytes = new Uint8Array(area.edgeCount);
    for (let e = 0; e < area.edgeCount; e++) bytes[e] = Math.round(area.edgeSunShare(e, sun) * 255);
    slots.push({
      at: at.toISOString(),
      sun: { altitude: +sun.altitude.toFixed(2), azimuth: +sun.azimuth.toFixed(2) },
      exposure: Buffer.from(bytes).toString('base64'),
    });
  }
  const file = `${outDir}${ds.id}-${month}.json`;
  await writeFile(file, JSON.stringify({ area: ds.id, datasetUpdatedAt: ds.updatedAt, edges: area.edgeCount, slots }));
  console.log(`${month}: ${slots.length} slots in ${((performance.now() - t0) / 1000).toFixed(1)}s → ${file}`);
}
