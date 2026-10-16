import { describe, expect, it } from 'vitest';
import { contactSchema, normalisePhone } from '../src/index.ts';

describe('emergency contacts', () => {
  it('normalises Thai and international numbers', () => {
    expect(normalisePhone('081-234-5678')).toBe('0812345678');
    expect(normalisePhone('02 123 4567')).toBe('021234567');
    expect(normalisePhone('+66 81 234 5678')).toBe('+66812345678');
    expect(normalisePhone('1234')).toBeNull();
    expect(normalisePhone('call me')).toBeNull();
  });
  it('only stores normalised numbers', () => {
    expect(contactSchema.safeParse({ id: '1', name: 'แม่', phone: '0812345678' }).success).toBe(true);
    expect(contactSchema.safeParse({ id: '1', name: 'แม่', phone: '081-234-5678' }).success).toBe(false);
    expect(contactSchema.safeParse({ id: '1', name: ' ', phone: '0812345678' }).success).toBe(false);
  });
});
