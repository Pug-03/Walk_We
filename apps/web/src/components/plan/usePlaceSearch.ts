import { useEffect, useState } from 'react';
import { haversineMeters, type LatLng, type Place } from '@walkwe/core';
import type { Lang } from '../../i18n.ts';
import { geocoder } from '../../services.ts';
import { searchLandmarks } from './landmarks.ts';

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  /** `more`: the online geocoder is still working and may add results. */
  | { status: 'done'; results: Place[]; more?: boolean }
  | { status: 'error' };

const DEBOUNCE_MS = 350;
/** The public Photon server can take 7-14 s; past this the user has moved on. */
const TIMEOUT_MS = 8000;
/** An online result this close to a local landmark is the same place. */
const SAME_PLACE_M = 150;

/**
 * Debounced, cancellable search-as-you-type. Local landmarks show at once;
 * geocoder results are appended when (if) they arrive.
 */
export function usePlaceSearch(query: string, lang: Lang, near: LatLng): SearchState {
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) {
      setState({ status: 'idle' });
      return;
    }
    const local = searchLandmarks(q, lang);
    setState(local.length ? { status: 'done', results: local, more: true } : { status: 'loading' });
    const ctl = new AbortController();
    let timedOut = false;
    const giveUp = setTimeout(() => {
      timedOut = true;
      ctl.abort();
    }, DEBOUNCE_MS + TIMEOUT_MS);
    const timer = setTimeout(() => {
      geocoder
        .search({ text: q, lang, near, signal: ctl.signal })
        .then((online) => {
          const extra = online.filter((p) => !local.some((l) => haversineMeters(l.location, p.location) < SAME_PLACE_M));
          setState({ status: 'done', results: [...local, ...extra] });
        })
        .catch((e: unknown) => {
          if ((e as Error)?.name === 'AbortError' && !timedOut) return;
          setState(local.length ? { status: 'done', results: local } : { status: 'error' });
        })
        .finally(() => clearTimeout(giveUp));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      clearTimeout(giveUp);
      ctl.abort();
    };
  }, [q, lang, near.lat, near.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
