import { lazy } from 'react';

/** MapLibre lives in its own chunk, fetched when the map screen mounts. */
export const LazyMapView = lazy(() => import('./MapView.tsx'));
