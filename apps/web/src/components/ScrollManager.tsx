import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Scroll position across page changes:
//   new page (link, button)  → starts at the top
//   back / forward           → returns to where that page was left
// Positions are kept per history entry (location.key) for this session.

const saved = new Map<string, number>();

export function ScrollManager() {
  const location = useLocation();
  const type = useNavigationType();
  const prevKey = useRef(location.key);

  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  // Remember the position of the page being left, continuously (the scroll
  // event is the only reliable moment before the route swaps the content).
  useLayoutEffect(() => {
    const onScroll = () => saved.set(location.key, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.key]);

  useLayoutEffect(() => {
    if (prevKey.current === location.key) return;
    prevKey.current = location.key;
    const target = type === 'POP' ? saved.get(location.key) ?? 0 : 0;
    window.scrollTo(0, target);
    if (target === 0) return;
    // The page may still be growing (lazy sections, images): keep trying for a
    // moment until the saved position exists.
    let tries = 0;
    const again = () => {
      if (Math.abs(window.scrollY - target) < 2 || tries++ > 30) return;
      window.scrollTo(0, target);
      requestAnimationFrame(again);
    };
    requestAnimationFrame(again);
  }, [location.key, type]);

  return null;
}
