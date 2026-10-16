import type { Place } from '@walkwe/core';
import type { Lang } from '../../i18n.ts';

/**
 * Well-known places in the pilot area, searched on-device so the picker
 * answers instantly even when the public geocoder is slow (it often takes
 * 7-14 s from Thailand). Mall points are the centroids of their outlines in
 * data/areas/siam.json (OSM); BTS points are the stations' platforms.
 */
interface Landmark {
  id: string;
  th: string;
  en: string;
  /** Extra spellings people type; matched, never shown. */
  alias?: string[];
  lat: number;
  lng: number;
}

const LANDMARKS: Landmark[] = [
  { id: 'osm:W781138575', th: 'สยามพารากอน', en: 'Siam Paragon', alias: ['paragon', 'พารากอน'], lat: 13.74656, lng: 100.53471 },
  { id: 'osm:W25701334', th: 'สยามเซ็นเตอร์', en: 'Siam Center', lat: 13.74627, lng: 100.53284 },
  { id: 'osm:W157770877', th: 'สยามดิสคัฟเวอรี่', en: 'Siam Discovery', lat: 13.74666, lng: 100.53151 },
  { id: 'osm:W365999406', th: 'สยามสแควร์วัน', en: 'Siam Square One', alias: ['ssq1'], lat: 13.74497, lng: 100.53377 },
  { id: 'osm:W157593033', th: 'เซ็นเตอร์พอยท์ สยามสแควร์', en: 'Center Point Siam Square', alias: ['สยามสแควร์', 'siam square'], lat: 13.74531, lng: 100.53321 },
  { id: 'osm:W157770925', th: 'ลิโด้ คอนเน็คท์', en: 'Lido Connect', alias: ['ลิโด้', 'lido'], lat: 13.74549, lng: 100.53251 },
  { id: 'osm:W157487610', th: 'เอ็ม บี เค เซ็นเตอร์', en: 'MBK Center', alias: ['mbk', 'มาบุญครอง'], lat: 13.74461, lng: 100.52984 },
  { id: 'osm:W356193680', th: 'สเตเดียมวัน', en: 'Stadium One', lat: 13.74665, lng: 100.52433 },
  { id: 'osm:W319158843', th: 'แอมพาร์ค', en: 'Amparkk Chula', alias: ['ampark'], lat: 13.74002, lng: 100.52472 },
  { id: 'osm:W157482067', th: 'เซ็นทรัลเวิลด์', en: 'centralwOrld', alias: ['central world', 'เซ็นทรัล เวิลด์'], lat: 13.74646, lng: 100.53869 },
  { id: 'osm:W25787548', th: 'เกษร อัมรินทร์', en: 'Gaysorn Amarin', alias: ['gaysorn', 'เกษร', 'amarin', 'อัมรินทร์'], lat: 13.74379, lng: 100.54124 },
  { id: 'osm:W25829679', th: 'เอราวัณ แบงค็อก', en: 'Erawan Bangkok', alias: ['erawan', 'เอราวัณ'], lat: 13.74364, lng: 100.54051 },
  { id: 'osm:W25745689', th: 'บิ๊กซี ราชดำริ', en: 'Big C Ratchadamri', alias: ['big c', 'bigc', 'บิ๊กซี'], lat: 13.74699, lng: 100.54162 },
  { id: 'osm:W539806478', th: 'แพลทินัม ป๊อป', en: 'Platinum Pop', lat: 13.74806, lng: 100.54217 },
  { id: 'osm:W31141613', th: 'เดอะ แพลทินัม แฟชั่นมอลล์', en: 'Platinum Fashion Mall', alias: ['platinum', 'แพลทินัม', 'แพลตินัม'], lat: 13.74987, lng: 100.54013 },
  { id: 'osm:W31141565', th: 'พันธุ์ทิพย์ พลาซ่า', en: 'Pantip Plaza', alias: ['pantip', 'พันธุ์ทิพย์'], lat: 13.75015, lng: 100.53713 },
  { id: 'osm:W229970775', th: 'พาลาเดียม เวิลด์ ช้อปปิ้ง', en: 'The Palladium World Shopping', alias: ['palladium', 'พาลาเดียม'], lat: 13.75056, lng: 100.54241 },
  { id: 'osm:W244115004', th: 'เซ็นทรัล เอ็มบาสซี', en: 'Central Embassy', alias: ['embassy', 'เอ็มบาสซี'], lat: 13.74394, lng: 100.54663 },
  { id: 'osm:W27644094', th: 'เวฟ เพลส', en: 'Wave Place', lat: 13.74386, lng: 100.54788 },
  { id: 'osm:W62216205', th: 'เพลินจิต เซ็นเตอร์', en: 'Ploenchit Center', alias: ['ploenchit', 'เพลินจิต'], lat: 13.74172, lng: 100.55142 },
  { id: 'osm:W1193692161', th: 'วีลา สินธร วิลเลจ', en: 'Velaa Sindhorn Village', alias: ['velaa', 'สินธร'], lat: 13.7369, lng: 100.5429 },
  { id: 'bts:CEN', th: 'BTS สยาม', en: 'BTS Siam', alias: ['สถานีสยาม', 'siam station'], lat: 13.74563, lng: 100.53418 },
  { id: 'bts:W1', th: 'BTS สนามกีฬาแห่งชาติ', en: 'BTS National Stadium', alias: ['สนามกีฬา', 'national stadium'], lat: 13.74655, lng: 100.52905 },
  { id: 'bts:E1', th: 'BTS ชิดลม', en: 'BTS Chit Lom', alias: ['ชิดลม', 'chidlom', 'chit lom'], lat: 13.74414, lng: 100.54305 },
  { id: 'bts:E2', th: 'BTS เพลินจิต', en: 'BTS Phloen Chit', alias: ['phloen chit'], lat: 13.74296, lng: 100.54891 },
  { id: 'bts:S1', th: 'BTS ราชดำริ', en: 'BTS Ratchadamri', alias: ['ราชดำริ', 'ratchadamri'], lat: 13.73938, lng: 100.53937 },
];

/** Lower-case, no spaces or zero-width marks, so "central world" finds "centralwOrld". */
const norm = (s: string) => s.toLowerCase().replace(/[\s\u200b.\-']/g, '');

/** Places in the pilot area whose name or alias contains the query, best match first. */
export function searchLandmarks(text: string, lang: Lang, limit = 5): Place[] {
  const q = norm(text);
  if (q.length < 2) return [];
  const scored: { l: Landmark; score: number }[] = [];
  for (const l of LANDMARKS) {
    const names = [l.th, l.en, ...(l.alias ?? [])].map(norm);
    if (names.some((n) => n.startsWith(q))) scored.push({ l, score: 0 });
    else if (names.some((n) => n.includes(q))) scored.push({ l, score: 1 });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ l }) => ({
      id: l.id,
      name: lang === 'en' ? l.en : l.th,
      detail: lang === 'en' ? l.th : l.en,
      location: { lat: l.lat, lng: l.lng },
    }));
}
