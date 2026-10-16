import type { LatLng } from '../geo/types.ts';

// Interfaces for the next step of location sharing (brief §8). Not used by
// the MVP, which shares a one-off location link over LINE. A later
// implementation (e.g. Supabase Realtime) plugs in here without UI changes.
//
// Rules any implementation must keep:
//   • links are unguessable (≥ 128-bit random token) and expire
//   • positions are kept only until the session ends or expires
//   • the walker can stop sharing at any time
//   • browsers stop GPS when the screen locks: the UI must say the page has
//     to stay open (a native app could do background location later)

export interface LiveShareSession {
  /** Opaque, unguessable token in the share URL. */
  token: string;
  url: string;
  expiresAt: Date;
}

export interface LiveShareService {
  start(opts: { destination: LatLng | null; etaMin: number | null; ttlMin: number }): Promise<LiveShareSession>;
  publish(token: string, fix: { lat: number; lng: number; accuracy: number; at: number }): Promise<void>;
  /** "I'm here" / arrived: ends the session and tells watchers. */
  arrived(token: string): Promise<void>;
  stop(token: string): Promise<void>;
}

/** "Alert my friends if I don't tap Arrived within X minutes." */
export interface ArrivalWatch {
  arm(opts: { token: string; deadline: Date; contacts: string[] }): Promise<void>;
  disarm(token: string): Promise<void>;
}

/** 128-bit random token, base64url (22 chars). Works in browsers and Node. */
export function shareToken(bytes = 16): string {
  const b = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
