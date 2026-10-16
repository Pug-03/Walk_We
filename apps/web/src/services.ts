import { activeCity } from '@walkwe/config';
import { OpenMeteoCloud, PhotonGeocoder, type CloudCoverProvider, type GeocoderAdapter, type PlatformAdapter } from '@walkwe/core';
import type { AIAdapter } from '@walkwe/core/ai';
import { env } from './env.ts';
import { WebPlatform } from './platform/web.ts';
import { WorkerRoutingEngine } from './routing/WorkerRoutingEngine.ts';

// The one place adapters are chosen. Swapping Photon for Longdo, or the web
// platform for Capacitor, changes this file only.
export const geocoder: GeocoderAdapter = new PhotonGeocoder({ baseUrl: env.geocoderUrl, bounds: activeCity.bounds });
export const platform: PlatformAdapter = new WebPlatform();
export const routing = new WorkerRoutingEngine();
export const weather: CloudCoverProvider = new OpenMeteoCloud({ baseUrl: env.weatherUrl });
/**
 * Null when no proxy is configured: AI controls are hidden and the app runs on
 * manual input. The adapter (and its schemas) load on first use, so pages that
 * never touch AI don't download them.
 */
export const ai: AIAdapter | null = env.aiProxyUrl ? lazyAI(env.aiProxyUrl) : null;

function lazyAI(url: string): AIAdapter {
  let real: Promise<AIAdapter> | null = null;
  const load = () => (real ??= import('./ai/proxy.ts').then((m) => new m.ProxyAIAdapter(url)));
  return {
    parseRouteRequest: async (req, signal) => (await load()).parseRouteRequest(req, signal),
    explainRoute: async (facts, signal) => (await load()).explainRoute(facts, signal),
  };
}
