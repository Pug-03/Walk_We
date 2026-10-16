import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion as useReducedMotionFM } from 'framer-motion';
import { Accessibility, Camera, LockKeyhole, Moon, Siren, Sparkles, Sun, WifiOff, type LucideIcon } from 'lucide-react';
import { env } from '../../env.ts';
import { TLink } from '../TLink.tsx';
import { useI18n } from '../../store/i18n.tsx';
import { useDesktop } from '../../utils/useDesktop.ts';
import { useSceneProgress } from '../../utils/useSceneProgress.ts';
import { FeatureScene, type FeatureKey } from './FeatureScenes.tsx';

// "Everything you need on the walk", told as one walk: a cyan route comes
// down out of the walkthrough, runs through the features as stops, and
// carries on to the team below.
//
// Desktop: the section holds the screen while you scroll. The route runs
// down the left edge and along the foot of the screen with one stop per
// feature; a "you are here" dot walks it, and at each stop the big line
// drawing and its words take the stage. Phones: the route runs down the
// left gutter, one stop per feature, each with its drawing.

// The AI row only shows when the AI proxy is configured: never advertise a
// feature the planner then hides.
const FEATURES: Array<{ Icon: LucideIcon; key: FeatureKey; tone: string }> = [
  { Icon: Sun, key: 'shade', tone: 'cyan' },
  { Icon: Moon, key: 'night', tone: 'amber' },
  ...(env.aiProxyUrl ? [{ Icon: Sparkles, key: 'ai' as const, tone: 'lilac' }] : []),
  { Icon: Accessibility, key: 'access', tone: 'cyan' },
  { Icon: Camera, key: 'photos', tone: 'lilac' },
  { Icon: WifiOff, key: 'offline', tone: 'cyan' },
  { Icon: Siren, key: 'sos', tone: 'red' },
  { Icon: LockKeyhole, key: 'private', tone: 'lilac' },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const useReducedMotion = () => !!useReducedMotionFM();

/**
 * The route is drawn up to one fixed line on the screen (HEAD, 70% down): as
 * the page scrolls, the tip of the line rides that line, so one stretch runs
 * straight on into the next with no gap and no jump.
 */
const HEAD = 0.7;

/** Scroll progress (0..1) of an element crossing the window: 0 as its top enters the lower part, 1 as its bottom passes the middle. */
function useCrossing(ref: React.RefObject<HTMLElement | null>, doneAt?: number | 'head'): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // doneAt: fully drawn once the element's top reaches that fraction of the window.
      setP(
        doneAt === 'head'
          ? clamp01((vh * HEAD - r.top) / r.height) // drawn down to the head line
          : doneAt != null
            ? clamp01((vh - r.top) / (vh * (1 - doneAt)))
            : clamp01((vh * 0.85 - r.top) / (r.height + vh * 0.35)),
      );
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake);
    return () => {
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', wake);
      cancelAnimationFrame(frame);
    };
  }, [ref, doneAt]);
  return p;
}

/**
 * One stretch of the route between sections, drawn as you scroll past it.
 * `from`/`to` are x positions (0..1 of the width) at the band's top and foot.
 */
export function RouteBand({ from, to, end = false }: { from: number; to: number; end?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  // Drawn down to the head line, so it hands over to the next stretch exactly
  // where that one starts; the end pin grows in as the line reaches it.
  const live = useCrossing(ref, 'head');
  const p = still ? 1 : live;
  const pin = p;
  const x1 = from * 1000, x2 = to * 1000;
  const d = `M${x1} 0 C${x1} 60 ${x2} 40 ${x2} 100`;
  return (
    <div ref={ref} className={`route-band${end ? ' route-band--end' : ''}`} aria-hidden="true" style={{ '--p': pin.toFixed(3) } as CSSProperties}>
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" focusable="false">
        <path d={d} className="route-track" />
        <path d={d} className="route-walked" pathLength={1} style={{ strokeDashoffset: 1 - p }} />
      </svg>
      {end && <span className="route-end" style={{ left: `${to * 100}%` }} />}
    </div>
  );
}

/** Catmull-Rom through the points, as cubic Béziers (a smooth route through the stops). */
function smoothPath(pts: Array<[number, number]>): string {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function StageRoute({ n, p, lead, onPick, labels, tones }: { n: number; p: number; lead: number; onPick: (i: number) => void; labels: string[]; tones: string[] }) {
  // Route in the stage's own 1000 × 1000 box (stretched to the screen):
  // down the left edge from the band above, then along the foot through the
  // stops, out at the bottom-right corner to the band below.
  const stops = useMemo(
    () => Array.from({ length: n }, (_, i): [number, number] => [70 + (i * 860) / (n - 1), i % 2 ? 905 : 865]),
    [n],
  );
  // Leaves straight down at the bottom-right, the way the band below it starts, so the two meet without a kink.
  const d = useMemo(() => `M0 0 L0 690` + smoothPath([[0, 690], [8, 840], ...stops, [975, 950], [980, 1000]]), [stops]);
  const path = useRef<SVGPathElement>(null);
  const [geo, setGeo] = useState<{ len: number; at: number[] } | null>(null);
  useEffect(() => {
    const el = path.current;
    if (!el) return;
    const len = el.getTotalLength();
    // Where along the route each stop sits (nearest sampled point).
    const at = stops.map(([sx, sy]) => {
      let best = 0, bestD = Infinity;
      for (let k = 0; k <= 600; k++) {
        const pt = el.getPointAtLength((len * k) / 600);
        const dd = (pt.x - sx) ** 2 + (pt.y - sy) ** 2;
        if (dd < bestD) [best, bestD] = [(len * k) / 600, dd];
      }
      return best;
    });
    setGeo({ len, at });
  }, [stops]);

  // Progress → length: the first stop at p = 0.5/n, the last at (n - 0.5)/n.
  // The leg down the left edge carries straight on from the band above,
  // drawn to the head line (lead 0..1) as the stage scrolls up into place.
  const LEAD = 690;
  let walked = 0;
  if (geo) {
    const q = p * n - 0.5;
    if (lead < 1) walked = LEAD * lead;
    else if (q <= 0) walked = LEAD + (geo.at[0]! - LEAD) * clamp01(p * n * 2);
    else if (q >= n - 1) walked = geo.at[n - 1]! + (geo.len - geo.at[n - 1]!) * clamp01((q - (n - 1)) * 2);
    else {
      const i = Math.floor(q);
      walked = geo.at[i]! + (geo.at[i + 1]! - geo.at[i]!) * (q - i);
    }
  }
  const dot = geo && path.current ? path.current.getPointAtLength(walked) : null;
  const frac = geo ? walked / geo.len : 0;

  return (
    <div className="stage-route">
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false" aria-hidden="true">
        <path d={d} className="route-track" />
        <path ref={path} d={d} className="route-walked" pathLength={geo ? undefined : 1} style={geo ? { strokeDasharray: geo.len, strokeDashoffset: geo.len - walked } : undefined} />
      </svg>
      {stops.map(([x, y], i) => {
        const reached = geo ? walked >= geo.at[i]! - 1 : false;
        return (
          <button
            key={i}
            type="button"
            className={`stage-stop tone-${tones[i]}${reached ? ' is-reached' : ''}${reached && Math.round(p * n - 0.5) === i ? ' is-here' : ''}`}
            style={{ left: `${x / 10}%`, top: `${y / 10}%` }}
            onClick={() => onPick(i)}
            aria-label={labels[i]}
          />
        );
      })}
      {dot && (
        <span className="stage-walker" style={{ left: `${dot.x / 10}%`, top: `${dot.y / 10}%`, opacity: frac > 0.002 ? 1 : 0 }} aria-hidden="true">
          <span />
        </span>
      )}
    </div>
  );
}

function DesktopFeatures() {
  const { t } = useI18n();
  const still = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const live = useSceneProgress(ref, !still, 0.02);
  // How much of the left-edge leg the head line has reached before the stage pins.
  const [lead, setLead] = useState(1);
  useEffect(() => {
    if (still) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setLead(clamp01((window.innerHeight * HEAD - top) / (window.innerHeight * 0.69)));
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', wake, { passive: true });
    return () => {
      window.removeEventListener('scroll', wake);
      cancelAnimationFrame(frame);
    };
  }, [still]);
  const n = FEATURES.length;
  const p = still ? 0.5 / n : live;
  const active = Math.min(n - 1, Math.max(0, Math.round(p * n - 0.5)));
  const cur = FEATURES[active]!;
  const Icon = cur.Icon;

  const pick = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const run = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + run * ((i + 0.5) / n), behavior: still ? 'auto' : 'smooth' });
  };

  return (
    <section ref={ref} className="features features--stage" aria-labelledby="features-title" style={{ '--n': n } as CSSProperties}>
      <div className={`fstage tone-${cur.tone}`}>
        <div className="fstage-glow" aria-hidden="true" />
        <h2 className="welcome-h2 fstage-title" id="features-title">
          {t('welcome.features.title')}
        </h2>
        {/* Screen readers get the whole list; the stage below shows one at a time. */}
        <ul className="sr-only">
          {FEATURES.map(({ key }) => (
            <li key={key}>
              {t(`welcome.features.${key}.title`)}: {t(`welcome.features.${key}.desc`)}
            </li>
          ))}
        </ul>
        <div className="fstage-copy" key={cur.key} aria-hidden="true">
          <span className="fstage-icon">
            <Icon size={26} />
          </span>
          <p className="fstage-name">{t(`welcome.features.${cur.key}.title`)}</p>
          <p className="fstage-desc">{t(`welcome.features.${cur.key}.desc`)}</p>
        </div>
        <div className="fstage-art" key={`art-${cur.key}`} aria-hidden="true">
          <FeatureScene k={cur.key} />
        </div>
        <TLink to="/data" className="welcome-data-link fstage-data">
          {t('data.link')}
        </TLink>
        <StageRoute
          n={n}
          p={p}
          lead={lead}
          onPick={pick}
          labels={FEATURES.map(({ key }) => t(`welcome.features.${key}.title`))}
          tones={FEATURES.map(({ tone }) => tone)}
        />
      </div>
    </section>
  );
}

function PhoneFeatures() {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const still = useReducedMotion();
  const live = useCrossing(ref, 'head');
  const fill = still ? 1 : live;
  return (
    <section ref={ref} className="features features--list" aria-labelledby="features-title" style={{ '--fill': fill.toFixed(3) } as CSSProperties}>
      <h2 className="welcome-h2" id="features-title">
        {t('welcome.features.title')}
      </h2>
      <ol className="fl">
        {FEATURES.map(({ Icon, key, tone }, i) => (
          <li key={key} className={`fl-stop tone-${tone}${fill * FEATURES.length > i + 0.2 ? ' is-reached' : ''}`}>
            <div className="fl-art" aria-hidden="true">
              <FeatureScene k={key} />
            </div>
            <p className="fl-name">
              <Icon size={20} aria-hidden="true" />
              {t(`welcome.features.${key}.title`)}
            </p>
            <p className="fl-desc">{t(`welcome.features.${key}.desc`)}</p>
          </li>
        ))}
      </ol>
      <TLink to="/data" className="welcome-data-link">
        {t('data.link')}
      </TLink>
    </section>
  );
}

export function Features() {
  return useDesktop() ? <DesktopFeatures /> : <PhoneFeatures />;
}
