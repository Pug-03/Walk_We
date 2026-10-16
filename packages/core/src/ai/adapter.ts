import { z } from 'zod/v4';

// AI features (Phase 7). The model only turns words into a request and
// numbers into a sentence; routing, shade and safety stay algorithmic. Every
// feature has a manual path, so the app works fully when AI is off or fails.

/** Where a route end comes from: the user's own GPS (resolved on the device) or a place name to look up. */
export const routeEndSchema = z.object({
  kind: z.enum(['current_location', 'place', 'unspecified']),
  /** Place name as the user said it (Thai or English); empty unless kind is "place". */
  query: z.string().max(120),
});

/**
 * A natural-language route request, as structured fields. The app resolves
 * place names with its own geocoder and runs its own router; nothing here is
 * a coordinate or a route.
 */
export const routeIntentSchema = z.object({
  from: routeEndSchema,
  to: routeEndSchema,
  /** "day" = shadiest, "night" = safer (based on available data), "auto" = by departure time. */
  mode: z.enum(['day', 'night', 'auto']),
  /** Departure as local Bangkok time "HH:MM", or empty for now. */
  leave_at: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
  /** Stops the user asked for ("ผ่านเซเว่น"); the router can't add stops yet, so the app says so. */
  stops: z.array(z.string().max(80)).max(3),
  /** Set when the request can't be understood as a walk; the app shows it and asks again. */
  clarification: z.string().max(200),
});
export type RouteIntent = z.infer<typeof routeIntentSchema>;

/** What the request body to the proxy may contain for parsing (no coordinates, ever; unknown fields are refused). */
export const parseRequestSchema = z.strictObject({
  text: z.string().trim().min(2).max(300),
  lang: z.enum(['th', 'en']),
});
export type ParseRequest = z.infer<typeof parseRequestSchema>;

/** The computed comparison the explanation is allowed to talk about. Numbers only, no places or coordinates. */
export const routeFactsSchema = z.strictObject({
  lang: z.enum(['th', 'en']),
  mode: z.enum(['day', 'night']),
  minutes: z.number().int().min(0).max(600),
  meters: z.number().int().min(0).max(50_000),
  shortestMeters: z.number().int().min(0).max(50_000),
  /** Day: share of the walk in shade, 0..100. */
  shadePct: z.number().int().min(0).max(100).nullable(),
  shortestShadePct: z.number().int().min(0).max(100).nullable(),
  /** Night: safety score 0..10 (based on available data). */
  safety: z.number().min(0).max(10).nullable(),
  shortestSafety: z.number().min(0).max(10).nullable(),
  /** True when the recommended route is the shortest one. */
  isShortest: z.boolean(),
});
export type RouteFacts = z.infer<typeof routeFactsSchema>;

export const explanationSchema = z.object({ text: z.string().min(1).max(280) });

/** Swap point for the AI provider (Claude via the proxy today). */
export interface AIAdapter {
  parseRouteRequest(req: ParseRequest, signal?: AbortSignal): Promise<RouteIntent>;
  explainRoute(facts: RouteFacts, signal?: AbortSignal): Promise<string>;
}

export class AIUnavailableError extends Error {
  constructor(public readonly reason: 'off' | 'rate_limited' | 'failed' | 'invalid') {
    super(`AI unavailable: ${reason}`);
    this.name = 'AIUnavailableError';
  }
}

/**
 * Guard against invented facts: every number in the sentence must be one of
 * the computed numbers (or a difference between them). Thai digits count too.
 */
export function explanationMatchesFacts(text: string, facts: RouteFacts): boolean {
  const thai = '๐๑๒๓๔๕๖๗๘๙';
  const ascii = text.replace(/[๐-๙]/g, (d) => String(thai.indexOf(d))).replace(/(\d),(\d)/g, '$1$2');
  const allowed = new Set<number>();
  const add = (n: number | null) => {
    if (n == null) return;
    allowed.add(Math.round(n * 10) / 10);
    allowed.add(Math.round(n));
  };
  const vals = [facts.minutes, facts.meters, facts.shortestMeters, facts.shadePct, facts.shortestShadePct, facts.safety, facts.shortestSafety];
  vals.forEach(add);
  add(facts.meters - facts.shortestMeters);
  add(Math.abs(facts.meters - facts.shortestMeters));
  if (facts.shadePct != null && facts.shortestShadePct != null) add(facts.shadePct - facts.shortestShadePct);
  if (facts.safety != null && facts.shortestSafety != null) add(facts.safety - facts.shortestSafety);
  add(10); // "/10" on the safety scale
  const found = ascii.match(/\d+(?:\.\d+)?/g) ?? [];
  return found.every((s) => {
    const n = Number(s);
    return allowed.has(n) || allowed.has(Math.round(n * 10) / 10);
  });
}
