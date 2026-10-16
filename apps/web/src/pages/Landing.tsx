import { useEffect, useRef, useState } from 'react';
import { ArrowRight, PlayCircle, Check, ChevronDown, MapPin } from 'lucide-react';
import { useInView, useReducedMotion } from 'framer-motion';
import { sunPosition, sunTimes, type WalkMode } from '@walkwe/core';
import type { CSSProperties, ReactNode } from 'react';
import { LangToggle } from '../components/LangToggle.tsx';
import { LogoMark } from '../components/Logo.tsx';
import { TLink } from '../components/TLink.tsx';
import { hasDoneSetup } from '../store/contacts.ts';
import type { StringKey } from '../i18n.ts';
import { useI18n } from '../store/i18n.tsx';
import { markOnboarded } from '../store/onboarding.ts';
import { TEAM } from '../team.ts';
import { HowItWorks } from '../components/welcome/HowItWorks.tsx';
import { Features, RouteBand } from '../components/welcome/Features.tsx';
import { useGo } from '../utils/transition.ts';
import { useDesktop } from '../utils/useDesktop.ts';
import { useSceneProgress } from '../utils/useSceneProgress.ts';

// Welcome, on DeePer's landing structure (brief: reuse DeePer, change colour
// and content): brand and tagline, the faceted street drawing as the hero
// picture (its shade layer fades in), big primary action, a scroll cue, and a
// short section below on what the app does. On desktop the street becomes a
// full-width panorama that builds itself, held behind the page; its sky shows
// where the sun over Siam is right now (the same sun the shade engine uses),
// and scrolling plays the rest of the day into night.

// ---------- Below the fold: heading | body sections, then the street at night ----------


/** Rises into place the first time it scrolls into view (DeePer's Reveal). */
function Reveal({ as: Tag = 'div', className = '', delay = 0, children }: { as?: 'div' | 'li'; className?: string; delay?: number; children?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const still = useReducedMotion();
  return (
    <Tag ref={ref as never} className={`reveal${seen || still ? ' is-in' : ''} ${className}`} style={delay ? { transitionDelay: `${delay}s` } : undefined}>
      {children}
    </Tag>
  );
}

// ---------- Scroll cue (DeePer's, as-is) ----------
const CUE_FADE_PX = 140;
function ScrollCue({ label, hint, target }: { label: string; hint: string; target: () => HTMLElement | null }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const p = Math.min(window.scrollY / CUE_FADE_PX, 1);
      ref.current?.style.setProperty('--cue-p', String(p));
      setGone(p >= 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="scroll-cue-wrap">
      <button
        ref={ref}
        type="button"
        className={`scroll-cue${gone ? ' is-gone' : ''}`}
        aria-label={label}
        tabIndex={gone ? -1 : undefined}
        onClick={() => target()?.scrollIntoView({ behavior: 'smooth' })}
      >
        {/* A mouse with a moving wheel dot, and a short line saying what scrolling does. */}
        <svg className="cue-mouse" viewBox="0 0 24 34" aria-hidden="true">
          {/* Body, the split between the two buttons, and the wheel turning. */}
          <rect x="3" y="1" width="18" height="31" rx="9" />
          <path d="M12 1 V12 M3.6 12 H20.4" />
          <rect className="cue-wheel" x="10.5" y="4" width="3" height="6" rx="1.5" />
        </svg>
        <span className="cue-text" aria-hidden="true">
          {hint}
        </span>
        <ChevronDown size={20} strokeWidth={2} aria-hidden="true" className="cue-chev" />
      </button>
    </div>
  );
}

// ---------- Faceted street drawing, in layers ----------
// Each layer is one static image animated as a whole (transform, opacity,
// clip-path on an already-rasterised image: cheap), so the street assembles
// itself smoothly: road first, then buildings, the BTS, trees and people.
// Back-to-front order matters: nearer layers cover farther ones.
const LAYERS = ['bts', 'train', 'lamps', 'trees', 'ground', 'people'] as const;

// Buildings come one by one (scripts/build-art.ts buildingPieces): each is a
// small image rising from the ground, in order from the left edge to the right.
type Piece = { x: number; y: number; w: number; h: number; svg: string };
type Pieces = { w: number; top: number; h: number; pieces: Piece[] };
const piecesCache: Record<string, Promise<Pieces>> = {};
function usePieces(wide: boolean): Pieces | null {
  const url = `/art/street-${wide ? 'wide-' : ''}buildings.json`;
  const [data, setData] = useState<Pieces | null>(null);
  useEffect(() => {
    let live = true;
    (piecesCache[url] ??= fetch(url).then((r) => r.json() as Promise<Pieces>)).then((d) => live && setData(d), () => {});
    return () => {
      live = false;
    };
  }, [url]);
  return data;
}

function Buildings({ wide }: { wide: boolean }) {
  const d = usePieces(wide);
  if (!d) return null;
  const span = d.h - d.top;
  return (
    <div className="sl sl-buildings">
      {d.pieces.map((p, i) => (
        <div
          key={i}
          className="bp"
          style={
            {
              left: `${(p.x / d.w) * 100}%`,
              top: `${((p.y - d.top) / span) * 100}%`,
              width: `${(p.w / d.w) * 100}%`,
              height: `${(p.h / span) * 100}%`,
              // Left edge to right edge, whatever the height.
              '--d': `${(0.3 + ((p.x + p.w / 2) / d.w) * 1.1).toFixed(2)}s`,
            } as CSSProperties
          }
        >
          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(p.svg)}`} alt="" decoding="async" />
        </div>
      ))}
    </div>
  );
}

function StreetLayers({ wide, night, glow, play = true }: { wide: boolean; night: boolean; glow: 'shade' | 'light' | 'none'; play?: boolean }) {
  const src = (name: string) => `/art/street-${wide ? 'wide-' : ''}layer-${name}.svg`;
  const size = wide ? { width: 2400, height: 920 } : { width: 1000, height: 920 };
  return (
    <div className={`street-layers${night ? ' is-night' : ''}${play ? ' is-play' : ''}`} aria-hidden="true">
      {!wide && !night && <img className="sl sl-sky" src={src('sun')} alt="" {...size} decoding="async" />}
      {!wide && night && <PhoneMoon />}
      <Buildings wide={wide} />
      {LAYERS.map((name) => (
        <img key={name} className={`sl sl-${name}`} src={src(name)} alt="" {...size} decoding="async" />
      ))}
      {/* The glow image animates itself from load (lamps flicker on after the
          posts), so it is only mounted once the street starts building. */}
      {glow !== 'none' && play && (
        <img
          className={`sl sl-${glow}`}
          src={`/art/street-${wide ? 'wide-' : ''}${glow === 'shade' ? 'day-shade' : 'night-light'}.svg`}
          alt=""
          {...size}
          decoding="async"
        />
      )}
    </div>
  );
}

/** Phones: the full moon in the top corner of the street's sky. */
function PhoneMoon() {
  return (
    <div className="sl sl-sky sl-moon">
      <FullMoon />
    </div>
  );
}

/** The page's last scene: the street at night, built when it scrolls into view. */
function NightStreet({ wide }: { wide: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.3 });
  return (
    <div ref={ref} className={`street-art${wide ? ' street-art--wide' : ''}`}>
      <StreetLayers wide={wide} night glow="light" play={seen} />
    </div>
  );
}

/** Phones: the street under the brand. */
function StreetArt({ mode }: { mode: WalkMode }) {
  return (
    <div className="street-art">
      <StreetLayers wide={false} night={mode === 'night'} glow={mode === 'day' ? 'shade' : 'light'} />
    </div>
  );
}

// ---------- Sky helpers ----------
const SIAM = { lat: 13.7457, lng: 100.534 };
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), MINUTE);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * How far the drawn shade leans (deg, CSS skewX about the kerb line): the sun
 * on the left (morning, east) throws it right, on the right throws it left,
 * and a lower sun throws it further.
 */
function shadeSkew(azimuth: number, altitude: number): number {
  const reach = Math.min(1, 1 / Math.tan((Math.max(altitude, 4) * Math.PI) / 180) / 3);
  return (azimuth < 180 ? 1 : -1) * (8 + 30 * reach);
}

/**
 * Bearing and height to a spot in the sky box (0..1 each), right of the copy.
 * `sink` lets a body go on below the horizon line (y > 0.94), down behind
 * the buildings, instead of stopping on it.
 */
function skyPoint(azimuth: number, altitude: number, sink = false): { x: number; y: number } {
  const x = 0.46 + Math.min(Math.max((azimuth - 80) / 200, 0), 1) * 0.5;
  const alt = sink ? Math.max(altitude, -14) : Math.max(altitude, 0);
  const y = 0.94 - Math.min(alt / 80, 1) * 0.8;
  return { x, y };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The night's moon: always full, with its maria and a few craters, sitting in
 * the corner of the sky (a picture of night, not a phase readout).
 */
function FullMoon() {
  return (
    <svg className="moon-disc" viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="moonLit" cx="-0.25" cy="-0.3" r="1.1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#EEF4FF" />
          <stop offset="1" stopColor="#C9D6F2" />
        </radialGradient>
      </defs>
      <circle r={48} fill="#EEF4FF" opacity={0.08} />
      <circle r={44} fill="url(#moonLit)" />
      <g fill="#B7C5E6" opacity={0.75}>
        <path d="M-24 -18 C-14 -26 2 -22 4 -12 C6 -2 -6 4 -16 2 C-26 0 -32 -10 -24 -18 Z" />
        <path d="M8 6 C18 0 30 6 28 16 C26 26 12 28 6 22 C0 16 0 10 8 6 Z" />
        <path d="M-10 18 C-4 16 0 22 -4 26 C-8 30 -16 28 -16 24 C-16 20 -14 19 -10 18 Z" />
      </g>
      <g fill="none" stroke="#A9B8DC" strokeWidth={1.6}>
        <circle cx={20} cy={-22} r={6} />
        <circle cx={-30} cy={14} r={4} />
        <circle cx={26} cy={-4} r={3} />
        <circle cx={-6} cy={-32} r={3.5} />
        <circle cx={6} cy={34} r={2.5} />
      </g>
      <g fill="#FFFFFF" opacity={0.7}>
        <circle cx={19} cy={-23.5} r={2} />
        <circle cx={-29.4} cy={12.8} r={1.4} />
      </g>
    </svg>
  );
}

// ---------- Desktop stage: the sky and the street, held in place while the page scrolls ----------
// Scrolling plays the rest of the day: from now to the evening (or, at night,
// to the next morning). The sun moves along today's path, the shade leans with
// it, and at sunset the street switches to its lamp-lit night drawing. The
// sections scroll over this one picture, so the page reads as a single walk.

/** Where the scroll story ends: this evening after dark, or (already dark) the next late morning. */
function storyEnd(now: Date): Date {
  const { sunrise, sunset } = sunTimes(now, SIAM);
  if (now >= sunrise && now < sunset) return new Date(sunset.getTime() + 1.5 * HOUR);
  // Already dark: the story stays in the night (the moon moves, lamps stay
  // on) and stops well before the next sunrise.
  const nextRise = sunrise > now ? sunrise : sunTimes(new Date(now.getTime() + 24 * HOUR), SIAM).sunrise;
  return new Date(Math.min(now.getTime() + 4 * HOUR, nextRise.getTime() - HOUR));
}

// ---------- Easter egg: stay on the first screen 15 s without scrolling ----------
// A small plane tows a "scroll down" banner past MahaNakhon. Once per visit; scrolling clears it.
const IDLE_MS = 15_000;
function TowerShow() {
  const { t } = useI18n();
  const still = useReducedMotion();
  const [on, setOn] = useState(false);
  useEffect(() => {
    let played = false;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      if (played) return;
      timer = window.setTimeout(() => {
        if (window.scrollY < 40) {
          played = true;
          setOn(true);
        }
      }, IDLE_MS);
    };
    const onScroll = () => {
      if (window.scrollY > 40) setOn(false);
      arm();
    };
    arm();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  if (!on) return null;
  return (
    <div className="tower-show" aria-live="polite">
      {/* A small plane tows a banner past the tower first. */}
      {!still && (
        <div className="ts-plane" aria-hidden="true">
          <span className="ts-banner">{t('welcome.eggBanner')} ↓</span>
          <span className="ts-rope" />
          <svg className="ts-craft" viewBox="0 0 64 28" width="64" height="28">
            <path d="M2 14 L46 11 Q60 12 62 14 Q60 16 46 17 Z" />
            <path d="M30 12 L22 1 L28 1 L40 12 Z M30 16 L22 27 L28 27 L40 16 Z M6 13 L2 5 L6 5 L12 13 Z" />
            <circle cx="52" cy="14" r="1.6" className="ts-window" />
          </svg>
        </div>
      )}
    </div>
  );
}

function Stage({ now, scene }: { now: Date; scene: React.RefObject<HTMLElement | null> }) {
  const { t, lang } = useI18n();
  const still = useReducedMotion();
  const p = useSceneProgress(scene, !still, 0.012);
  // The first stretch of scroll stays on "now" so the hero reads as live.
  // The day starts playing once the about text has settled in place (about 0.35 of the scene).
  const story = still ? 0 : smooth(0.3, 0.97, p);
  const at = new Date(now.getTime() + story * (storyEnd(now).getTime() - now.getTime()));
  const sun = sunPosition(at, SIAM);
  const night = 1 - smooth(-6, 2, sun.altitude); // 0 day .. 1 night, blended through dusk
  const mode: WalkMode = night > 0.5 ? 'night' : 'day';
  const clock = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });

  // Today's sun path: one smooth arch from the street at sunrise, over the
  // noon high point, back down to the street at sunset (no straight drops).
  // Across: where the sun rises and sets (azimuth); height: today's noon
  // altitude. The sun, its hour marks and the path all sit on the same arch,
  // placed by time of day, so the sun climbs out from behind the buildings
  // and sinks back behind them.
  const { sunrise, sunset } = sunTimes(at, SIAM);
  const span = sunset.getTime() - sunrise.getTime();
  const noonAlt = sunPosition(new Date(sunrise.getTime() + span / 2), SIAM).altitude;
  const xL = skyPoint(sunPosition(sunrise, SIAM).azimuth, 0).x;
  const xR = skyPoint(sunPosition(sunset, SIAM).azimuth, 0).x;
  // The ground line sits 640/920 of the way down the panorama, below the sky box.
  const panoH = (window.innerWidth * 920) / 2400;
  const skyH = Math.max(1, window.innerHeight - panoH);
  const ground = 1 + (panoH * 640) / 920 / skyH;
  const apex = skyPoint(180, noonAlt).y;
  const arch = (u: number) => ({
    x: (xL + xR) / 2 - ((xR - xL) / 2) * Math.cos(Math.PI * u),
    y: ground - (ground - apex) * Math.sin(Math.PI * u),
  });
  const dayFrac = (d: Date) => (d.getTime() - sunrise.getTime()) / span;
  const path: string[] = [];
  for (let k = 0; k <= 120; k++) {
    const { x, y } = arch(k / 120);
    path.push(`${k ? 'L' : 'M'}${(x * 1000).toFixed(1)} ${(y * 1000).toFixed(1)}`);
  }
  const ticks: { label: string; x: number; y: number }[] = [];
  for (const h of [6, 9, 12, 15, 18]) {
    // Hour h on the Bangkok calendar day of `at` (UTC+7, no DST).
    const bkk = new Date(at.getTime() + 7 * HOUR);
    const when = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate(), h - 7));
    if (when < sunrise || when > sunset) continue;
    const pt = arch(dayFrac(when));
    if (pt.y > 0.95) continue; // behind the buildings
    ticks.push({ label: String(h).padStart(2, '0'), ...pt });
  }

  const sunAt = arch(Math.min(1.06, Math.max(-0.06, dayFrac(at))));
  // Night: the full moon rides the same arch through the night by the clock,
  // up from behind the buildings at sunset and back down by sunrise.
  const nightFrac =
    at < sunrise
      ? (() => {
          const prevSet = sunTimes(new Date(at.getTime() - 24 * HOUR), SIAM).sunset;
          return (at.getTime() - prevSet.getTime()) / (sunrise.getTime() - prevSet.getTime());
        })()
      : (at.getTime() - sunset.getTime()) / (sunTimes(new Date(at.getTime() + 24 * HOUR), SIAM).sunrise.getTime() - sunset.getTime());
  // The night is laid on the part of the arch above the skyline (0.2..0.8), so
  // the moon is always in view while still moving with the real clock.
  const moonAt = arch(0.2 + 0.6 * Math.min(1, Math.max(0, nightFrac)));
  const moonLow = moonAt.y > 0.9;
  // Setting (west, azimuth > 180°): the body keeps sinking behind the
  // buildings and only fades once it is well down. Rising (east): it fades in
  // softly as it clears the horizon. Never a hard switch.
  const show = (b: { altitude: number; azimuth: number }) => (b.azimuth > 180 ? smooth(-12, -4, b.altitude) : smooth(-1, 5, b.altitude));
  // No early fade: it sinks behind the buildings (they are drawn over it) and
  // is clipped at the ground line (.welcome-sky), so it never shows through the road.
  const sunShow = show(sun);
  const moonShow = 1 - smooth(-2, 3, sun.altitude);
  const body = mode === 'day' ? sunAt : moonAt;
  // Low bodies (near or behind the buildings) carry no readout: just the sun.
  const readoutShow = mode === 'day' ? 1 - smooth(0.93, 1.0, sunAt.y) : 1;
  const rise = sunrise > at ? sunrise : sunTimes(new Date(at.getTime() + 24 * HOUR), SIAM).sunrise;
  const glow = mode === 'night' ? 'rgb(143 163 255 / 0.10)' : sun.altitude < 15 ? 'rgb(245 165 36 / 0.18)' : 'rgb(94 123 255 / 0.18)';
  const live = story < 0.01;
  // One tag per anchor (sun, moon). Switching anchors cross-fades:
  // the old tag fades out where it is, the new one fades in at its own spot.
  const sunMain = t('welcome.hang.sun', { time: clock.format(at), alt: Math.round(sun.altitude) });
  const sunSub = t(live ? 'welcome.hang.sunNow' : 'welcome.hang.sunStory', { az: Math.round(sun.azimuth) });
  const riseSub = t('welcome.hang.rise', { rise: clock.format(rise) });
  const tags = [
    { key: 'sun', at: sunAt, on: mode === 'day', main: sunMain, sub: sunSub, free: false },
    { key: 'moon', at: moonLow ? { x: 0.8, y: 0.5 } : moonAt, on: mode === 'night', main: t('welcome.hang.moon', { time: clock.format(at) }), sub: riseSub, free: moonLow },
  ];

  return (
    <div
      className="welcome-stage"
      aria-hidden="true"
      style={
        {
          '--story': story.toFixed(3),
          '--scene': p.toFixed(3),
          '--night': night.toFixed(3),
          '--shade-skew': `${shadeSkew(sun.azimuth, sun.altitude).toFixed(1)}deg`,
          '--sx': (body.x * 100).toFixed(2),
          '--sy': body.y.toFixed(4),
          '--glow': glow,
        } as CSSProperties
      }
    >
      <div className="welcome-stage-glow" />
      <div className={`welcome-sky is-${mode}`}>
        <svg className="welcome-sky-path" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          <path d={path.join('')} />
        </svg>
        {ticks.map((k) => (
          <span
            key={k.label}
            className="welcome-sky-tick"
            // Fade a mark the sun or moon is passing over.
            style={{ left: `${k.x * 100}%`, top: `${k.y * 100}%`, opacity: Math.abs(k.x - body.x) < 0.04 && Math.abs(k.y - body.y) < 0.08 ? 0 : undefined }}
          >
            {k.label}
          </span>
        ))}
        <div className="welcome-sky-sun" style={{ left: `${sunAt.x * 100}%`, top: `${sunAt.y * 100}%`, opacity: sunShow }}>
          <img src="/art/sky-sun.svg" alt="" width={96} height={96} />
        </div>
        {/* Always mounted (hidden by opacity): mounting it mid-scroll cost a frame at dusk. */}
        <div className="welcome-sky-moon" style={{ left: `${moonAt.x * 100}%`, top: `${moonAt.y * 100}%`, opacity: moonShow }} aria-hidden={moonShow < 0.01}>
          <FullMoon />
        </div>
        {tags.map((g) => (
          <div
            key={g.key}
            className={`welcome-sky-body hang-wrap${g.on ? ' is-on' : ''}`}
            style={{ left: `${g.at.x * 100}%`, top: `${g.at.y * 100}%`, opacity: g.on ? (g.free ? 1 : readoutShow) * (g.key === 'sun' ? sunShow : moonShow) : 0 }}
          >
            {/* The tag: always at the same angle, diagonally up and to the left of the sun or moon. */}
            {/* High in the sky (near the top edge and the scroll hint) the tag drops below the body instead. */}
            <div className={`hang is-left${g.at.y < 0.42 ? ' is-below' : ''}`}>
              <span className="hang-line" />
              <div className="hang-card">
                <p className="hang-main">{g.main}</p>
                <p className="hang-sub">{g.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="welcome-stage-street">
        <StreetLayers wide night={false} glow="none" />
        <TowerShow />
        <img className="stage-layer stage-shade" src="/art/street-wide-day-shade.svg" alt="" width={2400} height={920} decoding="async" />
        <img className="stage-layer stage-lamps" src="/art/street-wide-night-light.svg" alt="" width={2400} height={920} decoding="async" />
      </div>
      <div className="welcome-stage-scrim" />
    </div>
  );
}

/** U-Hackathon 2026 organisers; roles only where the source gives one. */
const ORGANIZERS: Array<{ name: string; role?: string; photo: string }> = [
  { name: 'Kyle Kemper', role: 'President, u‑topia', photo: 'kyle.webp' },
  { name: 'Emmanuel Quezada', photo: 'emmanuel.webp' },
];

/** U-Hackathon 2026 sponsors and technology partners (logos in public/sponsors). */
const SPONSOR_GROUPS: Array<{ key: 'sponsors' | 'partners'; items: Array<{ name: string; file: string }> }> = [
  {
    key: 'sponsors',
    items: [
      { name: 'yellow', file: 'yellow.webp' },
      { name: 'DCT', file: 'dct.webp' },
      { name: 'Contribution DAO', file: 'contribution-dao.webp' },
      { name: 'CUBS', file: 'cubs.webp' },
      { name: 'HooRay!', file: 'hooray.webp' },
      { name: 'team1 Thailand', file: 'team1.webp' },
    ],
  },
  {
    key: 'partners',
    items: [
      { name: 'Avalanche', file: 'avalanche.webp' },
      { name: 'Tokenomist', file: 'tokenomist.webp' },
      { name: 'ElevenLabs', file: 'elevenlabs.webp' },
    ],
  },
];

export default function Landing() {
  const { t, lang } = useI18n();
  const go = useGo();
  const moreRef = useRef<HTMLDivElement>(null);
  const now = useNow();
  const desktop = useDesktop();
  const sceneRef = useRef<HTMLDivElement>(null);
  const mode: WalkMode = sunPosition(now, SIAM).altitude > 0 ? 'day' : 'night';
  // Start = the first-run flag; next stop is the phone-number setup.
  const start = () => {
    markOnboarded();
    go(hasDoneSetup() ? '/plan' : '/setup');
  };

  return (
    <div className="welcome">
      {/* Desktop: the held street scene covers the hero and the first section, then lets go. */}
      <div ref={sceneRef} className="welcome-scene">
        {desktop && <Stage now={now} scene={sceneRef} />}
        <main className="welcome-hero stagger">
          <div className="welcome-lang">
            <LangToggle className="lang-toggle--on-field" />
          </div>
          <div className="welcome-spacer" />
          <div className="welcome-brand">
            {/* The logo stands in for the first W; the heading still reads "Walk We". */}
            <h1 className="welcome-name" aria-label="Walk We">
              <LogoMark bare className="welcome-name-w" />
              {/* Letters rise in one by one after the logo. */}
              <span aria-hidden="true" className="welcome-letters">
                {[...'alk'].map((c, i) => (
                  <span key={i} className="welcome-letter" style={{ '--i': i + 1 } as CSSProperties}>
                    {c}
                  </span>
                ))}
                <span className="welcome-letter welcome-space" style={{ '--i': 4 } as CSSProperties}>
                  {' '}
                </span>
                {[...'We'].map((c, i) => (
                  <span key={`w${i}`} className="welcome-letter welcome-name-we" style={{ '--i': i + 5 } as CSSProperties}>
                    {c}
                  </span>
                ))}
              </span>
            </h1>
            <p className="welcome-tagline">
              <span className="tag-line">
                {t('welcome.tag.dayPre')}
                <em className="tag-key tag-key--day">{t('welcome.tag.day')}</em>
                {t('welcome.tag.dayPost')}
              </span>
              <span className="tag-line">
                {t('welcome.tag.nightPre')}
                <em className="tag-key tag-key--night">{t('welcome.tag.night')}</em>
                {t('welcome.tag.nightPost')}
              </span>
            </p>
          </div>
          {!desktop && (
            <div className="welcome-art">
              <StreetArt mode={mode} />
            </div>
          )}
          <div className="welcome-spacer" />
          <div className="welcome-actions">
            <button type="button" className="btn welcome-primary" onClick={start} data-testid="landing-start">
              {t('landing.start')}
              <ArrowRight size={20} aria-hidden="true" className="btn-arrow" />
            </button>
            {/* Jumps to the walkthrough ("See how it works"), at its first step. */}
            <button type="button" className="btn welcome-ghost" onClick={() => moreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} data-testid="landing-how">
              <PlayCircle size={20} aria-hidden="true" />
              {t('welcome.how')}
            </button>
            <p className="welcome-chips">
              <span className="welcome-chip">
                <Check size={14} aria-hidden="true" />
                {t('welcome.chip.free')}
              </span>
              <span className="welcome-chip">
                <MapPin size={14} aria-hidden="true" />
                {/* Breaks only between the two halves, never inside one ("5 / km"). */}
                <span className="welcome-chip-text">
                  {t('welcome.chip.pilot')
                    .split(' · ')
                    .map((part, i, all) => (
                      <span key={i} className="nowrap">
                        {part}
                        {i < all.length - 1 ? ' ·' : ''}
                      </span>
                    ))
                    .flatMap((el, i) => (i ? [' ', el] : [el]))}
                </span>
              </span>
            </p>
          </div>
          <ScrollCue label={t('welcome.scrollMore')} hint={t('welcome.scrollHint')} target={() => moreRef.current} />
        </main>

        <section className="welcome-section welcome-section--about welcome-about" aria-labelledby="about-title">
          <div className="welcome-about-inner">
            <Reveal className="welcome-section-head">
              <h2 className="welcome-h2 welcome-h2--big" id="about-title">
                {t('welcome.about.title')}
              </h2>
            </Reveal>
            <div className="welcome-section-body">
              <Reveal delay={0.1}>
                <p className="welcome-sub">{t('welcome.about.problem')}</p>
              </Reveal>
              <Reveal delay={0.18}>
                <p className="welcome-sub welcome-sub--answer">{t('welcome.about.answer')}</p>
              </Reveal>
            </div>
          </div>
        </section>
      </div>

      <div className="welcome-more">
        <div ref={moreRef}>
          <HowItWorks id="how" />
        </div>

        {/* One cyan route out of the phone, through the features as stops, on to the team. */}
        <RouteBand from={desktop ? 0.72 : 0.5} to={0} />
        <Features />
        <RouteBand from={desktop ? 0.98 : 0} to={0} end />


        <section className="welcome-section welcome-people" aria-labelledby="team-title">
          <Reveal className="welcome-section-head">
            <h2 className="welcome-h2" id="team-title">
              {t('welcome.team.title')}
            </h2>
          </Reveal>
          <div className="welcome-section-body">
            <ul className="team-list">
              {TEAM.map((m, i) => (
                <Reveal as="li" className="team-row" key={m.nameEn} delay={0.1 * i}>
                  <img className="team-avatar" src={m.avatar} alt="" width={96} height={96} loading="lazy" decoding="async" />
                  <span className="team-text">
                    <span className="team-name">{lang === 'en' ? m.nameEn : m.nameTh}</span>
                    <span className="team-role">{lang === 'en' ? m.roleEn : m.roleTh}</span>
                  </span>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* The event's sponsors and technology partners, by kind. Walk We was
            built at U-Hackathon 2026; this thanks the event's backers and
            claims no endorsement or integration beyond that. */}
        <section className="welcome-section sponsors" aria-labelledby="sponsors-title">
          <Reveal className="welcome-section-head">
            <h2 className="welcome-h2" id="sponsors-title">
              {t('welcome.supporters.title')}
            </h2>
            <p className="welcome-sub">{t('welcome.supporters.body')}</p>
            {/* The organisers (photos from the event's shared folder). */}
            <div className="organizer">
              <p className="sponsor-kind">{t('welcome.supporters.organizer')}</p>
              <p className="organizer-mark">
                <span>U-Hackathon</span> 2026 <small>by u‑topia</small>
              </p>
              <ul className="organizer-people">
                {ORGANIZERS.map((o) => (
                  <li key={o.name}>
                    <img src={`/sponsors/${o.photo}?v=2`} alt="" width={120} height={120} loading="lazy" decoding="async" />
                    <span>
                      <strong>{o.name}</strong>
                      {o.role && <span>{o.role}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <div className="welcome-section-body sponsor-groups">
            {SPONSOR_GROUPS.map((g, gi) => (
              <Reveal key={g.key} className={`sponsor-group sponsor-group--${g.key}`} delay={0.1 * gi}>
                <h3 className="sponsor-kind">{t(`welcome.supporters.${g.key}` as StringKey)}</h3>
                <ul className="sponsor-grid">
                  {g.items.map((it) => (
                    <li key={it.name} className="sponsor-tile">
                      <img src={`/sponsors/${it.file}?v=3`} alt={it.name} loading="lazy" decoding="async" />
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </section>
      </div>

      {/* The page ends where the street goes dark: the same panorama at night. */}
      <footer className="welcome-foot">
        <div className="welcome-foot-text">
          {/* One last way in, then who made it. */}
          <div className="foot-cta">
            <p className="foot-cta-title">{t('welcome.foot.title')}</p>
            <button type="button" className="btn welcome-primary" onClick={start} data-testid="foot-start">
              {t('welcome.foot.start')}
              <ArrowRight size={20} aria-hidden="true" className="btn-arrow" />
            </button>
          </div>
          <p className="foot-credit">
            <span className="foot-credit-by">Presented by team</span> <strong>FTXZ</strong>
          </p>
          <p className="foot-names">Nathaporn Saituptim · Natsha Tatiyachaitaweesuk · Siriphanaphorn Sirikun</p>
          <p className="foot-small">
            <TLink to="/privacy">{t('privacy.link')}</TLink> · © 2569 Walk We
          </p>
        </div>
        <NightStreet wide={desktop} />
      </footer>
    </div>
  );
}
