import { z } from 'zod';

// Emergency contacts: device-only (localStorage), never sent to a server —
// they are only ever placed into an sms: link on the user's own phone.

/** Thai mobile/landline or international number, normalised to digits (and a leading +). */
export function normalisePhone(raw: string): string | null {
  const s = raw.trim().replace(/[\s\-().]/g, '');
  if (/^\+\d{8,15}$/.test(s)) return s;
  if (/^0\d{8,9}$/.test(s)) return s;
  return null;
}

export const contactSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  phone: z.string().refine((p) => normalisePhone(p) === p, 'normalised phone'),
});
export type EmergencyContact = z.infer<typeof contactSchema>;
export const MAX_CONTACTS = 5;

/** The walker's own number, put into SOS messages so people can call back. Device-only. */
export const selfSchema = z.object({
  phone: z.string().refine((p) => normalisePhone(p) === p, 'normalised phone'),
});
export type SelfProfile = z.infer<typeof selfSchema>;
