import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Accessibility, CircleCheck, LocateFixed, MapPin, Mic, Moon, Sun } from 'lucide-react';
import { AccessPanel } from '../components/AccessPanel.tsx';
import { useAccess } from '../store/access.ts';
import { activeCity } from '@walkwe/config';
import {
  bboxContains,
  GeoError,
  haversineMeters,
  instantFromLocal,
  localInputValue,
  modeForTime,
  RoutingError,
  type LatLng,
  type NightFactor,
  type Place,
  type WalkMode,
} from '@walkwe/core';
import type { SavedPlace, SavedSlot } from '@walkwe/data';
import { BottomSheet, SIDE_PANEL_SPACE, TOP_RESERVE, type Snap } from '../components/BottomSheet.tsx';
import { useDesktop } from '../utils/useDesktop.ts';
import { ASK_LISTEN, AskBox } from '../components/plan/AskBox.tsx';
import { searchLandmarks } from '../components/plan/landmarks.ts';
import { LogoMark } from '../components/Logo.tsx';
import { useSpeech } from '../utils/useSpeech.ts';
import type { RouteIntent } from '@walkwe/core/ai';
import { LazyMapView } from '../components/MapView.lazy.ts';
import { MapBoundary } from '../components/MapBoundary.tsx';
import { PickerBody, PickerHeader } from '../components/plan/PlacePicker.tsx';
import { RouteCard } from '../components/plan/RouteCard.tsx';
import { ResultsHeader, RouteResults, type RoutingState } from '../components/plan/RouteResults.tsx';
import { WalkTimePanel, type Departure } from '../components/plan/WalkTimePanel.tsx';
import { GeoHelp, type GeoProblem } from '../components/plan/GeoHelp.tsx';
import { currentGeoEnvironment } from '../platform/geoEnv.ts';
import { SavedSlots } from '../components/plan/SavedSlots.tsx';
import { SettingsPanel } from '../components/plan/SettingsPanel.tsx';
import { usePlaceSearch } from '../components/plan/usePlaceSearch.ts';
import { Dialog, useToast } from '../components/ui.tsx';
import type { DatasetMeta } from '../routing/protocol.ts';
import { ai, geocoder, platform, routing, weather } from '../services.ts';
import { useI18n } from '../store/i18n.tsx';
import { usePlaces } from '../store/places.tsx';
import { CURRENT_ID, pinId, type Field, type PickedKind, type PickedPlace } from '../store/plan.ts';
import { useTheme } from '../store/theme.tsx';
import { useGo } from '../utils/transition.ts';
import { loadGuides } from '../nav/guides.ts';
import { buildSession, saveSession } from '../nav/session.ts';
import { coordText, formatDistance } from '../utils/format.ts';
import { safeAreaInset } from '../utils/safeArea.ts';
import { readJson, storage, writeJson } from '../utils/storage.ts';

const FACTORS_KEY = 'ww_night_factors';
const ALL_FACTORS: NightFactor[] = ['crowded', 'cctv', 'lit'];
function loadFactors(): NightFactor[] {
  const v = readJson(storage, FACTORS_KEY);
  const list = Array.isArray(v) ? (v.filter((x) => ALL_FACTORS.includes(x as NightFactor)) as NightFactor[]) : [];
  return list.length ? list : ALL_FACTORS; // default: all three
}

type Mode = { type: 'overview' } | { type: 'results' } | { type: 'pick'; field: Field; slot?: SavedSlot } | { type: 'pin'; field: Field; slot?: SavedSlot };

const SLOTS: SavedSlot[] = ['home', 'work', 'station', 'other'];

/**
 * Map-first planning screen: full-screen map, one bottom sheet. Phase 1
 * ends when both points are chosen; routing plugs in after that.
 */
/** Judges' demo (/plan?demo=1): the pilot route that has a photo guide. */
function demoPlaces(lang: 'th' | 'en'): { from: PickedPlace; to: PickedPlace } {
  return {
    from: { id: 'demo:bts-siam', name: lang === 'en' ? 'BTS Siam' : 'BTS สยาม', detail: '', location: { lat: 13.74563, lng: 100.53412 }, kind: 'search' },
    to: {
      id: 'demo:centralworld',
      name: lang === 'en' ? 'CentralWorld' : 'เซ็นทรัลเวิลด์',
      detail: '',
      location: { lat: 13.7465769, lng: 100.5390414 },
      kind: 'search',
    },
  };
}

export default function Plan() {
  const { t, lang } = useI18n();
  const { theme } = useTheme();
  const toast = useToast();
  const places = usePlaces();

  const [demo] = useState(() => (new URLSearchParams(window.location.search).has('demo') ? demoPlaces(lang) : null));
  const [from, setFrom] = useState<PickedPlace | null>(demo?.from ?? null);
  const [to, setTo] = useState<PickedPlace | null>(demo?.to ?? null);
  const [mode, setMode] = useState<Mode>({ type: 'overview' });
  const [snap, setSnap] = useState<Snap>('half');
  const [query, setQuery] = useState('');
  const [sheetH, setSheetH] = useState(0);
  // Mic on the planner: open the search and start listening at once.
  const [listenOnOpen, setListenOnOpen] = useState(false);
  const voiceOk = useSpeech(lang, () => {}).supported;
  const desktop = useDesktop();
  const leftInset = desktop ? SIDE_PANEL_SPACE : 0;
  const [topInset] = useState(() => TOP_RESERVE + safeAreaInset('top'));
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [geoAsk, setGeoAsk] = useState<{ field: Field; slot?: SavedSlot } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoHelp, setGeoHelp] = useState<{ problem: GeoProblem; field: Field; slot?: SavedSlot } | null>(null);
  const geoEnv = useMemo(currentGeoEnvironment, []);
  const [saveOpen, setSaveOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const access = useAccess();
  const [departure, setDeparture] = useState<Departure>({ kind: 'now' });
  const [modeOverride, setModeOverride] = useState<WalkMode | null>(null);
  const [factors, setFactorsState] = useState<NightFactor[]>(loadFactors);
  const setFactors = (f: NightFactor[]) => {
    setFactorsState(f);
    writeJson(storage, FACTORS_KEY, f);
  };
  const [routingState, setRoutingState] = useState<RoutingState | null>(null);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const routeRun = useRef(0);
  const mapCenter = useRef<LatLng>(activeCity.center);
  // Text first: fetch the ~280 KB map chunk only after the fonts are in and
  // the first frame has painted, so on a slow connection it never delays
  // what the user reads first (the sheet). The map follows a moment later.
  const [loadMap, setLoadMap] = useState(false);
  useEffect(() => {
    let live = true;
    const go = () => live && setLoadMap(true);
    const afterPaint = () =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => ('requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 800 }) : setTimeout(go, 50))),
      );
    const fallback = setTimeout(go, 2000); // never wait longer than this
    (document.fonts?.ready ?? Promise.resolve()).then(afterPaint, afterPaint);
    return () => {
      live = false;
      clearTimeout(fallback);
    };
  }, []);
  const searchRef = useRef<HTMLInputElement>(null);

  const near = from?.location ?? activeCity.center;
  const search = usePlaceSearch(mode.type === 'pick' ? query : '', lang, near);

  const openPick = useCallback((field: Field, slot?: SavedSlot) => {
    setQuery('');
    setMode(slot ? { type: 'pick', field, slot } : { type: 'pick', field });
    setSnap('full');
  }, []);

  const backToOverview = useCallback(() => {
    setListenOnOpen(false);
    setMode({ type: 'overview' });
    setQuery('');
    setSnap('half');
  }, []);

  /** One-shot position. On failure, explain why (instead of a vague toast). */
  const locate = useCallback(
    async (field: Field, slot?: SavedSlot): Promise<LatLng | null> => {
      setLocating(true);
      try {
        const fix = await platform.currentPosition();
        return { lat: fix.lat, lng: fix.lng };
      } catch (e) {
        const reason = e instanceof GeoError ? e.reason : 'unavailable';
        const problem: GeoProblem = reason === 'denied' ? (geoEnv.inApp ? 'in-app' : 'denied') : reason === 'unsupported' ? 'unsupported' : 'timeout';
        setGeoHelp(slot ? { problem, field, slot } : { problem, field });
        return null;
      } finally {
        setLocating(false);
      }
    },
    [geoEnv],
  );

  const placeFor = (loc: LatLng, slot?: SavedSlot): PickedPlace =>
    slot
      ? { id: pinId(loc), name: t('plan.pinnedPlace'), detail: coordText(loc), location: loc, kind: 'pin' }
      : { id: CURRENT_ID, name: t('plan.currentLocation'), detail: '', location: loc, kind: 'current' };

  const apply = useCallback(
    (field: Field, place: PickedPlace, slot?: SavedSlot) => {
      if (slot) {
        places.save(place, slot);
        toast(t('slot.saved', { slot: t(`slot.${slot}`) }));
        backToOverview();
        return;
      }
      if (place.kind !== 'current') places.noteUsed(place);
      if (!bboxContains(activeCity.pilotBounds, place.location)) toast(t('plan.outsidePilot'), 5000);
      const nextFrom = field === 'from' ? place : from;
      const nextTo = field === 'to' ? place : to;
      setFrom(nextFrom);
      setTo(nextTo);
      // Guide straight to whichever point is still missing.
      if (!nextTo) openPick('to');
      else if (!nextFrom) openPick('from');
      else backToOverview();
    },
    [from, to, places, toast, t, backToOverview, openPick],
  );

  const useCurrent = useCallback(
    async (field: Field, slot?: SavedSlot) => {
      const withSlot = <T extends object>(o: T) => (slot ? { ...o, slot } : o);
      // Problems no permission prompt can fix: say so straight away.
      if (!geoEnv.secure) return setGeoHelp(withSlot({ problem: 'insecure' as const, field }));
      const permission = await platform.geoPermission();
      if (permission === 'unsupported') return setGeoHelp(withSlot({ problem: 'unsupported' as const, field }));
      if (permission === 'granted') {
        const loc = await locate(field, slot);
        if (loc) apply(field, placeFor(loc, slot), slot);
        return;
      }
      // "prompt" — and also "denied", which some browsers report stale: explain
      // first, then really ask; a real refusal then shows how to turn it on.
      setGeoAsk(withSlot({ field }));
    },
    [apply, locate, geoEnv], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const confirmGeo = async () => {
    const ask = geoAsk;
    setGeoAsk(null);
    if (!ask) return;
    const loc = await locate(ask.field, ask.slot);
    if (loc) apply(ask.field, placeFor(loc, ask.slot), ask.slot);
  };

  const retryGeo = async () => {
    const h = geoHelp;
    setGeoHelp(null);
    if (!h) return;
    const loc = await locate(h.field, h.slot);
    if (loc) apply(h.field, placeFor(loc, h.slot), h.slot);
  };

  const pickPlace = (p: Place, kind: Extract<PickedKind, 'search' | 'saved' | 'recent'>) => {
    if (mode.type !== 'pick') return;
    apply(mode.field, { id: p.id, name: p.name, detail: p.detail, location: p.location, kind }, mode.slot);
  };

  const confirmPin = () => {
    if (mode.type !== 'pin') return;
    const loc = { ...mapCenter.current };
    apply(mode.field, { id: pinId(loc), name: t('plan.pinnedPlace'), detail: coordText(loc), location: loc, kind: 'pin' }, mode.slot);
  };

  // One tap on Home / Work / Station: it becomes the destination and, if
  // location is already allowed, the start is filled in from GPS.
  const goSaved = async (p: SavedPlace) => {
    const dest: PickedPlace = { id: p.id, name: p.name, detail: p.detail, location: p.location, kind: 'saved' };
    places.noteUsed(dest);
    setTo(dest);
    if (from) return backToOverview();
    if ((await platform.geoPermission()) === 'granted') {
      const loc = await locate('from');
      if (loc) {
        setFrom({ id: CURRENT_ID, name: t('plan.currentLocation'), detail: '', location: loc, kind: 'current' });
        return backToOverview();
      }
    }
    openPick('from');
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const departAt = (): Date => (departure.kind === 'now' ? new Date() : instantFromLocal(departure.local, activeCity.timezone));
  const autoMode = useMemo(
    () => modeForTime(departure.kind === 'now' ? new Date() : instantFromLocal(departure.local, activeCity.timezone), from?.location ?? activeCity.center),
    [departure, from],
  );

  // Load the pilot data in the background as soon as both points are known.
  useEffect(() => {
    if (from && to) routing.warm().then(setMeta, () => {});
  }, [from, to]);

  const findRoutes = async () => {
    if (!from || !to) return;
    const run = ++routeRun.current;
    const at = departAt();
    const mode = modeOverride ?? autoMode;
    setMode({ type: 'results' });
    setSnap('half');
    setSelectedRoute(0);
    setRoutingState({ status: 'loading' });
    // Walking only: a trip whose straight line is already past the limit isn't routed.
    if (haversineMeters(from.location, to.location) > activeCity.maxWalkM) {
      setRoutingState({ status: 'error', reason: 'too-far' });
      return;
    }
    // Cloud cover only matters by day; never let a slow forecast hold up the route.
    const cloud =
      mode === 'day'
        ? await Promise.race([weather.cloudCover(at, from.location).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 2500))])
        : null;
    try {
      const raw = await routing.route({ from: from.location, to: to.location, departAt: at, mode, cloudCover: cloud, nightFactors: factors, stepFree: access.stepFree });
      // Keep only walks within the limit (a detour for shade can push one over).
      const routes = raw.routes.filter((r) => r.lengthM <= activeCity.maxWalkM);
      if (run !== routeRun.current) return;
      if (!routes.length) setRoutingState({ status: 'error', reason: access.stepFree ? 'too-far-step-free' : 'too-far' });
      else setRoutingState({ status: 'done', result: { ...raw, routes }, mode, cloud });
    } catch (e) {
      if (run !== routeRun.current) return;
      setRoutingState({ status: 'error', reason: e instanceof RoutingError ? e.reason : 'failed' });
    }
  };
  // AI route request: the model only names the places and the time; places
  // are looked up with our own geocoder and the route comes from our router.
  const [pendingFind, setPendingFind] = useState(false);
  // "From here": ask for the position after the new destination has rendered,
  // so the usual permission flow (and its apply) sees it.
  const [pendingHere, setPendingHere] = useState(false);
  useEffect(() => {
    if (!pendingHere) return;
    setPendingHere(false);
    // Find routes only once "here" is known: finding first and then setting
    // the start would reset the sheet and hide the results.
    void useCurrent('from').then(() => setPendingFind(true));
  }, [pendingHere]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pendingFind && from && to) {
      setPendingFind(false);
      void findRoutes();
    }
  }, [pendingFind, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const lookUp = async (q: string): Promise<PickedPlace | null> => {
    // Same order as the search box: the pilot area's own landmarks first (the
    // public geocoder misses Thai names like "สยามพารากอน"), then Photon.
    const local = searchLandmarks(q, lang, 1);
    const [p] = local.length ? local : await geocoder.search({ text: q, lang, near: activeCity.center }).catch(() => []);
    return p ? { id: p.id, name: p.name, detail: p.detail, location: p.location, kind: 'search' } : null;
  };
  const onIntent = async (intent: RouteIntent): Promise<string | null> => {
    const [nextTo, nextFrom] = await Promise.all([
      intent.to.kind === 'place' ? lookUp(intent.to.query) : Promise.resolve(null),
      intent.from.kind === 'place' ? lookUp(intent.from.query) : Promise.resolve(null),
    ]);
    if (intent.to.kind === 'place' && !nextTo) return t('ai.ask.notFound', { q: intent.to.query });
    if (intent.from.kind === 'place' && !nextFrom) return t('ai.ask.notFound', { q: intent.from.query });
    // Same check as picking by hand: say so before routing, not after a failed route.
    for (const p of [nextTo, nextFrom]) {
      if (p && !bboxContains(activeCity.pilotBounds, p.location)) return t('ai.ask.outside', { name: p.name });
    }
    // Each request stands alone: "auto" clears an earlier day/night pick, so a
    // late "safer" request is never routed in a leftover day mode.
    setModeOverride(intent.mode === 'auto' ? null : intent.mode);
    if (intent.leave_at) {
      // A time already past today means the next one (tomorrow).
      const now = new Date();
      const today = localInputValue(now, activeCity.timezone).slice(0, 10);
      let local = `${today}T${intent.leave_at}`;
      if (instantFromLocal(local, activeCity.timezone).getTime() < now.getTime() - 5 * 60_000) {
        const tomorrow = localInputValue(new Date(now.getTime() + 24 * 3600_000), activeCity.timezone).slice(0, 10);
        local = `${tomorrow}T${intent.leave_at}`;
      }
      setDeparture({ kind: 'at', local });
    } else {
      setDeparture({ kind: 'now' });
    }
    if (nextTo) setTo(nextTo);
    if (nextFrom) setFrom(nextFrom);
    const summary = [intent.from.kind === 'current_location' ? t('ai.ask.here') : nextFrom?.name, nextTo?.name].filter(Boolean).join(' → ');
    const bits = [
      summary,
      intent.mode === 'day' ? t('ai.ask.day') : intent.mode === 'night' ? t('ai.ask.night') : '',
      intent.leave_at ? t('ai.ask.at', { time: intent.leave_at }) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const notes = [t('ai.ask.understood', { summary: bits })];
    if (intent.stops.length) notes.push(t('ai.ask.stops', { stops: intent.stops.join(', ') }));
    // The user's own position is resolved on the device (never sent to AI).
    if (intent.from.kind === 'current_location') setPendingHere(true);
    else setPendingFind(true);
    // The sheet switches to results, so the note goes in a toast, not the ask box.
    toast(notes.join(' '), 7000);
    return null;
  };

  // Judges' demo: plan the sample route straight away, once.
  const demoRan = useRef(false);
  useEffect(() => {
    if (!demo || demoRan.current) return;
    demoRan.current = true;
    void findRoutes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateTo = useGo();
  const startNavigation = async () => {
    if (routingState?.status !== 'done' || !from || !to) return;
    const route = routingState.result.routes[selectedRoute];
    if (!route) return;
    const guides = await loadGuides().catch(() => []);
    saveSession(buildSession(route, routingState.mode, from.location, to.location, guides, to.name));
    navigateTo('/navigate');
  };

  const leaveResults = () => {
    routeRun.current++;
    setRoutingState(null);
    setMode({ type: 'overview' });
    setSnap('half');
  };

  const pickTitle =
    (mode.type === 'pick' || mode.type === 'pin') && mode.slot
      ? t('slot.set', { slot: t(`slot.${mode.slot}`) })
      : t((mode.type === 'pick' || mode.type === 'pin') && mode.field === 'from' ? 'plan.pickFrom' : 'plan.pickTo');

  let header: React.ReactNode;
  let body: React.ReactNode = null;
  if (mode.type === 'results' && routingState) {
    header = <ResultsHeader onBack={leaveResults} mode={routingState.status === 'done' ? routingState.mode : (modeOverride ?? autoMode)} />;
    body = (
      <RouteResults
        state={routingState}
        selected={selectedRoute}
        onSelect={setSelectedRoute}
        onRetry={() => void findRoutes()}
        onChangeTo={() => openPick('to')}
        loadingMode={modeOverride ?? autoMode}
        onStart={() => void startNavigation()}
        meta={meta}
      />
    );
  } else if (mode.type === 'pin') {
    header = (
      <div style={{ display: 'grid', gap: 10 }}>
        <p className="small" style={{ textAlign: 'center' }}>
          {t('plan.pinHint')}
        </p>
        <button type="button" className="btn btn--primary" onClick={confirmPin} data-testid="confirm-pin">
          <MapPin size={22} aria-hidden="true" />
          {t('plan.usePin')}
        </button>
        <button type="button" className="btn btn--text" style={{ justifySelf: 'center' }} onClick={() => openPick(mode.field, mode.slot)}>
          {t('common.cancel')}
        </button>
      </div>
    );
  } else if (mode.type === 'pick') {
    header = (
      <PickerHeader
        ref={searchRef}
        title={pickTitle}
        query={query}
        onQuery={setQuery}
        onBack={backToOverview}
        onFocus={() => setSnap('full')}
        autoListen={listenOnOpen}
      />
    );
    body = (
      <PickerBody
        query={query}
        search={search}
        allowCurrent={mode.field === 'from' || !!mode.slot}
        locating={locating}
        saved={mode.slot ? [] : places.saved}
        recents={places.recents}
        onCurrent={() => void useCurrent(mode.field, mode.slot)}
        onPinMode={() => {
          if (mapUnavailable) return toast(t('map.unavailable'));
          setMode({ ...mode, type: 'pin' });
          setSnap('peek');
        }}
        onPick={pickPlace}
      />
    );
  } else {
    header = (
      <div className="plan-head">
        {desktop && (
          <div className="plan-brand">
            <LogoMark size={28} />
            <span>Walk We</span>
          </div>
        )}
        <div className="plan-title-row">
          <h2 className="plan-title">{t('plan.whereTo')}</h2>
          {/* Accessibility, one tap from the planner (lit when anything is on). */}
          <button
            type="button"
            className={`icon-btn plan-access${access.stepFree || access.voice || access.bigText ? ' is-on' : ''}`}
            onClick={() => setAccessOpen(true)}
            aria-label={t('access.title')}
            data-testid="plan-access"
          >
            <Accessibility size={22} aria-hidden="true" />
          </button>
          {voiceOk && (
            <button
              type="button"
              className="icon-btn plan-mic"
              onClick={() => {
                // With AI on, a spoken sentence ("to Paragon, no sun") goes to
                // the ask box; otherwise voice just fills the destination.
                if (ai) return void window.dispatchEvent(new Event(ASK_LISTEN));
                setListenOnOpen(true);
                openPick('to');
              }}
              aria-label={t('plan.voice')}
              data-testid="plan-mic"
            >
              <Mic size={22} aria-hidden="true" />
            </button>
          )}
        </div>
        <RouteCard from={from} to={to} onEdit={(f) => openPick(f)} onSwap={swap} />
      </div>
    );
    body = (
      <>
        {from && to && (
          <div className="ready fade-in" data-testid="ready" role="status">
            <span className="ready-title">
              <CircleCheck size={22} aria-hidden="true" />
              {t('plan.ready')}
            </span>
            <span className="small">{t('plan.distance', { d: formatDistance(haversineMeters(from.location, to.location), lang) })}</span>
            <WalkTimePanel
              departure={departure}
              onDeparture={setDeparture}
              autoMode={autoMode}
              override={modeOverride}
              onOverride={setModeOverride}
              factors={factors}
              onFactors={setFactors}
              onFind={() => void findRoutes()}
            />
            {to.kind !== 'current' && (
              <button type="button" className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => setSaveOpen(true)}>
                {t('plan.saveThis')}
              </button>
            )}
          </div>
        )}
        <AskBox onIntent={onIntent} />
        <SavedSlots saved={places.saved} onGo={(p) => void goSaved(p)} onSet={(slot) => openPick('to', slot)} onRemove={(p) => places.remove(p.slot, p.id)} />
        {places.recents.length > 0 && (
          <section aria-label={t('plan.recent')}>
            <h3 className="section-label">{t('plan.recent')}</h3>
            <ul className="list">
              {places.recents.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="row"
                    onClick={() => apply('to', { id: p.id, name: p.name, detail: p.detail, location: p.location, kind: 'recent' })}
                  >
                    <span className="row-ic" aria-hidden="true">
                      <MapPin size={20} />
                    </span>
                    <span className="row-text">
                      <span className="row-title">{p.name}</span>
                      {p.detail && <span className="row-detail">{p.detail}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <details className="settings-more">
          <summary>{t('plan.settingsMore')}</summary>
          <SettingsPanel />
        </details>
      </>
    );
  }

  return (
    <main className="map-screen">
      <header className="topbar">
        {/* On results, the chip names the mode the routes were computed in. */}
        {(() => {
          const m = mode.type === 'results' && routingState?.status === 'done' ? routingState.mode : theme;
          return (
            <span className={`chip chip--${m}`}>
              {m === 'day' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
              {t(m === 'day' ? 'mode.day' : 'mode.night')}
            </span>
          );
        })()}
        {/* SOS (Phase 5) goes top-right, the only control allowed up here. */}
      </header>

      <BottomSheet snap={snap} onSnapChange={setSnap} header={header} onVisibleHeight={setSheetH} label={t('plan.whereTo')}>
        {body}
      </BottomSheet>

      {/* Map after the panel in the DOM (both are positioned): Tab reaches
          the search fields first, then the map and its controls. */}
      {!loadMap ? (
        <div className="map-skeleton" role="status" aria-label={t('common.loading')} />
      ) : mapUnavailable ? (
        <div className="map-fallback">
          <p>{t('map.unavailable')}</p>
        </div>
      ) : (
        <MapBoundary onError={() => setMapUnavailable(true)}>
          <Suspense fallback={<div className="map-skeleton" role="status" aria-label={t('common.loading')} />}>
            <LazyMapView
              theme={theme}
              from={from?.location ?? null}
              to={to?.location ?? null}
              pinMode={mode.type === 'pin'}
              routes={mode.type === 'results' && routingState?.status === 'done' ? routingState.result.routes : null}
              selectedRoute={selectedRoute}
              bottomInset={sheetH}
              topInset={topInset}
              leftInset={leftInset}
              onCenterChange={(c) => (mapCenter.current = c)}
              onUnavailable={() => setMapUnavailable(true)}
              label={t('map.label')}
            />
          </Suspense>
        </MapBoundary>
      )}

      {mode.type === 'pin' && (
        <div aria-hidden="true" style={{ position: 'absolute', left: leftInset, right: 0, top: topInset, bottom: sheetH, pointerEvents: 'none' }}>
          <div className="center-pin" style={{ top: '50%' }}>
            <MapPin size={44} fill="currentColor" stroke="var(--white)" strokeWidth={1.5} />
          </div>
        </div>
      )}

      {geoAsk && (
        <Dialog
          title={t('geo.title')}
          icon={<LocateFixed size={28} aria-hidden="true" />}
          onClose={() => setGeoAsk(null)}
          actions={
            <>
              <button type="button" className="btn btn--primary" onClick={() => void confirmGeo()} data-testid="geo-allow">
                {t('geo.allow')}
              </button>
              <button type="button" className="btn btn--text" style={{ justifySelf: 'center' }} onClick={() => setGeoAsk(null)}>
                {t('geo.notNow')}
              </button>
            </>
          }
        >
          <p className="sub">{t('geo.body')}</p>
        </Dialog>
      )}

      {geoHelp && (
        <GeoHelp
          problem={geoHelp.problem}
          env={geoEnv}
          onRetry={() => void retryGeo()}
          onInstead={() => {
            setGeoHelp(null);
            requestAnimationFrame(() => searchRef.current?.focus());
          }}
        />
      )}

      {accessOpen && (
        <Dialog
          title={t('access.title')}
          icon={<Accessibility size={28} />}
          onClose={() => setAccessOpen(false)}
          actions={
            <button type="button" className="btn btn--primary" onClick={() => setAccessOpen(false)}>
              {t('access.done')}
            </button>
          }
        >
          <AccessPanel />
        </Dialog>
      )}

      {saveOpen && to && (
        <Dialog
          title={t('slot.saveAs')}
          onClose={() => setSaveOpen(false)}
          actions={
            <>
              {SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="btn"
                  onClick={() => {
                    places.save(to, slot);
                    setSaveOpen(false);
                    toast(t('slot.saved', { slot: t(`slot.${slot}`) }));
                  }}
                >
                  {t(`slot.${slot}`)}
                </button>
              ))}
              <button type="button" className="btn btn--text" style={{ justifySelf: 'center' }} onClick={() => setSaveOpen(false)}>
                {t('common.cancel')}
              </button>
            </>
          }
        >
          <p className="sub">{to.name}</p>
        </Dialog>
      )}
    </main>
  );
}
