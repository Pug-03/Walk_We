import { useEffect, useState, type RefObject } from 'react';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * How far a tall scroll container has been scrolled through: 0 when its top
 * reaches the top of the viewport, 1 when its bottom reaches the bottom. The
 * value eases toward the real one every frame, so wheel steps and trackpad
 * bursts glide instead of jumping; `maxStep` caps the change per frame.
 * Returns 0 while `enabled` is false.
 */
export function useSceneProgress(scene: RefObject<HTMLElement | null>, enabled = true, maxStep = 1): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setP(0);
      return;
    }
    let frame = 0;
    let shown = 0;
    const target = () => {
      const el = scene.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      const run = r.height - window.innerHeight;
      return run > 0 ? clamp01(-r.top / run) : 0;
    };
    const tick = () => {
      const goal = target();
      // Ease toward the goal, never more than maxStep per frame (fast scrolls glide too).
      const step = (goal - shown) * 0.14;
      shown += Math.max(-maxStep, Math.min(maxStep, step));
      if (Math.abs(goal - shown) < 0.0005) shown = goal;
      setP(shown);
      frame = shown === goal ? 0 : requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    shown = target();
    setP(shown);
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake);
    return () => {
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', wake);
      cancelAnimationFrame(frame);
    };
  }, [scene, enabled]);
  return p;
}
