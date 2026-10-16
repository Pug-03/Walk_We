import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';


// Published datasets live in the repo-root data/ folder (the brief's layout,
// shared with scripts). This serves them at /data/ in dev and copies them
// into the build. Regression-only and precomputed files are left out.
const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));
const PUBLISHED = /^((areas|routes|incidents)\/[\w-]+\.json|routes\/photos\/generated\/[\w-]+\.(avif|webp|jpg)|routes\/photos\/generated\/manifest\.json)$/;
const isPublished = (rel: string) => PUBLISHED.test(rel) && !rel.includes('-prototype');

function listFiles(dir: string, base = ''): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const rel = base ? `${base}/${name}` : name;
    return statSync(path.join(dir, name)).isDirectory() ? listFiles(path.join(dir, name), rel) : [rel];
  });
}

// Preload the body fonts (Thai + Latin, regular + semibold) so text paints
// in IBM Plex Sans Thai without waiting for CSS to be parsed and laid out
// first — the late swap used to be the planner's LCP.
function preloadFonts(): Plugin {
  return {
    name: 'walkwe-preload-fonts',
    apply: 'build',
    transformIndexHtml(html, ctx) {
      const files = Object.keys(ctx.bundle ?? {}).filter((f) => /ibm-plex-sans-thai-(thai|latin)-(400|600)-normal-.*\.woff2$/.test(f));
      return {
        html,
        tags: files.map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', href: `/${f}`, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head' as const,
        })),
      };
    },
  };
}

function datasets(): Plugin {
  return {
    name: 'walkwe-datasets',
    configureServer(server) {
      server.middlewares.use('/data/', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0]!.replace(/^\//, ''));
        if (!isPublished(rel)) return next();
        const ext = rel.split('.').pop()!;
        res.setHeader('Content-Type', ext === 'json' ? 'application/json' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`);
        createReadStream(path.join(DATA_DIR, rel)).on('error', () => next()).pipe(res);
      });
    },
    generateBundle() {
      for (const rel of listFiles(DATA_DIR).filter(isPublished)) {
        let source: string | Buffer = readFileSync(path.join(DATA_DIR, rel));
        // Placeholder incidents are for development only: never ship them.
        if (rel.startsWith('incidents/')) {
          const d = JSON.parse(source.toString('utf8')) as { items: Array<{ placeholder?: boolean }> };
          d.items = d.items.filter((i) => i.placeholder !== true);
          source = JSON.stringify(d);
        }
        this.emitFile({ type: 'asset', fileName: `data/${rel}`, source });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    datasets(),
    preloadFonts(),
    // Offline (brief Phase 3): the app shell, the pilot dataset and route
    // guides are precached; map tiles and route photos are cached as they are
    // fetched — and prefetched for the whole route when navigation starts
    // (src/nav/prefetch.ts), so airplane mode mid-route keeps working.
    VitePWA({
      // A new version waits instead of reloading the page by itself: a reload
      // mid-SOS or mid-walk would lose that state. It applies on the next visit
      // (main.tsx also applies it straight away on the welcome page).
      registerType: 'prompt',
      injectRegister: false,
      manifest: false, // public/manifest.webmanifest is the source of truth
      workbox: {
        // Take control of the open page right away, so a first-time visitor
        // who starts navigating is covered without reloading.
        clientsClaim: true,
        skipWaiting: false,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mjs}', 'data/areas/*.json', 'data/routes/*.json', 'data/incidents/*.json', 'data/routes/photos/generated/manifest.json'],
        globIgnores: ['**/*-prototype.json'],
        // The walk graph (data/areas/siam.json, ~8.6 MB raw / ~1.5 MB gzip since the
        // area grew for 5 km walks) must be cached for offline routing.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/data/routes/photos/generated/'),
            handler: 'CacheFirst',
            options: { cacheName: 'route-photos', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            // OpenFreeMap styles, TileJSON, vector tiles, sprites and glyphs.
            urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'api.open-meteo.com',
            handler: 'NetworkFirst',
            options: { cacheName: 'weather', networkTimeoutSeconds: 3, expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 6 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  preview: { port: 4173 },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    // MapLibre is ~800 KB and only needed once the map screen mounts; it is
    // loaded through a dynamic import (see components/MapView.lazy.ts) so the
    // landing page and onboarding never pay for it.
    chunkSizeWarningLimit: 1200,
  },
});