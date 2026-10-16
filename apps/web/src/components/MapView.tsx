import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre looks for its worker next to its own module file, which no longer
// exists once bundled; hand it the emitted worker asset instead.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { activeCity } from '@walkwe/config';
import type { FeatureCollection } from 'geojson';
import type { LatLng, Route, WalkMode } from '@walkwe/core';
import { env } from '../env.ts';

// The only module that imports MapLibre. It is loaded with a dynamic import
// (MapView.lazy.ts), so the ~800 KB library never blocks first paint.

export interface MapViewProps {
  theme: WalkMode;
  from: LatLng | null;
  to: LatLng | null;
  /** Map is being used to drop a pin: no auto-fitting, report the centre. */
  pinMode: boolean;
  /** Visible bottom-sheet height; the map keeps its focus above it. */
  bottomInset: number;
  topInset: number;
  /** Room taken on the left by the desktop side panel. */
  leftInset?: number;
  /** Route alternatives to draw; the selected one gets the shade/sun styling. */
  routes?: Route[] | null;
  selectedRoute?: number;
  /** Navigation: the current step's point, and the walker's GPS position. */
  highlight?: LatLng | null;
  userLocation?: LatLng | null;
  onCenterChange?: (center: LatLng) => void;
  onUnavailable?: () => void;
  label: string;
}

maplibregl.setWorkerUrl(workerUrl);

const MAX_BOUNDS_PAD = 0.15; // degrees around the city, so panning stays local

const ROUTE_SOURCE = 'walkwe-routes';

function routesGeoJSON(routes: Route[], selected: number): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: routes.flatMap((r, ri) =>
      r.runs.map((run) => ({
        type: 'Feature' as const,
        // "shaded" = the good state of the route's metric: in shade by day,
        // better lit / watched / busy by night. Solid when good, dashed when not.
        properties: { sel: ri === selected ? 1 : 0, shaded: (r.metric === 'safety' ? (run.safety ?? 0) : run.shade) >= 0.5 ? 1 : 0 },
        geometry: { type: 'LineString' as const, coordinates: run.coordinates.map((c) => [c.lng, c.lat]) },
      })),
    ),
  };
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Route layers: alternatives in muted grey; the selected route with a casing,
 * shaded runs solid and sun-exposed runs dashed — distinguishable by line
 * style, not colour alone (brief §3).
 */
function addRouteLayers(map: maplibregl.Map, data: FeatureCollection) {
  if (map.getSource(ROUTE_SOURCE)) {
    (map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource).setData(data);
    return;
  }
  map.addSource(ROUTE_SOURCE, { type: 'geojson', data });
  const night = document.documentElement.dataset.theme === 'night';
  map.addLayer({
    id: 'route-alt',
    type: 'line',
    source: ROUTE_SOURCE,
    filter: ['==', ['get', 'sel'], 0],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': night ? '#5b7091' : '#8a9bb5', 'line-width': 5, 'line-opacity': 0.85 },
  });
  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: ROUTE_SOURCE,
    filter: ['==', ['get', 'sel'], 1],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': night ? cssVar('--ink-950') : '#ffffff', 'line-width': 11 },
  });
  map.addLayer({
    id: 'route-shade',
    type: 'line',
    source: ROUTE_SOURCE,
    filter: ['all', ['==', ['get', 'sel'], 1], ['==', ['get', 'shaded'], 1]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': cssVar('--shade-line'), 'line-width': 7 },
  });
  map.addLayer({
    id: 'route-sun',
    type: 'line',
    source: ROUTE_SOURCE,
    filter: ['all', ['==', ['get', 'sel'], 1], ['==', ['get', 'shaded'], 0]],
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': cssVar('--sun-line'), 'line-width': 7, 'line-dasharray': [1.1, 0.9] },
  });
}

function markerEl(kind: 'from' | 'to'): HTMLElement {
  const el = document.createElement('div');
  el.className = `marker marker--${kind}`;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export default function MapView({
  theme,
  from,
  to,
  pinMode,
  bottomInset,
  topInset,
  leftInset = 0,
  routes,
  selectedRoute = 0,
  highlight = null,
  userLocation = null,
  onCenterChange,
  onUnavailable,
  label,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<{ from?: maplibregl.Marker; to?: maplibregl.Marker; step?: maplibregl.Marker; me?: maplibregl.Marker }>({});
  const centerCb = useRef(onCenterChange);
  centerCb.current = onCenterChange;
  const themeRef = useRef(theme);
  const routeData = useRef<FeatureCollection | null>(null);

  // Create once.
  useEffect(() => {
    if (!containerRef.current) return;
    const [w, s, e, n] = activeCity.bounds;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: env.mapStyle[themeRef.current],
        center: [activeCity.center.lng, activeCity.center.lat],
        zoom: activeCity.defaultZoom,
        maxBounds: [
          [w - MAX_BOUNDS_PAD, s - MAX_BOUNDS_PAD],
          [e + MAX_BOUNDS_PAD, n + MAX_BOUNDS_PAD],
        ],
        attributionControl: { compact: true },
        // North-up, no tilt: one less way to get lost while walking.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch {
      onUnavailable?.();
      return;
    }
    map.touchZoomRotate.disableRotation();
    // Keep the compact attribution folded until the user taps ⓘ. MapLibre
    // expands it whenever the attribution text first arrives; expanded, it
    // covered a third of the navigation map and its flash became the page's
    // LCP. CSS hides the text until we've folded it (data-ww-ready).
    const attrib = containerRef.current.querySelector<HTMLElement>('.maplibregl-ctrl-attrib');
    if (attrib) {
      let userToggled = false;
      attrib.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.maplibregl-ctrl-attrib-button')) userToggled = true;
      });
      const fold = () => {
        if (userToggled) return;
        if (attrib.classList.contains('maplibregl-compact-show') || attrib.hasAttribute('open')) {
          attrib.classList.remove('maplibregl-compact-show');
          attrib.removeAttribute('open');
        }
        attrib.setAttribute('data-ww-ready', '');
      };
      new MutationObserver(fold).observe(attrib, { attributes: true, attributeFilter: ['class', 'open'] });
      fold();
    }
    map.on('style.load', () => {
      if (routeData.current) addRouteLayers(map, routeData.current);
    });
    map.keyboard.disableRotation();
    // Expose what is actually drawn (not just what was requested), so E2E can
    // assert that shade and sun runs are visible on screen.
    map.on('idle', () => {
      const count = (layer: string) => (map.getLayer(layer) ? map.queryRenderedFeatures({ layers: [layer] }).length : 0);
      const el = containerRef.current?.parentElement;
      el?.setAttribute('data-shade-runs', String(count('route-shade')));
      el?.setAttribute('data-sun-runs', String(count('route-sun')));
      el?.setAttribute('data-alt-runs', String(count('route-alt')));
    });
    map.on('moveend', () => {
      const c = map.getCenter();
      centerCb.current?.({ lat: c.lat, lng: c.lng });
    });
    mapRef.current = map;
    return () => {
      // Markers belong to this map: drop them too, or a remount (StrictMode)
      // would keep moving markers on the removed one.
      for (const m of Object.values(markers.current)) m?.remove();
      markers.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Day / night basemap.
  useEffect(() => {
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    mapRef.current?.setStyle(env.mapStyle[theme]);
  }, [theme]);

  // Route lines.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeData.current = routes?.length ? routesGeoJSON(routes, selectedRoute) : { type: 'FeatureCollection', features: [] };
    if (map.isStyleLoaded()) addRouteLayers(map, routeData.current);
    else map.once('load', () => routeData.current && addRouteLayers(map, routeData.current));
  }, [routes, selectedRoute]);

  // Navigation markers: current step and the walker (no camera moves here,
  // except centring on the step when it changes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const place = (key: 'step' | 'me', p: LatLng | null, cls: string) => {
      const m = markers.current[key];
      if (!p) {
        m?.remove();
        delete markers.current[key];
        return;
      }
      if (m) m.setLngLat([p.lng, p.lat]);
      else {
        const el = document.createElement('div');
        el.className = cls;
        el.setAttribute('aria-hidden', 'true');
        markers.current[key] = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
      }
    };
    place('step', highlight, 'marker marker--step');
    place('me', userLocation, 'marker marker--me');
  }, [highlight, userLocation]);

  useEffect(() => {
    if (highlight) mapRef.current?.easeTo({ center: [highlight.lng, highlight.lat], zoom: 18, duration: 300 });
  }, [highlight]);

  // Markers + camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const kind of ['from', 'to'] as const) {
      const p = kind === 'from' ? from : to;
      const existing = markers.current[kind];
      if (!p || pinMode) {
        existing?.remove();
        delete markers.current[kind];
        continue;
      }
      if (existing) existing.setLngLat([p.lng, p.lat]);
      else markers.current[kind] = new maplibregl.Marker({ element: markerEl(kind), anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
    }
    // One place decides the camera. Separate padding and framing animations
    // used to cancel each other when the sheet settled mid-fit.
    // The map's own padding always mirrors the chrome (top bar, sheet), so
    // "centre" means the visible area — the drop-pin overlay relies on it.
    // Set without animation; the move below then animates on top of it.
    map.setPadding({ top: topInset, bottom: bottomInset, left: leftInset, right: 0 });
    if (pinMode || highlight) return;
    const routeCoords = routes?.flatMap((r) => r.runs.flatMap((run) => run.coordinates)) ?? [];
    if (routeCoords.length) {
      const lngs = routeCoords.map((c) => c.lng), lats = routeCoords.map((c) => c.lat);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, maxZoom: 18, duration: 300 }); // short pilot walks fill the map
    } else if (from && to) {
      map.fitBounds(
        [
          [Math.min(from.lng, to.lng), Math.min(from.lat, to.lat)],
          [Math.max(from.lng, to.lng), Math.max(from.lat, to.lat)],
        ],
        { padding: 48, maxZoom: 17, duration: 300 },
      );
    } else if (from || to) {
      const p = (from ?? to)!;
      map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 16), duration: 300 });
    }
  }, [from, to, pinMode, bottomInset, topInset, leftInset, routes]);

  // MapLibre's CSS sets position: relative on its container, so the
  // positioning lives on a wrapper and the container just fills it.
  return (
    <div className="map-canvas" role="region" aria-label={label}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
