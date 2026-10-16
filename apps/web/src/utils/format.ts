import type { Lang } from '../i18n.ts';

export function formatDistance(m: number, lang: Lang): string {
  if (m < 1000) {
    const rounded = Math.max(10, Math.round(m / 10) * 10);
    return lang === 'th' ? `${rounded} ม.` : `${rounded} m`;
  }
  const km = (m / 1000).toFixed(m < 10_000 ? 1 : 0);
  return lang === 'th' ? `${km} กม.` : `${km} km`;
}

/** 5-decimal (≈1 m) coordinate text for display and tests; never logged. */
export const coordText = (p: { lat: number; lng: number }) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
