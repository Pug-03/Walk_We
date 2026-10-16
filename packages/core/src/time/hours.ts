import { localTime } from './local.ts';

// A deliberately small subset of OSM `opening_hours`, enough for malls:
//   "24/7", "Mo-Su 10:00-22:00", "Mo-Fr 09:00-20:00; Sa,Su 10:00-21:00",
//   "Mo-Su,PH 10:00-22:00", "10:00-22:00", "Fr-Sa 10:00-02:00", "Su off".
// Anything outside the subset fails to parse, and callers fall back to the
// city's conservative default (and flag the hours as estimated).

export interface HoursRule {
  days: boolean[]; // index 0 = Monday
  spans: Array<[number, number]>; // minutes; end may exceed 1440 (past midnight)
}

export type OpeningHours = { always: true } | { always: false; rules: HoursRule[] };

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function parseDays(spec: string): boolean[] | null {
  const days = Array<boolean>(7).fill(false);
  for (const part of spec.split(',')) {
    const p = part.trim();
    if (p === 'PH' || p === 'SH') continue; // holidays: not modelled, ignore
    const m = p.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    const a = DAYS.indexOf(m[1]!);
    const b = m[2] ? DAYS.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) {
      days[i] = true;
      if (i === b) break;
    }
  }
  return days;
}

function parseTime(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

export function parseOpeningHours(raw: string | null | undefined): OpeningHours | null {
  const s = raw?.trim();
  if (!s) return null;
  if (s === '24/7') return { always: true };
  const rules: HoursRule[] = [];
  for (const chunk of s.split(';')) {
    const c = chunk.trim();
    if (!c) continue;
    const m = c.match(/^(?:([A-Za-z,\- ]+?)\s+)?(off|closed|[\d:,\- ]+)$/);
    if (!m) return null;
    const days = m[1] ? parseDays(m[1].replace(/\s+/g, '')) : Array<boolean>(7).fill(true);
    if (!days) return null;
    const spans: Array<[number, number]> = [];
    if (m[2] !== 'off' && m[2] !== 'closed') {
      for (const range of m[2]!.split(',')) {
        const [a, b] = range.trim().split('-');
        const start = parseTime((a ?? '').trim()), end0 = parseTime((b ?? '').trim());
        if (start == null || end0 == null) return null;
        spans.push([start, end0 <= start ? end0 + 1440 : end0]);
      }
    }
    // Later rules override earlier ones for the days they name (OSM semantics).
    for (const r of rules) r.days = r.days.map((d, i) => d && !days[i]);
    rules.push({ days, spans });
  }
  return rules.length ? { always: false, rules } : null;
}

/** Is it open at this instant, in this zone? Handles spans past midnight. */
export function isOpenAt(hours: OpeningHours, at: Date, timeZone: string): boolean {
  if (hours.always) return true;
  const { weekday, minutes } = localTime(at, timeZone);
  for (const r of hours.rules) {
    for (const [a, b] of r.spans) {
      if (r.days[weekday] && minutes >= a && minutes < b) return true;
      // Yesterday's span running past midnight.
      const y = (weekday + 6) % 7;
      if (r.days[y] && b > 1440 && minutes + 1440 >= a && minutes + 1440 < b) return true;
    }
  }
  return false;
}

/** Open for the whole window [at, at + minutes] (checked every 5 min). */
export function isOpenThrough(hours: OpeningHours, at: Date, minutes: number, timeZone: string): boolean {
  for (let m = 0; m <= minutes; m += 5) {
    if (!isOpenAt(hours, new Date(at.getTime() + m * 60_000), timeZone)) return false;
  }
  return true;
}
