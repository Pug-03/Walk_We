// Ported from DeePer's errorReporter, with one hard rule added: user
// location must never leave the device, so anything that looks like a
// coordinate is scrubbed before sending. Off unless VITE_ERROR_TRACKING_URL
// is set.

const MAX_PER_LOAD = 10;
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /Load failed|Failed to fetch|NetworkError/i];

// Decimal degrees with 3+ decimals (≈100 m) — lat/lng pairs, URL params
// (lat=13.74&lon=100.53), "13.7466,100.539" and the like.
const COORD = /-?\d{1,3}\.\d{3,}/g;

export function scrub(text: string): string {
  return text.replace(COORD, '[coord]');
}

export function installErrorReporter(endpoint: string | null): void {
  if (!endpoint || import.meta.env.DEV) return;
  const seen = new Set<string>();
  const send = (message: unknown, stack: unknown) => {
    const msg = scrub(String(message ?? '').trim());
    if (!msg || IGNORE.some((re) => re.test(msg)) || seen.has(msg) || seen.size >= MAX_PER_LOAD) return;
    seen.add(msg);
    try {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Path only: query strings and hashes could carry places.
        body: JSON.stringify({ message: msg, stack: scrub(String(stack ?? '')), path: location.pathname }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* reporting must never cause another error */
    }
  };
  window.addEventListener('error', (e) => {
    if (e.filename && !e.filename.startsWith(location.origin)) return;
    send(e.message, e.error?.stack);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    send(r?.message ?? String(r), r?.stack);
  });
}
