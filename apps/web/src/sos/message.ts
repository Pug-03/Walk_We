import type { LatLng } from '@walkwe/core';
import type { Lang } from '../i18n.ts';

// Location messages and the links that hand them to LINE / SMS / the share
// sheet. Pure functions; nothing here sends anything by itself.

/** A map link any phone opens (Google Maps app or web). A plain URL — no API, no cost. */
export function mapsLink(p: LatLng): string {
  return `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

function clock(at: Date, timeZone: string, lang: Lang): string {
  return at.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
}

export interface LocationMessage {
  lang: Lang;
  at: Date;
  timeZone: string;
  location: LatLng | null;
  accuracyM?: number | null;
  destination?: { name: string; location: LatLng } | null;
  etaMin?: number | null;
  /** The sender's own number, so people can call back. */
  selfPhone?: string | null;
}

export function sosMessage(m: LocationMessage): string {
  const th = m.lang === 'th';
  const lines = [th ? '🆘 ขอความช่วยเหลือ (ส่งจาก Walk We)' : '🆘 I need help (sent from Walk We)'];
  if (m.location) {
    lines.push(`${th ? 'ตำแหน่งของฉัน' : 'My location'}: ${mapsLink(m.location)}`);
    if (m.accuracyM) lines.push(th ? `ความแม่นยำราว ${Math.round(m.accuracyM)} ม.` : `Accuracy about ${Math.round(m.accuracyM)} m`);
  } else {
    lines.push(th ? 'หาตำแหน่งไม่ได้ โปรดโทรหาฉัน' : "Couldn't get my location — please call me");
  }
  if (m.selfPhone) lines.push(`${th ? 'เบอร์ติดต่อกลับ' : 'Call me back'}: ${m.selfPhone}`);
  lines.push(`${th ? 'เวลา' : 'Time'}: ${clock(m.at, m.timeZone, m.lang)}`);
  return lines.join('\n');
}

export function shareMessage(m: LocationMessage): string {
  const th = m.lang === 'th';
  const lines = [th ? '🚶 ฉันกำลังเดินทาง (แชร์จาก Walk We)' : '🚶 I’m on my way (shared from Walk We)'];
  if (m.location) lines.push(`${th ? 'ตอนนี้อยู่ที่' : 'Now at'}: ${mapsLink(m.location)}`);
  if (m.destination) lines.push(`${th ? 'กำลังไป' : 'Heading to'}: ${m.destination.name} ${mapsLink(m.destination.location)}`);
  if (m.etaMin != null) {
    const eta = new Date(m.at.getTime() + m.etaMin * 60_000);
    lines.push(th ? `คาดว่าถึงราว ${clock(eta, m.timeZone, m.lang)} (อีก ${m.etaMin} นาที)` : `Expected around ${clock(eta, m.timeZone, m.lang)} (${m.etaMin} min)`);
  }
  lines.push(th ? `ตำแหน่ง ณ เวลา ${clock(m.at, m.timeZone, m.lang)} ไม่ใช่การติดตามสด` : `Location as of ${clock(m.at, m.timeZone, m.lang)} — not live tracking`);
  return lines.join('\n');
}

/** LINE's official share URL: opens LINE and lets the user pick a chat. */
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

/** Pre-filled SMS. iOS and Android disagree on the separators. */
export function smsUrl(numbers: string[], text: string, ios: boolean): string {
  const to = numbers.map((n) => n.replace(/[^\d+]/g, '')).join(ios ? ',' : ';');
  return `sms:${to}${ios ? '&' : '?'}body=${encodeURIComponent(text)}`;
}
