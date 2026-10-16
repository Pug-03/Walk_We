import { describe, expect, it } from 'vitest';
import { explanationMatchesFacts, routeIntentSchema, type RouteFacts } from '../src/ai/adapter.ts';

const day: RouteFacts = {
  lang: 'th',
  mode: 'day',
  minutes: 9,
  meters: 860,
  shortestMeters: 670,
  shadePct: 94,
  shortestShadePct: 55,
  safety: null,
  shortestSafety: null,
  isShortest: false,
};

describe('explanationMatchesFacts', () => {
  it('accepts numbers taken from the facts, including differences', () => {
    expect(explanationMatchesFacts('ร่ม 94% เทียบกับ 55% ของทางที่สั้นที่สุด เดินเพิ่ม 190 ม. ใช้เวลา 9 นาที', day)).toBe(true);
    expect(explanationMatchesFacts('Shade rises by 39 points for 190 m more.', day)).toBe(true);
  });
  it('reads Thai digits', () => {
    expect(explanationMatchesFacts('ร่ม ๙๔%', day)).toBe(true);
  });
  it('rejects a number the router never produced', () => {
    expect(explanationMatchesFacts('ร่ม 97% เดินเพิ่ม 190 ม.', day)).toBe(false);
    expect(explanationMatchesFacts('ประหยัดเวลา 3 นาที', day)).toBe(false);
  });
  it('accepts night scores out of 10', () => {
    const night: RouteFacts = { ...day, mode: 'night', shadePct: null, shortestShadePct: null, safety: 5.8, shortestSafety: 3.9 };
    expect(explanationMatchesFacts('คะแนน 5.8/10 เทียบกับ 3.9 (ตามข้อมูลที่มี)', night)).toBe(true);
  });
});

describe('routeIntentSchema', () => {
  it('takes a well-formed intent and refuses a bad time', () => {
    const ok = {
      from: { kind: 'current_location', query: '' },
      to: { kind: 'place', query: 'สยามพารากอน' },
      mode: 'day',
      leave_at: '14:30',
      stops: ['เซเว่น'],
      clarification: '',
    };
    expect(routeIntentSchema.parse(ok).to.query).toBe('สยามพารากอน');
    expect(() => routeIntentSchema.parse({ ...ok, leave_at: '25:00' })).toThrow();
  });
});
