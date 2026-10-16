import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowUp, ArrowUpLeft, ArrowUpRight, ChevronLeft, ChevronRight, CloudOff, CornerUpLeft, CornerUpRight,
  Flag, Footprints, Map as MapIcon, Rows3, Share2, Undo2, Volume2, WifiOff, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGo } from '../utils/transition.ts';
import { haversineMeters, type LatLng, type RouteStep } from '@walkwe/core';
import type { PhotoManifest } from '@walkwe/data';
import { LazyMapView } from '../components/MapView.lazy.ts';
import { MapBoundary } from '../components/MapBoundary.tsx';
import { InstallPrompt } from '../components/nav/InstallPrompt.tsx';
import { StepCarousel } from '../components/nav/StepCarousel.tsx';
import { PhotoViewer, StepPhoto } from '../components/nav/StepPhoto.tsx';
import { Dialog } from '../components/ui.tsx';
import { ShareLocation } from '../components/sos/ShareLocation.tsx';
import { env } from '../env.ts';
import { loadPhotoManifest } from '../nav/guides.ts';
import { prefetchForRoute } from '../nav/prefetch.ts';
import { loadSession, remainingM, saveSession, stepClosed, type NavSession } from '../nav/session.ts';
import { stepHints, stepInstruction } from '../nav/text.ts';
import { platform } from '../services.ts';
import { useI18n } from '../store/i18n.tsx';
import { useTheme } from '../store/theme.tsx';
import { getAccess } from '../store/access.ts';
import { speak, stopSpeaking } from '../utils/speak.ts';
import { activeCity } from '@walkwe/config';
import { formatDistance } from '../utils/format.ts';
import { useDesktop } from '../utils/useDesktop.ts';

const ICON: Record<RouteStep['maneuver'], typeof ArrowUp> = {
  depart: Footprints, straight: ArrowUp, 'slight-left': ArrowUpLeft, left: CornerUpLeft, 'sharp-left': CornerUpLeft,
  'slight-right': ArrowUpRight, right: CornerUpRight, 'sharp-right': CornerUpRight, uturn: Undo2, arrive: Flag,
};
/** GPS fixes worse than this aren't used for "distance to step". */
const USABLE_ACCURACY_M = 60;

/**
 * Step-by-step navigation (brief §5.8): photo cards in a reversible carousel,
 * a big "I'm here" button (GPS is unreliable downtown, so the walker
 * advances), a map toggle, wake lock, and a light vibration per step.
 */
export default function Navigate() {
  const { t, lang } = useI18n();
  const desktop = useDesktop();
  const { theme } = useTheme();
  const nav = useNavigate();
  const go = useGo();
  const [session, setSession] = useState<NavSession | null>(loadSession);
  const [manifest, setManifest] = useState<PhotoManifest | null>(null);
  const [view, setView] = useState<'steps' | 'map'>('steps');
  const [viewer, setViewer] = useState<{ photo: string; caption: string } | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [cachedRoute, setOfflineReady] = useState(false);
  // "Ready offline" needs both: the route's files cached AND a service worker
  // in control (otherwise an offline reload can't load the app at all).
  const [swControls, setSwControls] = useState(() => !!navigator.serviceWorker?.controller);
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw || swControls) return undefined;
    const on = () => setSwControls(!!sw.controller);
    sw.addEventListener('controllerchange', on);
    return () => sw.removeEventListener('controllerchange', on);
  }, [swControls]);
  const offlineReady = cachedRoute && swControls;
  const [me, setMe] = useState<{ p: LatLng; accuracy: number } | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!session && !arrived) nav('/plan', { replace: true });
  }, [session, arrived, nav]);

  useEffect(() => {
    loadPhotoManifest().then(setManifest, () => {});
  }, []);

  // Warm the offline caches for this route once per session.
  useEffect(() => {
    if (!session) return;
    const key = `ww_prefetched_${session.id}`;
    if (sessionStorage.getItem(key)) {
      setOfflineReady(true);
      return;
    }
    const line = session.route.runs.flatMap((r) => r.coordinates);
    const photos = session.steps.flatMap((s) => (s.guide ? [s.guide.photo] : []));
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      loadPhotoManifest()
        .then((m) => prefetchForRoute(line, photos, m, [env.mapStyle.day, env.mapStyle.night]))
        .then((r) => {
          if (r.ok > 0) {
            sessionStorage.setItem(key, '1');
            setOfflineReady(true);
          }
        })
        .catch(() => {});
    };
    // Don't compete with the step on screen: start once the page has loaded
    // and the browser is idle (the current photo is already on its way).
    const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 500));
    const start = () => setTimeout(idle, 300);
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
    };
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the screen on while navigating; re-acquire after the tab comes back.
  useEffect(() => {
    let release: (() => void) | null = null;
    const acquire = () => platform.keepAwake().then((r) => (release = r));
    void acquire();
    const onVis = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      release?.();
    };
  }, []);

  // High-accuracy GPS only while this screen is open, stopped on leave — and
  // only if location was already allowed: this screen never pops a
  // permission prompt by itself (brief §4). Steps work without it.
  useEffect(() => {
    let watch: { stop(): void } | null = null;
    let live = true;
    void platform.geoPermission().then((p) => {
      if (!live || p !== 'granted') return;
      watch = platform.watchPosition(
        (f) => setMe({ p: { lat: f.lat, lng: f.lng }, accuracy: f.accuracy }),
        () => setMe(null),
      );
    });
    return () => {
      live = false;
      watch?.stop();
    };
  }, []);

  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const goTo = useCallback(
    (i: number) => {
      setSession((s) => {
        if (!s || i === s.index || i < 0 || i >= s.steps.length) return s;
        const next = { ...s, index: i };
        saveSession(next);
        if (getAccess().haptics) platform.vibrate(getAccess().voice ? 12 : [18, 40, 18]);
        return next;
      });
    },
    [],
  );

  // Voice guidance: read each new step as it comes up (and the first one).
  const spokenIndex = useRef(-1);
  useEffect(() => {
    if (!session || arrived || !getAccess().voice || spokenIndex.current === session.index) return;
    spokenIndex.current = session.index;
    readStepRef.current?.(session.index);
  }, [session?.index, arrived]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSpeaking(), []);
  const readStepRef = useRef<((i: number) => void) | null>(null);

  const finish = () => {
    saveSession(null);
    setArrived(true);
    platform.vibrate([20, 60, 20]);
    if (getAccess().voice && session) void speak(`${t('nav.arrivedTitle')} ${t('nav.arrivedBody', { d: formatDistance(session.route.lengthM, lang), p: totalShade })}`, lang);
  };

  const exit = () => {
    saveSession(null);
    setSession(null);
    go('/plan', { replace: true, dir: 'back' });
  };

  const totalShade = useMemo(() => Math.round((session?.route.shadeShare ?? 0) * 100), [session]);

  if (arrived && session) {
    return (
      <main className="nav-screen nav-arrived page-enter">
        <div className="arrived-card">
          <span className="arrived-ic" aria-hidden="true">
            <Flag size={40} />
          </span>
          <h1 className="h1">{t('nav.arrivedTitle')}</h1>
          <p className="sub">{t('nav.arrivedBody', { d: formatDistance(session.route.lengthM, lang), p: totalShade })}</p>
        </div>
        <InstallPrompt />
        <button type="button" className="btn btn--primary nav-done" onClick={() => go('/plan', { replace: true })}>
          {t('nav.done')}
        </button>
      </main>
    );
  }
  if (!session) return null;

  const { index, steps } = session;
  const current = steps[index]!;
  const last = index === steps.length - 1;
  const minutesLeft = Math.max(1, Math.round(remainingM(session) / activeCity.walkSpeedMps / 60));
  const day = session.mode === 'day';
  const toStep = me && me.accuracy <= USABLE_ACCURACY_M ? haversineMeters(me.p, current.at) : null;

  const stepWords = (i: number) => {
    const s = steps[i]!;
    const instruction = s.guide ? s.guide.instruction[lang] : stepInstruction(s.step, lang);
    const hints = s.guide
      ? [s.distanceM > 0 ? (lang === 'th' ? `เดินต่อ ${formatDistance(s.distanceM, lang)}` : `Walk ${formatDistance(s.distanceM, lang)}`) : null, ...stepHints(s.step, 0, lang, day)].filter(Boolean)
      : stepHints(s.step, s.distanceM, lang, day);
    return { instruction, hints: hints as string[] };
  };
  const readStep = (i: number) => {
    const { instruction, hints } = stepWords(i);
    const lm = steps[i]!.guide ? t('nav.landmark', { l: steps[i]!.guide!.landmark[lang] }) : '';
    // Spoken form: units spelled out, one full stop between parts.
    const spoken = (x: string) =>
      x
        .replace(/(\d)\s*กม\./g, '$1 กิโลเมตร')
        .replace(/(\d)\s*ม\./g, '$1 เมตร')
        .replace(/[.\s]+$/, '');
    void speak([instruction, ...hints, lm].filter(Boolean).map(spoken).join('. '), lang);
  };

  readStepRef.current = readStep;

  const renderStep = (i: number) => {
    const s = steps[i]!;
    const Icon = ICON[s.step.maneuver];
    const { instruction, hints } = stepWords(i);
    const closed = stepClosed(s, new Date());
    return (
      <article className="step-card" aria-label={t('nav.step', { n: i + 1, total: steps.length })}>
        {s.guide ? (
          <StepPhoto
            photo={s.guide.photo}
            caption={s.guide.caption[lang]}
            manifest={manifest}
            eager={Math.abs(i - index) <= 1}
            priority={i === index}
            onOpen={() => setViewer({ photo: s.guide!.photo, caption: s.guide!.caption[lang] })}
          />
        ) : (
          <div className="step-icon" aria-hidden="true">
            <Icon size={96} strokeWidth={1.75} />
          </div>
        )}
        <div className="step-text">
          <p className="step-instruction" data-testid={i === index ? 'step-instruction' : undefined}>
            {s.guide && <Icon size={26} aria-hidden="true" className="step-inline-ic" />}
            {instruction}
          </p>
          {hints.length > 0 && <p className="small">{hints.join(' · ')}</p>}
          {i === index && (
            <button type="button" className="step-read" onClick={() => readStep(i)} data-testid="step-read">
              <Volume2 size={18} aria-hidden="true" />
              {t('access.read')}
            </button>
          )}
          {s.guide && <p className="small">{t('nav.landmark', { l: s.guide.landmark[lang] })}</p>}
          {closed && s.guide && (
            <p className="notice">
              <AlertTriangle size={18} aria-hidden="true" />
              {t('nav.closedWarn', { hours: s.guide.validHours })}
            </p>
          )}
          {s.guide && !s.guide.verified && import.meta.env.DEV && <p className="dev-note">{t('nav.draft')}</p>}
        </div>
      </article>
    );
  };

  return (
    <main className="nav-screen">
      <header className="nav-top">
        <button type="button" className="icon-btn" onClick={() => setConfirmExit(true)} aria-label={t('nav.exit')}>
          <X size={22} aria-hidden="true" />
        </button>
        <div className="nav-status" aria-live="polite" data-testid="nav-status">
          <strong>{t('nav.step', { n: index + 1, total: steps.length })}</strong>
          <span>{t('nav.remaining', { min: minutesLeft })}</span>
          {day ? <span>{t('nav.shade', { p: totalShade })}</span> : session.route.safetyScore != null && <span>{t('nav.safety', { s: session.route.safetyScore.toFixed(1) })}</span>}
        </div>
        {/* SOS (Phase 5) top-right. */}
        <span className="nav-top-slot" />
      </header>
      {/* Progress along the walk: one segment per step. */}
      <div className="nav-progress" aria-hidden="true">
        {steps.map((_, k) => (
          <span key={k} className={k < index ? 'is-done' : k === index ? 'is-on' : ''} />
        ))}
      </div>
      <div className="nav-body">
        <div className="nav-chips">
          {!online && (
            <span className="chip" role="status" data-testid="offline-chip">
              <WifiOff size={16} aria-hidden="true" />
              {t('nav.offline')}
            </span>
          )}
          {online && offlineReady && (
            <span className="chip" role="status" data-testid="offline-ready">
              <CloudOff size={16} aria-hidden="true" />
              {t('nav.offlineReady')}
            </span>
          )}
          {toStep != null && toStep > 15 && <span className="chip">{t('nav.fromHere', { d: formatDistance(toStep, lang) })}</span>}
        </div>

        {/* Desktop has room for both: map on the left, step cards on the right. */}
        {(desktop || view === 'steps') && (
          <StepCarousel index={index} count={steps.length} onIndex={goTo} renderStep={renderStep} label={t('nav.step', { n: index + 1, total: steps.length })} />
        )}
        {(desktop || view === 'map') && (
          <div className="nav-map">
            <MapBoundary onError={() => setView('steps')}>
              <Suspense fallback={<div className="map-skeleton" role="status" aria-label={t('common.loading')} />}>
                <LazyMapView
                  theme={theme}
                  from={null}
                  to={null}
                  pinMode={false}
                  bottomInset={0}
                  topInset={0}
                  routes={[session.route]}
                  selectedRoute={0}
                  highlight={current.at}
                  userLocation={me?.p ?? null}
                  label={t('map.label')}
                />
              </Suspense>
            </MapBoundary>
          </div>
        )}
      </div>

      <footer className="nav-bottom">
        <div className="nav-controls">
          <button type="button" className="icon-btn" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label={t('nav.prev')}>
            <ChevronLeft size={24} aria-hidden="true" />
          </button>
          {!desktop && (
            <button type="button" className="btn btn--ghost nav-toggle" onClick={() => setView(view === 'steps' ? 'map' : 'steps')} data-testid="toggle-map">
              {view === 'steps' ? <MapIcon size={20} aria-hidden="true" /> : <Rows3 size={20} aria-hidden="true" />}
              {view === 'steps' ? t('nav.showMap') : t('nav.showSteps')}
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => setSharing(true)} aria-label={t('share.button')} data-testid="share-location">
            <Share2 size={22} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" onClick={() => goTo(index + 1)} disabled={last} aria-label={t('nav.next')}>
            <ChevronRight size={24} aria-hidden="true" />
          </button>
        </div>
        <button type="button" className="btn btn--primary nav-here" onClick={() => (last ? finish() : goTo(index + 1))} data-testid="im-here">
          {last ? t('nav.finish') : t('nav.here')}
        </button>
      </footer>

      {sharing && (
        <ShareLocation
          known={me?.p ?? null}
          destination={{ name: session.destinationName ?? '', location: steps[steps.length - 1]!.at }}
          etaMin={minutesLeft}
          onClose={() => setSharing(false)}
        />
      )}
      {viewer && <PhotoViewer photo={viewer.photo} caption={viewer.caption} manifest={manifest} onClose={() => setViewer(null)} />}
      {confirmExit && (
        <Dialog
          title={t('nav.exitConfirm')}
          onClose={() => setConfirmExit(false)}
          actions={
            <>
              <button type="button" className="btn btn--primary" onClick={() => setConfirmExit(false)}>
                {t('nav.keepGoing')}
              </button>
              <button type="button" className="btn btn--text" style={{ justifySelf: 'center' }} onClick={exit}>
                {t('nav.exitYes')}
              </button>
            </>
          }
        />
      )}
    </main>
  );
}
