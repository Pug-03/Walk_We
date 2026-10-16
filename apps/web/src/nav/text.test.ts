import { describe, expect, it } from 'vitest';
import type { RouteStep } from '@walkwe/core';
import { stepHints, stepInstruction } from './text.ts';

const base: RouteStep = {
  maneuver: 'left', name: '', wayClass: 'footway', distanceM: 120, at: { lat: 13.7, lng: 100.5 },
  covered: false, elevated: false, stairs: false, shadeSide: 0, mall: null,
};

describe('generated step wording', () => {
  it('uses the street name, or a walkway description when unnamed', () => {
    expect(stepInstruction({ ...base, name: 'ถนนพระรามที่ 1' }, 'th')).toBe('เลี้ยวซ้ายเข้าถนนพระรามที่ 1');
    expect(stepInstruction(base, 'en')).toBe('Turn left onto the footpath');
    expect(stepInstruction({ ...base, elevated: true }, 'th')).toBe('เลี้ยวซ้ายเข้าสะพานลอย / สกายวอล์ก');
    expect(stepInstruction({ ...base, maneuver: 'arrive' }, 'en')).toBe('You have arrived');
  });
  it('adds distance, cover, stairs and the shady side (day only)', () => {
    const s = { ...base, covered: true, stairs: true, shadeSide: -1 as const };
    expect(stepHints(s, 120, 'th', true)).toEqual(['เดินต่อ 120 ม.', 'ทางมีหลังคา', 'มีบันได', 'เดินชิดฝั่งซ้ายเพื่ออยู่ในร่ม']);
    expect(stepHints(s, 120, 'en', false)).toEqual(['Walk 120 m', 'Covered walkway', 'Stairs']);
  });
});
