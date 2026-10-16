// Why "use current location" might not work here, so the app can say so
// plainly instead of a vague "permission denied". Pure (UA + flags in),
// so it's unit-tested.

export type InApp = 'line' | 'facebook' | 'instagram' | 'tiktok' | null;
export type Os = 'ios' | 'android' | 'desktop';

export interface GeoEnvironment {
  /** Geolocation only works on https:// (or localhost). */
  secure: boolean;
  /** In-app browsers often block location. */
  inApp: InApp;
  os: Os;
}

export function geoEnvironment(ua: string, secure: boolean, maxTouchPoints = 0, platform = ''): GeoEnvironment {
  const inApp: InApp = /\bLine\//i.test(ua)
    ? 'line'
    : /FBAN|FBAV|FB_IAB/.test(ua)
      ? 'facebook'
      : /Instagram/.test(ua)
        ? 'instagram'
        : /musical_ly|TikTok|BytedanceWebview/i.test(ua)
          ? 'tiktok'
          : null;
  const ios = /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const os: Os = ios ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop';
  return { secure, inApp, os };
}

export function currentGeoEnvironment(): GeoEnvironment {
  return geoEnvironment(navigator.userAgent, window.isSecureContext, navigator.maxTouchPoints, navigator.platform);
}
