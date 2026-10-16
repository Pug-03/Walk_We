import { GeoError, type Fix, type GeoPermission, type PlatformAdapter, type ShareData, type WatchHandle } from '@walkwe/core';

const toFix = (p: GeolocationPosition): Fix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
  at: p.timestamp,
});

const toGeoError = (e: GeolocationPositionError): GeoError =>
  new GeoError(e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable', e.message);

/** Browser implementation of PlatformAdapter. Later: a Capacitor one. */
export class WebPlatform implements PlatformAdapter {
  async geoPermission(): Promise<GeoPermission> {
    if (!('geolocation' in navigator)) return 'unsupported';
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return status.state;
    } catch {
      // Safari < 16 has no Permissions API for geolocation.
      return 'prompt';
    }
  }

  async currentPosition({ highAccuracy = false, timeoutMs = 20_000 } = {}): Promise<Fix> {
    if (!('geolocation' in navigator)) throw new GeoError('unsupported');
    const once = (opts: PositionOptions) =>
      new Promise<Fix>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition((p) => resolve(toFix(p)), (e) => reject(toGeoError(e)), opts),
      );
    try {
      // Low accuracy + a 60 s cache: picking a start point doesn't need GPS
      // warm-up; high accuracy is reserved for navigation (watchPosition).
      // 20 s, not less: the first fix indoors or downtown can be slow.
      return await once({ enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: highAccuracy ? 0 : 60_000 });
    } catch (e) {
      // Timed out: accept any fix from the last 10 minutes rather than nothing.
      if (e instanceof GeoError && e.reason === 'timeout') {
        return once({ enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 });
      }
      throw e;
    }
  }

  watchPosition(onFix: (fix: Fix) => void, onError: (err: GeoError) => void): WatchHandle {
    if (!('geolocation' in navigator)) {
      onError(new GeoError('unsupported'));
      return { stop() {} };
    }
    const id = navigator.geolocation.watchPosition(
      (p) => onFix(toFix(p)),
      (e) => onError(toGeoError(e)),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    let stopped = false;
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        navigator.geolocation.clearWatch(id);
      },
    };
  }

  async share(data: ShareData): Promise<boolean> {
    if (typeof navigator.share !== 'function') return false;
    try {
      await navigator.share(data);
      return true;
    } catch (e) {
      // The user closing the sheet counts as handled, not as "no share sheet".
      return (e as Error)?.name === 'AbortError';
    }
  }

  vibrate(pattern: number | number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* iOS Safari has no vibration; silently skip */
    }
  }

  async keepAwake(): Promise<() => void> {
    try {
      const lock = await navigator.wakeLock?.request('screen');
      return () => void lock?.release().catch(() => {});
    } catch {
      return () => {};
    }
  }

  dial(number: string): void {
    window.location.href = `tel:${number.replace(/[^\d+]/g, '')}`;
  }
}
