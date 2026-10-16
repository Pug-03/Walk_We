import type { LatLng } from '../geo/types.ts';

export type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

export class GeoError extends Error {
  constructor(
    readonly reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported',
    message?: string,
  ) {
    super(message ?? reason);
    this.name = 'GeoError';
  }
}

export interface Fix extends LatLng {
  /** Metres, 95% radius as reported by the device. */
  accuracy: number;
  at: number;
}

export interface WatchHandle {
  stop(): void;
}

export interface ShareData {
  title?: string;
  text: string;
  url?: string;
}

/**
 * Device capabilities. Today: browser APIs. Later: Capacitor plugins on iOS
 * and Android, same interface. Implementations must never log or transmit
 * locations themselves.
 */
export interface PlatformAdapter {
  geoPermission(): Promise<GeoPermission>;
  /** One-shot, low-power fix. Rejects with GeoError. */
  currentPosition(opts?: { highAccuracy?: boolean; timeoutMs?: number }): Promise<Fix>;
  /** High-accuracy stream; for navigation only. Always stop() when done. */
  watchPosition(onFix: (fix: Fix) => void, onError: (err: GeoError) => void): WatchHandle;
  /** Returns false if no share sheet is available (caller falls back). */
  share(data: ShareData): Promise<boolean>;
  vibrate(pattern: number | number[]): void;
  /** Keeps the screen on; resolves to a release function (no-op if unsupported). */
  keepAwake(): Promise<() => void>;
  dial(number: string): void;
}
