import type { IncidentInput } from './types.ts';
import { isOpenAt, parseOpeningHours } from '../time/hours.ts';

// Past-incident weighting (brief §7): fades with age and applies mostly in
// the time window it is tied to (e.g. after-school hours).

export interface IncidentPolicy {
  /** Weight halves every this many days. */
  halfLifeDays: number;
  /** Share of the weight that still applies outside the incident's window. */
  outsideWindow: number;
  timeZone: string;
}

export function incidentWeight(inc: IncidentInput, at: Date, policy: IncidentPolicy): number {
  const ageDays = Math.max(0, (at.getTime() - Date.parse(inc.occurredOn)) / 86_400_000);
  const decay = 0.5 ** (ageDays / policy.halfLifeDays);
  const hours = parseOpeningHours(inc.window);
  const inWindow = hours ? isOpenAt(hours, at, policy.timeZone) : true;
  return inc.severity * decay * (inWindow ? 1 : policy.outsideWindow);
}
