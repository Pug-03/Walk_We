import { describe, expect, it } from 'vitest';
import { lineShareUrl, mapsLink, shareMessage, smsUrl, sosMessage } from './message.ts';

const at = new Date('2026-10-15T14:05:00Z'); // 21:05 Bangkok
const loc = { lat: 13.745631, lng: 100.534121 };

describe('location messages', () => {
  it('SOS text carries a map link, accuracy and Bangkok time', () => {
    const th = sosMessage({ lang: 'th', at, timeZone: 'Asia/Bangkok', location: loc, accuracyM: 12.4 });
    expect(th).toContain('https://maps.google.com/?q=13.745631,100.534121');
    expect(th).toContain('ราว 12 ม.');
    expect(th).toContain('21:05');
    const en = sosMessage({ lang: 'en', at, timeZone: 'Asia/Bangkok', location: null });
    expect(en).toContain("Couldn't get my location");
  });
  it('SOS text includes the sender\'s own number when set', () => {
    const th = sosMessage({ lang: 'th', at, timeZone: 'Asia/Bangkok', location: loc, selfPhone: '0812345678' });
    expect(th).toContain('เบอร์ติดต่อกลับ: 0812345678');
    expect(sosMessage({ lang: 'en', at, timeZone: 'Asia/Bangkok', location: loc })).not.toContain('Call me back');
  });
  it('share text has location, destination, ETA and says it is not live', () => {
    const s = shareMessage({
      lang: 'th', at, timeZone: 'Asia/Bangkok', location: loc,
      destination: { name: 'centralwOrld', location: { lat: 13.7466, lng: 100.539 } }, etaMin: 9,
    });
    expect(s).toContain('กำลังไป: centralwOrld');
    expect(s).toContain('21:14');
    expect(s).toContain('ไม่ใช่การติดตามสด');
  });
});

describe('hand-off links', () => {
  it('LINE share URL encodes the text', () => {
    const u = lineShareUrl('ช่วยด้วย\nhttps://maps.google.com/?q=1,2');
    expect(u.startsWith('https://line.me/R/share?text=')).toBe(true);
    expect(decodeURIComponent(u.split('text=')[1]!)).toBe('ช่วยด้วย\nhttps://maps.google.com/?q=1,2');
  });
  it('SMS URL uses the right separators per platform', () => {
    expect(smsUrl(['081-234-5678', '+66 89 999 0000'], 'hi', true)).toBe('sms:0812345678,+66899990000&body=hi');
    expect(smsUrl(['0812345678', '0899990000'], 'hi there', false)).toBe('sms:0812345678;0899990000?body=hi%20there');
  });
  it('map link is a plain URL with 6-decimal coordinates', () => {
    expect(mapsLink({ lat: 1.23456789, lng: 2 })).toBe('https://maps.google.com/?q=1.234568,2.000000');
  });
});
