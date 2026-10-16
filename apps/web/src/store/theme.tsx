import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { activeCity } from '@walkwe/config';
import { modeForTime, type WalkMode } from '@walkwe/core';
import { storage } from '../utils/storage.ts';

export type ThemePref = 'auto' | WalkMode;
const KEY = 'ww_theme';
// Matches --bg (dark in both themes): the browser chrome blends into the page.
const THEME_COLOR: Record<WalkMode, string> = { day: '#050B1A', night: '#050B1A' };

interface ThemeValue {
  pref: ThemePref;
  theme: WalkMode;
  setPref: (p: ThemePref) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const readPref = (): ThemePref => {
  const v = storage.getItem(KEY);
  return v === 'day' || v === 'night' ? v : 'auto';
};

// Auto follows the sun at the city centre (sunrise..sunset), re-checked each
// minute so a page left open across dusk switches by itself.
const autoTheme = () => modeForTime(new Date(), activeCity.center);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [auto, setAuto] = useState<WalkMode>(autoTheme);

  useEffect(() => {
    if (pref !== 'auto') return;
    setAuto(autoTheme());
    const id = setInterval(() => setAuto(autoTheme()), 60_000);
    return () => clearInterval(id);
  }, [pref]);

  const theme = pref === 'auto' ? auto : pref;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  const setPref = useCallback((p: ThemePref) => {
    if (p === 'auto') storage.removeItem(KEY);
    else storage.setItem(KEY, p);
    setPrefState(p);
  }, []);

  const value = useMemo(() => ({ pref, theme, setPref }), [pref, theme, setPref]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme outside ThemeProvider');
  return v;
}
