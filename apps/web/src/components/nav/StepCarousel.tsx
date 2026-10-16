import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from 'framer-motion';

// Reversible step carousel for navigation. Unlike onboarding's throw-away
// deck, nothing is discarded: swipe left = next, right = previous, and it
// always snaps back to a whole step. No tap gestures here (no double-tap,
// no long-press) — buttons do everything a swipe does.

const SNAP = { type: 'spring', stiffness: 420, damping: 42, mass: 0.8 } as const;
const SWIPE_SHARE = 0.18; // of the width
const FLICK = 450; // px/s

interface Props {
  index: number;
  count: number;
  onIndex: (i: number) => void;
  renderStep: (i: number) => ReactNode;
  label: string;
}

export function StepCarousel({ index, count, onIndex, renderStep, label }: Props) {
  const reduceMotion = useReducedMotion();
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Settle on the current step (after swipes, buttons, resizes).
  useEffect(() => {
    if (!width) return;
    const target = -index * width;
    if (reduceMotion) x.set(target);
    else animate(x, target, SNAP);
  }, [index, width, reduceMotion, x]);

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    let next = index;
    if (offset.x < -width * SWIPE_SHARE || velocity.x < -FLICK) next = index + 1;
    else if (offset.x > width * SWIPE_SHARE || velocity.x > FLICK) next = index - 1;
    next = Math.max(0, Math.min(count - 1, next));
    if (next === index) animate(x, -index * width, SNAP);
    else onIndex(next);
  };

  return (
    <div ref={viewport} className="carousel" role="region" aria-roledescription="carousel" aria-label={label}>
      <motion.div
        className="carousel-track"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -(count - 1) * width, right: 0 }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragEnd={onDragEnd}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="carousel-slide"
            role="group"
            aria-roledescription="slide"
            aria-hidden={i !== index}
            // Off-screen steps can't take focus (React 18 types lack `inert`).
            {...(i !== index ? ({ inert: '' } as Record<string, string>) : {})}
            style={{ width: width || '100%' }}
          >
            {Math.abs(i - index) <= 2 ? renderStep(i) : null}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
