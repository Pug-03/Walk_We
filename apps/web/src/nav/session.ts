import { z } from 'zod';
import { activeCity } from '@walkwe/config';
import { isOpenAt, matchGuide, parseOpeningHours, type LatLng, type Route, type RouteStep, type WalkMode } from '@walkwe/core';
import type { GuideDirection, RouteGuide } from '@walkwe/data';
import { readJson, storage, writeJson } from '../utils/storage.ts';

// A navigation session: the chosen route plus the steps to show. Steps come
// from a photo guide when one matches the route, else from the router's
// generated turn-by-turn. Persisted on the device so a reload — even offline
// — resumes at the same step.

export interface NavStep {
  /** Generated step data (always present: drives wording when no guide). */
  step: RouteStep;
  /** Photo-guide content for this step, when a guide matched. */
  guide: {
    photo: string;
    caption: { th: string; en: string };
    instruction: { th: string; en: string };
    landmark: { th: string; en: string };
    validHours: string;
    verified: boolean;
  } | null;
  distanceM: number;
  at: LatLng;
}

export interface NavSession {
  id: string;
  mode: WalkMode;
  startedAt: number;
  route: Route;
  steps: NavStep[];
  guideId: string | null;
  index: number;
  /** For share messages ("heading to …"). */
  destinationName?: string;
}

const KEY = 'ww_nav';
const sessionSchema = z.object({
  id: z.string(),
  mode: z.enum(['day', 'night']),
  startedAt: z.number(),
  route: z.any(),
  steps: z.array(z.any()).min(1),
  guideId: z.string().nullable(),
  index: z.number().int().min(0),
  destinationName: z.string().optional(),
});

export function buildSession(route: Route, mode: WalkMode, from: LatLng, to: LatLng, guides: RouteGuide[], destinationName?: string): NavSession {
  const line = route.runs.flatMap((r) => r.coordinates);
  let dir: GuideDirection | null = null;
  for (const g of guides) {
    dir = matchGuide(
      { ...g, directions: g.directions.map((d) => ({ ...d, steps: d.steps.map((s) => ({ lat: s.lat, lng: s.lng })) })) },
      from, to, line,
    ) as GuideDirection | null;
    if (dir) {
      dir = g.directions.find((d) => d.id === (dir as GuideDirection).id) ?? null;
      break;
    }
  }
  const steps: NavStep[] = dir
    ? dir.steps.map((s, i) => ({
        // Pair each guide step with the nearest generated step for icons/hints.
        step: nearestStep(route.steps, s) ?? route.steps[Math.min(i, route.steps.length - 1)]!,
        guide: { photo: s.photo, caption: s.caption, instruction: s.instruction, landmark: s.landmark, validHours: s.validHours, verified: s.verified },
        distanceM: s.distanceM,
        at: { lat: s.lat, lng: s.lng },
      }))
    : route.steps.map((s) => ({ step: s, guide: null, distanceM: s.distanceM, at: s.at }));
  return { id: `${Date.now()}`, mode, startedAt: Date.now(), route, steps, guideId: dir?.id ?? null, index: 0, ...(destinationName ? { destinationName } : {}) };
}

function nearestStep(steps: RouteStep[], p: LatLng): RouteStep | null {
  let best: RouteStep | null = null, bd = Infinity;
  for (const s of steps) {
    const d = (s.at.lat - p.lat) ** 2 + (s.at.lng - p.lng) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/**
 * Remaining walk (m) from the start of step `index`, on the route's own
 * length: photo-guide steps carry rounded distances of their own, so their
 * share of the steps is applied to the computed route length (the same number
 * the results card showed).
 */
export function remainingM(s: NavSession, index = s.index): number {
  const total = s.steps.reduce((sum, st) => sum + st.distanceM, 0);
  const left = s.steps.slice(index).reduce((sum, st) => sum + st.distanceM, 0);
  const routeM = typeof s.route?.lengthM === 'number' ? s.route.lengthM : total;
  return total > 0 ? (left / total) * routeM : routeM;
}

/** A guide step whose place may be closed when the walker gets there. */
export function stepClosed(step: NavStep, at: Date): boolean {
  if (!step.guide) return false;
  const hours = parseOpeningHours(step.guide.validHours);
  return hours ? !isOpenAt(hours, at, activeCity.timezone) : false;
}

export const saveSession = (s: NavSession | null) => (s ? writeJson(storage, KEY, s) : storage.removeItem(KEY));
export function loadSession(): NavSession | null {
  const r = sessionSchema.safeParse(readJson(storage, KEY));
  if (!r.success) return null;
  const s = r.data as NavSession;
  return s.index < s.steps.length ? s : null;
}
