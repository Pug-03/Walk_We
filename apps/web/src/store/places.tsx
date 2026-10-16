import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { PlaceRecord, RecentPlace, SavedPlace, SavedSlot } from '@walkwe/data';
import { storage } from '../utils/storage.ts';
import {
  loadRecents,
  loadSaved,
  persistRecents,
  persistSaved,
  withRecent,
  withSaved,
  withoutSaved,
} from './placesModel.ts';

interface PlacesValue {
  saved: SavedPlace[];
  recents: RecentPlace[];
  save: (place: PlaceRecord, slot: SavedSlot) => void;
  remove: (slot: SavedSlot, id: string) => void;
  noteUsed: (place: PlaceRecord) => void;
}

const PlacesContext = createContext<PlacesValue | null>(null);

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState(() => loadSaved(storage));
  const [recents, setRecents] = useState(() => loadRecents(storage));

  const save = useCallback((place: PlaceRecord, slot: SavedSlot) => {
    setSaved((list) => {
      const next = withSaved(list, place, slot, Date.now());
      persistSaved(storage, next);
      return next;
    });
  }, []);

  const remove = useCallback((slot: SavedSlot, id: string) => {
    setSaved((list) => {
      const next = withoutSaved(list, slot, id);
      persistSaved(storage, next);
      return next;
    });
  }, []);

  const noteUsed = useCallback((place: PlaceRecord) => {
    setRecents((list) => {
      const next = withRecent(list, place, Date.now());
      persistRecents(storage, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ saved, recents, save, remove, noteUsed }), [saved, recents, save, remove, noteUsed]);
  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces(): PlacesValue {
  const v = useContext(PlacesContext);
  if (!v) throw new Error('usePlaces outside PlacesProvider');
  return v;
}
