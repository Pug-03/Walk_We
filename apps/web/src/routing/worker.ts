/// <reference lib="webworker" />
import { activeCity } from '@walkwe/config';
import { Area, AreaRouter, RoutingError } from '@walkwe/core';
import { areaDatasetSchema, incidentsDatasetSchema, JsonRepository, toAreaInput, withoutPlaceholders, type IncidentsDataset } from '@walkwe/data';
import type { DatasetMeta, FromWorker, LayerInfo, ToWorker } from './protocol.ts';

// Loads the pilot dataset once, builds the graph, and answers route requests
// off the UI thread so the sheet and map stay smooth while A* runs.

const repo = new JsonRepository({ baseUrl: '/data/' });
let ready: Promise<{ router: AreaRouter; meta: DatasetMeta }> | null = null;

function load() {
  ready ??= Promise.all([
    repo.load('areas/siam', (raw) => areaDatasetSchema.parse(raw)),
    // A missing register is not fatal: route without it.
    repo.load(activeCity.incidents.dataset, (raw) => incidentsDatasetSchema.parse(raw)).catch((): IncidentsDataset | null => null),
  ]).then(([ds, inc0]) => {
    // Belt and braces: the build already strips placeholders; never use them in production.
    const inc = inc0 && import.meta.env.PROD ? withoutPlaceholders(inc0) : inc0;
    const area = new Area(
      toAreaInput(
        ds,
        (inc?.items ?? []).map((i) => ({ id: i.id, wayIds: i.wayIds, category: i.category, occurredOn: i.occurredOn, window: i.window, severity: i.severity })),
      ),
    );
    const router = new AreaRouter(area, {
      timeZone: activeCity.timezone,
      defaultMallHours: activeCity.defaultMallHours,
      walkSpeedMps: activeCity.walkSpeedMps,
      incidents: { halfLifeDays: activeCity.incidents.halfLifeDays, outsideWindow: activeCity.incidents.outsideWindow },
    });
    const L = ds.layers;
    const items = L.buildings.items;
    const sources = new Map<string, string>();
    // Sources behind day-mode routing (walkways + shade casters).
    for (const layer of [L.walkways, L.buildings, L.trees, L.elevated, L.malls]) {
      for (const s of layer.source) if (!s.name.startsWith('Walk We')) sources.set(s.name.split(' (')[0]!, s.license);
    }
    const layer = (id: LayerInfo['id'], l: { source: LayerInfo['sources']; updatedAt: string }, count: number): LayerInfo => ({
      id, sources: l.source, updatedAt: l.updatedAt, count,
    });
    const night = router.night;
    let litLen = 0, totLen = 0;
    for (let e = 0; e < area.edgeCount; e++) {
      totLen += area.elen[e]!;
      if (night.litKnown[e]) litLen += area.elen[e]!;
    }
    const meta: DatasetMeta = {
      updatedAt: ds.updatedAt,
      osmUpdatedAt: L.walkways.updatedAt,
      estimatedHeightShare: items.length ? items.filter((b) => b.heightSource !== 'height').length / items.length : 0,
      sources: [...sources].map(([name, license]) => ({ name, license })),
      layers: [
        layer('walkways', L.walkways, L.walkways.ways.length),
        layer('buildings', L.buildings, items.length),
        layer('trees', L.trees, L.trees.points.length / 4),
        layer('elevated', L.elevated, L.elevated.items.length),
        layer('malls', L.malls, L.malls.items.length),
        { id: 'cctv', sources: [...L.cctvBma.source, ...L.cctvOsm.source], updatedAt: L.cctvBma.updatedAt, count: (L.cctvBma.points.length + L.cctvOsm.points.length) / 2 },
        layer('lamps', L.lamps, L.lamps.points.length / 2),
        layer('pois', L.pois, L.pois.points.length / 4),
        ...(inc ? [layer('incidents', inc, inc.items.length)] : []),
      ],
      litKnownShare: totLen ? litLen / totLen : 0,
      malls: { total: L.malls.items.length, withHours: L.malls.items.filter((m) => m.hours).length },
      incidents: { total: inc?.items.length ?? 0, placeholders: inc?.items.filter((i) => i.placeholder).length ?? 0 },
    };
    return { router, meta };
  });
  ready.catch(() => (ready = null)); // allow a retry after a network failure
  return ready;
}

const post = (msg: FromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    const { router, meta } = await load();
    if (msg.type === 'warm') return post({ id: msg.id, type: 'ready', meta });
    const result = router.routeSync({ ...msg.request, departAt: new Date(msg.request.departAt) });
    post({ id: msg.id, type: 'result', result });
  } catch (err) {
    if (err instanceof RoutingError) post({ id: msg.id, type: 'error', reason: err.reason, message: err.message });
    else post({ id: msg.id, type: 'error', reason: ready ? 'internal' : 'data', message: String((err as Error)?.message ?? err) });
  }
};
