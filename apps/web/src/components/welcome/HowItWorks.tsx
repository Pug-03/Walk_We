import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { StringKey } from '../../i18n.ts';
import { useI18n } from '../../store/i18n.tsx';
import { useSceneProgress } from '../../utils/useSceneProgress.ts';
import shots from './demoShots.json';

// "See how it works": real screens of the app (scripts/build-demo-shots.ts
// drives the production build through the first-run flow with sample data),
// replayed in an iPhone frame as the page scrolls. A pointer glides to where
// each real tap landed, taps (or holds, for SOS), and the next screen fades
// in. Flow: Start → your number → an emergency contact → from your location
// (CentralWorld) to Siam Paragon → compare → step-by-step → practice SOS
// (cancelled) → arrived. Reduced motion: the arrival screen and all captions.

type Shot = { img: string; x: number; y: number; action: 'tap' | 'type' | 'hold' | 'swipe' | 'none' | 'frame'; step: number; bg: string; dy?: number; page?: boolean };
// How much scroll each kind of screen gets: typing is quick, one character a beat.
// frame: in-between frames of a transition, played back like video.
const WEIGHT = { type: 0.28, swipe: 0.9, tap: 1, hold: 1.3, none: 1.2, frame: 0.2 } as const;
const dragOf = (s: Shot) => (s.action === 'swipe' ? Math.min(Math.abs(s.dy ?? 0), 240) : 0);
/** Where the pointer ends up on a screen (after a swipe it has dragged up). */
const endOf = (s: Shot) => ({ x: s.x, y: s.y - dragOf(s) });
/** Light top colour (a map) → dark status-bar text. */
const isLight = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return ((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114 > 150;
};
// The shots are the whole screen; the app kept clear of the status bar, which is drawn on top.
const STATUS = 0;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Walkthrough frames decoded this session (and in flight), shared across mounts. */
const decoded = new Set<string>();
const pending = new Set<string>();
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function HowItWorks({ id }: { id?: string }) {
  const { t, lang } = useI18n();
  const still = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const live = useSceneProgress(ref, !still);
  const list = (lang === 'en' ? shots.en : shots.th) as Shot[];
  const n = list.length;

  // Which screen, and how far through its moment (0..1), weighted by kind.
  const p = still ? 1 : clamp01((live - 0.02) / 0.96);
  const weights = list.map((s) => WEIGHT[s.action]);
  const total = weights.reduce((a, b) => a + b, 0);
  let target = p * total * 0.9999;
  let want = 0;
  while (want < n - 1 && target >= weights[want]!) target -= weights[want++]!;
  // Play only frames that are already decoded: on a slow phone the scroll can
  // outrun the downloads, so hold the newest ready frame (at the end of its
  // moment) and let the screen, pointer and captions all wait for it together.
  const [, bump] = useState(0);
  const urlOf = (k: number) => `/demo/${list[k]!.img}?v=${shots.v}`;
  let i = want;
  while (i > 0 && !decoded.has(urlOf(i))) i--;
  if (!decoded.has(urlOf(i))) i = want; // nothing ready yet: just show what's asked
  const f = i === want ? clamp01(target / weights[i]!) : 0.99;
  const cur = list[i]!;
  const next = list[Math.min(n - 1, i + 1)]!;
  const prev = list[Math.max(0, i - 1)]!;
  const step = cur.step;

  // Pointer: glide from where it last was to this screen's target, act, then rest.
  const from = i === 0 ? cur : endOf(prev);
  const move = i === 0 ? 1 : ease(clamp01(f / 0.4));
  let px = from.x + (cur.x - from.x) * move;
  let py = from.y + (cur.y - from.y) * move;
  const acting = f > 0.5 && f < 0.72;
  const hold = cur.action === 'hold' ? clamp01((f - 0.45) / 0.35) : 0;

  // Swipe: the finger drags up and the page scrolls with it (whole page: the two
  // screens slide as one; inside a sheet: a quick cross-fade).
  const swipe = cur.action === 'swipe' && i < n - 1;
  const e = swipe ? ease(clamp01((f - 0.42) / 0.45)) : 0;
  if (swipe) py -= dragOf(cur) * e;
  const dy = cur.dy ?? 0;
  const slide = swipe && cur.page;
  // Neighbouring video frames cut straight to each other (no ghosting); only
  // two settled screens cross-fade, briefly.
  const film = cur.action === 'frame' || next.action === 'frame';
  // In-sheet swipes cross-fade over a short stretch, so two sheets never ghost for long.
  const fade = slide ? 0 : swipe ? clamp01((e - 0.4) / 0.2) : i < n - 1 && !film ? clamp01((f - 0.88) / 0.12) : 0;
  const bg = slide ? (e > 0.5 ? next.bg : cur.bg) : fade > 0.5 ? next.bg : cur.bg;

  // The phone leans a touch toward the real mouse (desktop), eased.
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (still) return;
    let frame = 0;
    let goal = { x: 0, y: 0 };
    let c = { x: 0, y: 0 };
    const tick = () => {
      c = { x: c.x + (goal.x - c.x) * 0.08, y: c.y + (goal.y - c.y) * 0.08 };
      setTilt(c);
      frame = Math.abs(goal.x - c.x) + Math.abs(goal.y - c.y) > 0.01 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      goal = { x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 };
      if (!frame) frame = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [still]);

  // Fetch and decode ahead of the scroll (a whole step's worth of video
  // frames), re-rendering as each lands so a held frame moves on at once.
  // Only once the section is within a screen: the frames must not compete
  // with the opening of the page.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    const io = new IntersectionObserver(([en]) => en?.isIntersecting && setNear(true), { rootMargin: '25% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  // Re-render when a frame lands, as long as the section is mounted (not per
  // scroll position: a held frame must move on even if the scroll stops).
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);
  useEffect(() => {
    if (!near) return;
    // From the frame on screen (held or not) up past where the scroll wants to
    // be, so a held screen moves on step by step instead of jumping ahead.
    for (let k = i; k <= Math.min(n - 1, Math.max(want, i) + 40); k++) {
      const url = urlOf(k);
      if (decoded.has(url) || pending.has(url)) continue;
      pending.add(url);
      const img = new Image();
      img.src = url;
      img
        .decode()
        .then(() => decoded.add(url))
        .catch(() => decoded.add(url)) // a broken frame must not hold playback forever
        .finally(() => {
          pending.delete(url);
          if (mounted.current) bump((x) => x + 1);
        });
    }
  }, [want, i, list, near]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // Scroll length follows how much there is to play: unhurried, never skipping.
    <section ref={ref} id={id} className="demo" aria-labelledby="demo-title" style={{ '--units': total.toFixed(1) } as CSSProperties}>
      <div className="demo-sticky">
        <div className="demo-copy">
          <h2 className="welcome-h2" id="demo-title">
            {t('demo.title')}
          </h2>
          <ol className="demo-steps">
            {/* s0 is the welcome page and its Start; the app's own steps follow. */}
            {[0, 1, 2, 3, 4, 5, 6].map((k, j) => (
              <li key={k} className={still || j === step ? 'is-on' : j < step ? 'is-done' : ''}>
                <span className="demo-step-n" aria-hidden="true">
                  {!still && j < step ? <Check size={16} strokeWidth={3} /> : j + 1}
                </span>
                <span className="demo-step-body">
                  <strong>{t(`demo.s${k}.title` as StringKey)}</strong>
                  <span className="demo-step-desc">
                    <span>{t(`demo.s${k}.desc` as StringKey)}</span>
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="demo-note">{t('demo.note')}</p>
        </div>

        <div className="demo-stage" aria-hidden="true">
          <div className="iphone" style={{ '--tx': tilt.x.toFixed(3), '--ty': tilt.y.toFixed(3) } as CSSProperties}>
            {/* The screen takes the shot's own top colour, so a frame still on its way never shows as a dark hole. */}
            <div className="iphone-screen" style={{ background: bg }}>
              <div className={`iphone-status${isLight(bg) ? ' is-light' : ''}`}>
                <span>14:00</span>
                <span className="iphone-island" />
                {/* Signal, 5G and battery, as on a real iPhone. */}
                <span className="iphone-icons">
                  <span className="iphone-bars">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="iphone-net">5G</span>
                  {/* iOS battery: outlined body, cap, fill, percentage knocked out of the fill. */}
                  <svg className="iphone-battery" viewBox="0 0 28 13" aria-hidden="true">
                    <defs>
                      <mask id="batt-pct">
                        <rect width="28" height="13" fill="#fff" />
                        <text x="12.25" y="9.6" textAnchor="middle" fontSize="8.6" fontWeight="800" fill="#000" fontFamily="-apple-system, system-ui, sans-serif">
                          82
                        </text>
                      </mask>
                    </defs>
                    <rect x="0.6" y="0.6" width="23.3" height="11.8" rx="3.6" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.1" />
                    <path d="M25.3 4.4 a1.6 1.6 0 0 1 0 4.2 Z" fill="currentColor" fillOpacity="0.45" />
                    <rect x="2" y="2" width="20.5" height="9" rx="2.4" fill="currentColor" mask="url(#batt-pct)" />
                  </svg>
                </span>
              </div>
              <div className="shot-stack" style={{ top: STATUS }}>
                {/* The previous screen stays underneath: if the next one isn't decoded yet, nothing flashes. */}
                {i > 0 && <img key={`p-${prev.img}`} className="shot" src={`/demo/${prev.img}?v=${shots.v}`} alt="" decoding="sync" />}
                <img key={`c-${cur.img}`} className="shot" src={`/demo/${cur.img}?v=${shots.v}`} alt="" decoding="sync" style={slide ? { transform: `translateY(${-dy * e}px)` } : undefined} />
                {slide && e > 0 && <img key={`n-${next.img}`} className="shot" src={`/demo/${next.img}?v=${shots.v}`} alt="" decoding="sync" style={{ transform: `translateY(${dy * (1 - e)}px)` }} />}
                {!slide && fade > 0 && <img key={`f-${next.img}`} className="shot" src={`/demo/${next.img}?v=${shots.v}`} alt="" decoding="sync" style={{ opacity: fade }} />}
              </div>
              <span className="iphone-home" />
              {!still && cur.action !== 'none' && (
                <div
                  className={`demo-pointer${acting && cur.action === 'tap' ? ' is-click' : ''}${hold > 0 && hold < 1 ? ' is-holding' : ''}${swipe && e > 0 && e < 1 ? ' is-drag' : ''}`}
                  style={{ transform: `translate(${px}px, ${py + STATUS}px)`, '--hold': hold } as CSSProperties}
                >
                  <svg viewBox="0 0 24 24" width="26" height="26">
                    <path d="M4 2l16 9.5-7.2 1.6L9.6 20z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
