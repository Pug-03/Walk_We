import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from 'framer-motion';
import { useI18n } from '../store/i18n.tsx';
import { safeAreaInset } from '../utils/safeArea.ts';
import { useDesktop } from '../utils/useDesktop.ts';

export type Snap = 'peek' | 'half' | 'full';
const ORDER: Snap[] = ['peek', 'half', 'full'];

// Same spring family as DeePer's share sheet (340/32), a touch firmer so a
// flick settles inside the 300 ms motion budget.
const SPRING = { type: 'spring', stiffness: 420, damping: 40, mass: 0.8 } as const;
/** Space kept clear above a full sheet for the top bar (info + SOS), plus the top safe area. */
export const TOP_RESERVE = 72;
/** Desktop side panel: width plus its gap on either side (px). */
export const SIDE_PANEL_SPACE = 24 + 440 + 24;
/** How far ahead a flick is projected when picking the snap point (s). */
const PROJECT_S = 0.18;

interface Props {
  snap: Snap;
  onSnapChange: (snap: Snap) => void;
  /** Always visible, even at peek; its height defines the peek height. */
  header: ReactNode;
  children?: ReactNode;
  /** Reports the visible sheet height (px) after it settles. */
  onVisibleHeight?: (px: number) => void;
  label: string;
}

/**
 * Full-screen-map bottom sheet with three snap points. Drag from the grip
 * (top strip) or tap it to cycle; the body scrolls on its own. Only
 * transform is animated. On desktop it is a fixed side panel instead: no
 * snapping, always fully open, and it takes no height from the map.
 */
export function BottomSheet({ snap, onSnapChange, header, children, onVisibleHeight, label }: Props) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const desktop = useDesktop();
  const controls = useDragControls();
  const y = useMotionValue(0);
  const gripRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Body content height (last measured while visible): "full" opens only as
  // far as the content goes, so a short panel doesn't drag up a navy void.
  const [contentH, setContentH] = useState(Infinity);
  const [screenH, setScreenH] = useState(() => window.innerHeight);
  const [peekH, setPeekH] = useState(160);
  const [topSafe] = useState(() => safeAreaInset('top'));

  // Screen height follows the visual viewport (URL bar, rotation); peek
  // follows the header's real height so 200% text never gets cut off.
  useEffect(() => {
    const onResize = () => setScreenH(window.visualViewport?.height ?? window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);
  useLayoutEffect(() => {
    const measure = () => {
      const grip = gripRef.current?.offsetHeight ?? 0;
      const head = headRef.current?.offsetHeight ?? 0;
      setPeekH(grip + head + safeAreaInset('bottom') + 12);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headRef.current) ro.observe(headRef.current);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    const measure = () => {
      if (!el.offsetHeight) return; // hidden at peek: keep the last value
      const grip = gripRef.current?.offsetHeight ?? 0;
      const head = headRef.current?.offsetHeight ?? 0;
      // + body padding: space-3 top, space-6 bottom, plus the bottom inset.
      setContentH(grip + head + el.offsetHeight + 12 + 24 + safeAreaInset('bottom'));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [desktop]);

  const fullH = Math.max(peekH, Math.min(screenH - TOP_RESERVE - topSafe, contentH));
  const heights: Record<Snap, number> = {
    peek: Math.min(peekH, fullH),
    half: Math.min(fullH, Math.max(peekH, Math.round(screenH * 0.64))),
    full: fullH,
  };
  const offsetFor = useCallback((s: Snap) => fullH - heights[s], [fullH, heights.peek, heights.half]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = useCallback(
    (s: Snap) => onVisibleHeight?.(desktop ? 0 : heights[s]),
    [onVisibleHeight, desktop, heights.peek, heights.half, heights.full], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Settle on the requested snap whenever it (or the geometry) changes.
  useEffect(() => {
    const target = offsetFor(snap);
    if (reduceMotion) {
      y.set(target);
      report(snap);
      return;
    }
    const ctl = animate(y, target, SPRING);
    ctl.then(() => report(snap));
    return () => ctl.stop();
  }, [snap, offsetFor, reduceMotion, y, report]);

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const projected = y.get() + info.velocity.y * PROJECT_S;
    let best: Snap = snap;
    let bestDist = Infinity;
    for (const s of ORDER) {
      const d = Math.abs(offsetFor(s) - projected);
      if (d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    if (best === snap) animate(y, offsetFor(snap), SPRING);
    else onSnapChange(best);
  };

  const cycle = () => onSnapChange(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]!);

  if (desktop) {
    return (
      <section className="sheet sheet--side" aria-label={label}>
        <div className="sheet-head">{header}</div>
        <div className="sheet-body">{children}</div>
      </section>
    );
  }

  return (
    <motion.section
      className="sheet"
      aria-label={label}
      style={{ height: fullH, y }}
      drag="y"
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: offsetFor('peek') }}
      dragElastic={0.08}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      data-snap={snap}
    >
      <div ref={gripRef} className="sheet-grip" onPointerDown={(e) => controls.start(e)}>
        <button
          type="button"
          className="sheet-handle"
          onClick={cycle}
          aria-label={snap === 'full' ? t('sheet.collapse') : t('sheet.expand')}
          aria-expanded={snap === 'full'}
        />
      </div>
      <div ref={headRef} className="sheet-head">
        {header}
      </div>
      {/* The sheet is always full height and slid down, so pad the body by
          the hidden part or its last rows sit below the screen edge. */}
      <div
        className="sheet-body"
        hidden={snap === 'peek'}
        aria-hidden={snap === 'peek'}
        // Scrolling the list means the user wants more of it: open fully first.
        onScroll={(e) => snap === 'half' && e.currentTarget.scrollTop > 8 && onSnapChange('full')}
        style={{ paddingBottom: `calc(var(--space-6) + var(--safe-b) + ${offsetFor(snap)}px)` }}
      >
        <div ref={contentRef}>{children}</div>
      </div>
    </motion.section>
  );
}
