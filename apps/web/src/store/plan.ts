import type { PlaceRecord } from '@walkwe/data';

export type Field = 'from' | 'to';
export type PickedKind = 'current' | 'search' | 'pin' | 'saved' | 'recent';
export interface PickedPlace extends PlaceRecord {
  kind: PickedKind;
}

export const CURRENT_ID = 'current-location';
export const pinId = (p: { lat: number; lng: number }) => `pin:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
