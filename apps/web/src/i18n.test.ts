import { describe, expect, it } from 'vitest';
import { STRINGS, translate } from './i18n.ts';

describe('i18n', () => {
  it('English and Thai have exactly the same keys, none empty', () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.th).sort());
    for (const lang of ['th', 'en'] as const) {
      for (const [k, v] of Object.entries(STRINGS[lang])) expect(v.trim(), `${lang}:${k}`).not.toBe('');
    }
  });
  it('fills variables', () => {
    expect(translate('en', 'nav.step', { n: 2, total: 4 })).toBe('Step 2/4');
  });
  it('never calls night routes simply "safe"', () => {
    // Brief §7: always "safer (based on available data)", never "safe".
    // The noun "safety" / ความปลอดภัย and "unsafe" / ไม่ปลอดภัย are fine; a bare "safe" is not.
    for (const v of Object.values(STRINGS.en)) expect(v).not.toMatch(/\bsafe\b(?! *\()/i);
    for (const v of Object.values(STRINGS.th)) expect(v).not.toMatch(/(?<!ความ|ไม่)ปลอดภัย(?!กว่า)/);
  });
});
