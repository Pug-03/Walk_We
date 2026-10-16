// Vignettes for the features, built on the welcome page's own street (the
// faceted line art in public/art) so every scene is the same city: a slice of
// it by day or night, with the feature drawn on top in the page's colours
// (cyan for what the app computes, amber lamps, red only for SOS). Decoration
// only (aria-hidden on the parent). Motion lives in app.css (.scene-*).

export type FeatureKey = 'shade' | 'night' | 'ai' | 'access' | 'photos' | 'offline' | 'sos' | 'private';

const INK = 'var(--scene-ink)';
const SOFT = 'var(--scene-soft)';
const CYAN = 'var(--cyan-400)';
const AMBER = '#f5a524';

/**
 * A slice of the welcome street (1000 × 920 art), scaled so its kerb line
 * (y 640) sits on the scene's ground (y 252). `x` picks which stretch.
 */
function Street({ night = false, x = -110, glow, dim = 1 }: { night?: boolean; x?: number; glow?: 'shade' | 'light'; dim?: number }) {
  const k = 0.5;
  const y = 252 - 640 * k;
  const img = (href: string) => <image href={href} x={x} y={y} width={1000 * k} height={920 * k} preserveAspectRatio="none" />;
  return (
    <g opacity={dim}>
      {img(night ? '/art/street-night.svg' : '/art/street-day.svg')}
      {glow === 'shade' && <g className="scene-shadow-layer">{img('/art/street-day-shade.svg')}</g>}
      {glow === 'light' && img('/art/street-night-light.svg')}
    </g>
  );
}


function Shade() {
  return (
    <>
      <Street glow="shade" x={-120} />
      {/* Today's sun path and the sun moving along it; the shade under the BTS is where the route goes. */}
      <path className="scene-dash" d="M30 120 Q200 -50 370 120" stroke={CYAN} strokeWidth={2} strokeDasharray="1 9" strokeLinecap="round" fill="none" />
      <image className="scene-sun" href="/art/sky-sun.svg" x={-16} y={-16} width={32} height={32} />
    </>
  );
}

function Night() {
  return (
    <>
      <Street night glow="light" x={-160} />
      <image href="/art/sky-moon.svg" x={318} y={26} width={48} height={48} />
    </>
  );
}

/** One step photo: a street corner in line art with the turn arrow. */
function StepCard({ className, turn }: { className: string; turn: 'left' | 'right' }) {
  return (
    <g className={className}>
      <clipPath id={`card-${turn}`}>
        <rect x={-86} y={-66} width={172} height={132} rx={12} />
      </clipPath>
      <rect x={-86} y={-66} width={172} height={132} rx={12} fill="#0b1630" />
      <g clipPath={`url(#card-${turn})`}>
        <image href="/art/street-day.svg" x={turn === 'right' ? -250 : -150} y={-262} width={400} height={368} preserveAspectRatio="none" />
      </g>
      <rect x={-86} y={-66} width={172} height={132} rx={12} fill="none" stroke={INK} strokeWidth={1.8} />
      <path d={turn === 'right' ? 'M0 44 V6 Q0 -6 12 -6 H38 M30 -14 l9 8 l-9 8' : 'M0 44 V6 Q0 -6 -12 -6 H-38 M-30 -14 l-9 8 l9 8'} stroke={CYAN} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  );
}

function Photos() {
  return (
    <>
      <Street x={-90} dim={0.22} />
      <g transform="translate(200 140)">
        <g transform="rotate(-8) translate(-34 8)" opacity={0.45}>
          <StepCard className="" turn="left" />
        </g>
        <g className="scene-card">
          <StepCard className="" turn="right" />
        </g>
      </g>
      <g fill={SOFT}>
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={164 + i * 18} cy={240} r={i === 2 ? 5 : 3.5} fill={i === 2 ? CYAN : SOFT} />
        ))}
      </g>
    </>
  );
}

function Phone({ children }: { children?: React.ReactNode }) {
  return (
    <g>
      <rect x={146} y={52} width={108} height={196} rx={18} fill="#0b1630" stroke={INK} strokeWidth={1.8} />
      <path d="M186 64 h28" stroke={SOFT} strokeWidth={3} strokeLinecap="round" />
      {children}
    </g>
  );
}

function Offline() {
  return (
    <>
      <Street x={-200} dim={0.25} />
      {/* Mall roof over the phone: the place signal drops. */}
      <path d="M40 120 L200 40 L360 120" stroke={SOFT} strokeWidth={1.5} fill="none" />
      <g stroke={SOFT} strokeWidth={1.2}>
        <path d="M70 120 V252 M330 120 V252" />
      </g>
      <Phone>
        <path d="M164 220 L186 186 L214 196 L236 120" className="scene-route" stroke={CYAN} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} />
        <circle cx={164} cy={220} r={5} fill={CYAN} />
        <circle cx={236} cy={120} r={5} fill="none" stroke={CYAN} strokeWidth={2} />
        <g stroke={SOFT} strokeWidth={1}>
          <path d="M160 100 H240 M160 150 H240 M200 80 V236" opacity={0.6} />
        </g>
      </Phone>
      <g className="scene-signal" transform="translate(300 182)" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round">
        <path d="M-18 -6 a26 26 0 0 1 36 0 M-10 3 a14 14 0 0 1 20 0" />
        <circle cx={0} cy={12} r={2} fill={INK} />
        <path d="M-20 -16 L20 22" stroke={AMBER} />
      </g>
    </>
  );
}

function Sos() {
  return (
    <>
      <Street night x={-140} dim={0.3} />
      <g className="scene-ripple" stroke="#ff8a8e" fill="none">
        <circle cx={200} cy={150} r={70} strokeWidth={1.2} />
        <circle cx={200} cy={150} r={70} strokeWidth={1.2} />
      </g>
      <circle cx={200} cy={150} r={46} fill="#e5484d" />
      <circle className="scene-hold" cx={200} cy={150} r={56} fill="none" stroke="#ff8a8e" strokeWidth={4} strokeLinecap="round" pathLength={1} transform="rotate(-90 200 150)" />
      <text x={200} y={158} textAnchor="middle" fontSize={22} fontWeight={700} fill="#fff" fontFamily="inherit">
        SOS
      </text>
      {/* Location goes out to the contacts. */}
      <g stroke={INK} strokeWidth={1.6} fill="none">
        <rect x={40} y={64} width={74} height={36} rx={18} />
        <rect x={286} y={196} width={74} height={36} rx={18} />
        <path d="M150 116 L114 92 M250 184 L286 206" strokeDasharray="2 6" strokeLinecap="round" stroke={SOFT} />
      </g>
      <text x={77} y={88} textAnchor="middle" fontSize={14} fontWeight={600} fill={INK} fontFamily="inherit">LINE</text>
      <text x={323} y={220} textAnchor="middle" fontSize={14} fontWeight={600} fill={INK} fontFamily="inherit">SMS</text>
    </>
  );
}

function Private() {
  return (
    <>
      <Street x={-60} dim={0.22} />
      {/* The cloud the data never goes to. */}
      <g stroke={SOFT} strokeWidth={1.6} fill="none" strokeLinecap="round">
        <path d="M290 92 a18 18 0 0 1 34 -6 a14 14 0 0 1 10 26 H292 a12 12 0 0 1 -2 -20 Z" />
        <path d="M254 140 L284 118" strokeDasharray="2 7" />
        <path d="M282 80 L346 124" stroke={AMBER} strokeWidth={2} />
      </g>
      <Phone>
        <g className="scene-lock" stroke={CYAN} strokeWidth={2.6} fill="none" strokeLinecap="round">
          <path className="scene-shackle" d="M186 142 v-14 a14 14 0 0 1 28 0 v14" />
          <rect x={178} y={142} width={44} height={36} rx={8} fill="#0b1630" />
          <path d="M200 156 v8" />
        </g>
        <g stroke={SOFT} strokeWidth={1.5} strokeLinecap="round">
          <path d="M170 200 h60 M170 214 h40" />
        </g>
      </Phone>
    </>
  );
}

function Ai() {
  return (
    <>
      <Street x={-240} dim={0.22} />
      {/* A sentence in a speech bubble... */}
      <g stroke={INK} strokeWidth={1.6} fill="none" strokeLinejoin="round">
        <rect x={20} y={52} width={112} height={62} rx={14} />
        <path d="M44 114 v16 l16 -16" />
      </g>
      <g className="scene-words" stroke={SOFT} strokeWidth={3} strokeLinecap="round">
        <path d="M36 74 h80 M36 92 h54" />
      </g>
      {/* ...becomes fields (from / to / time), drawn as chips... */}
      <g className="scene-chips" stroke={CYAN} strokeWidth={1.6} fill="none">
        <rect x={28} y={160} width={52} height={22} rx={11} />
        <rect x={86} y={160} width={52} height={22} rx={11} />
        <rect x={28} y={188} width={40} height={22} rx={11} />
      </g>
      <path className="scene-spark" d="M92 140 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 Z" fill={AMBER} />
      <path d="M144 196 C150 196 150 180 160 176" stroke={SOFT} strokeWidth={1.5} strokeDasharray="2 6" strokeLinecap="round" fill="none" />
      {/* ...and Walk We's own router draws the route. */}
      <Phone>
        <path d="M168 222 L190 196 L180 166 L214 140 L232 100" className="scene-route" stroke={CYAN} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} />
        <circle cx={168} cy={222} r={5} fill={CYAN} />
        <circle cx={232} cy={100} r={5} fill="none" stroke={CYAN} strokeWidth={2} />
      </Phone>
    </>
  );
}

function Access() {
  return (
    <>
      <Street x={-320} dim={0.25} />
      {/* The step-free way: a ramp beside the stairs, the route taking the ramp. */}
      <g stroke={SOFT} strokeWidth={1.6} fill="none" strokeLinejoin="round">
        <path d="M60 252 H96 V236 H120 V220 H144 V204 H172 V252" />
      </g>
      <path d="M190 252 L320 204 H372" stroke={INK} strokeWidth={2} fill="none" />
      <path d="M36 252 C120 252 150 252 190 250 L320 206 L372 206" className="scene-route" stroke={CYAN} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} />
      {/* Wheelchair on the ramp. */}
      <g transform="translate(262 222) rotate(-20)" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round">
        <circle cx={0} cy={0} r={13} />
        <circle cx={0} cy={-34} r={5} />
        <path d="M0 -27 V-10 H16 L22 4 M-2 -18 H12" />
      </g>
      {/* Read aloud: sound waves from the phone's speaker. */}
      <g className="scene-signal" stroke={AMBER} strokeWidth={2.4} fill="none" strokeLinecap="round" transform="translate(300 92)">
        <path d="M0 -14 V14 M-10 -6 V6 M10 -22 V22 M20 -10 V10 M30 -4 V4" />
      </g>
    </>
  );
}

const SCENES: Record<FeatureKey, () => React.JSX.Element> = {
  shade: Shade,
  night: Night,
  ai: Ai,
  access: Access,
  photos: Photos,
  offline: Offline,
  sos: Sos,
  private: Private,
};

export function FeatureScene({ k }: { k: FeatureKey }) {
  const Scene = SCENES[k];
  return (
    <svg className={`scene scene--${k}`} viewBox="0 0 400 280" role="presentation" focusable="false">
      <Scene />
    </svg>
  );
}
