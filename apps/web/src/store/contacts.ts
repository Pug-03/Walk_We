import { useCallback, useState } from 'react';
import { contactSchema, MAX_CONTACTS, normalisePhone, parseList, selfSchema, type EmergencyContact } from '@walkwe/data';
import { readJson, storage, writeJson } from '../utils/storage.ts';

// Emergency contacts and the walker's own number: localStorage only. They
// never leave the device except inside an SOS message or sms: link the user
// taps themselves.

const KEY = 'ww_emergency_contacts';
const SELF_KEY = 'ww_self';
const SETUP_KEY = 'ww_setup_done';

export const loadContacts = (): EmergencyContact[] => parseList(contactSchema, readJson(storage, KEY));
export function loadSelfPhone(): string | null {
  const r = selfSchema.safeParse(readJson(storage, SELF_KEY));
  return r.success ? r.data.phone : null;
}

/** The safety setup step (own number + contacts) was completed or skipped. */
export const hasDoneSetup = () => storage.getItem(SETUP_KEY) === '1';
export const markSetupDone = () => storage.setItem(SETUP_KEY, '1');

export function useContacts() {
  const [contacts, setContacts] = useState(loadContacts);
  const [selfPhone, setSelfPhoneState] = useState(loadSelfPhone);
  const persist = (next: EmergencyContact[]) => {
    writeJson(storage, KEY, next);
    setContacts(next);
  };
  const add = useCallback((name: string, rawPhone: string): 'ok' | 'bad-phone' | 'full' => {
    const phone = normalisePhone(rawPhone);
    if (!phone || !name.trim()) return 'bad-phone';
    const list = loadContacts();
    if (list.length >= MAX_CONTACTS) return 'full';
    persist([...list, { id: `${Date.now()}-${list.length}`, name: name.trim().slice(0, 60), phone }]);
    return 'ok';
  }, []);
  const remove = useCallback((id: string) => persist(loadContacts().filter((c) => c.id !== id)), []);
  /** Empty input clears the number. */
  const setSelfPhone = useCallback((raw: string): 'ok' | 'bad-phone' => {
    if (!raw.trim()) {
      storage.removeItem(SELF_KEY);
      setSelfPhoneState(null);
      return 'ok';
    }
    const phone = normalisePhone(raw);
    if (!phone) return 'bad-phone';
    writeJson(storage, SELF_KEY, { phone });
    setSelfPhoneState(phone);
    return 'ok';
  }, []);
  return { contacts, add, remove, selfPhone, setSelfPhone };
}
