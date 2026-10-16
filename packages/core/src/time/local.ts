export interface LocalTime {
  /** 0 = Monday … 6 = Sunday (ISO order, matching OSM opening_hours). */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
  /** YYYY-MM-DD in the local zone. */
  date: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Wall-clock time in an IANA zone, independent of the device's zone. */
export function localTime(at: Date, timeZone: string): LocalTime {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    weekday: WEEKDAY[parts.weekday!] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Minutes the zone is ahead of UTC at this instant. */
export function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const lt = localTime(at, timeZone);
  const asUtc = Date.parse(`${lt.date}T00:00:00Z`) + lt.minutes * 60_000;
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/**
 * The instant at which the zone's wall clock reads `local` ("YYYY-MM-DDTHH:mm",
 * as from <input type="datetime-local">). Planning happens in the city's
 * time, whatever zone the phone is set to.
 */
export function instantFromLocal(local: string, timeZone: string): Date {
  const naive = Date.parse(`${local}:00Z`);
  if (Number.isNaN(naive)) throw new Error(`bad local time: ${local}`);
  let guess = naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60_000;
  // Second pass settles DST edges; a no-op for fixed-offset zones like Bangkok.
  guess = naive - zoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess);
}

/** "YYYY-MM-DDTHH:mm" wall-clock text for an instant in a zone. */
export function localInputValue(at: Date, timeZone: string): string {
  const lt = localTime(at, timeZone);
  const hh = String(Math.floor(lt.minutes / 60)).padStart(2, '0');
  const mm = String(lt.minutes % 60).padStart(2, '0');
  return `${lt.date}T${hh}:${mm}`;
}
