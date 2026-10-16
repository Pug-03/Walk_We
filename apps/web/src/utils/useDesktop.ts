import { useEffect, useState } from 'react';

/** Same breakpoint as the CSS desktop layouts (app.css, min-width: 960px). */
export const DESKTOP_QUERY = '(min-width: 960px)';

/** True on desktop-width screens; follows window resizes. */
export function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => window.matchMedia?.(DESKTOP_QUERY).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(DESKTOP_QUERY);
    if (!mq) return;
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}
