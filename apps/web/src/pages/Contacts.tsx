import { useGo } from '../utils/transition.ts';
import { useRef, useState } from 'react';
import { ArrowLeft, Check, Plus, Trash2, UserRound } from 'lucide-react';
import { MAX_CONTACTS } from '@walkwe/data';
import { useContacts } from '../store/contacts.ts';
import { LangToggle } from '../components/LangToggle.tsx';
import { useI18n } from '../store/i18n.tsx';

/** Emergency contacts, stored on this device only (brief §8). */
export default function Contacts() {
  const { t } = useI18n();
  const nav = useGo();
  const { contacts, add, remove, selfPhone, setSelfPhone } = useContacts();
  const [self, setSelf] = useState(selfPhone ?? '');
  const [selfError, setSelfError] = useState<string | null>(null);
  const [selfSaved, setSelfSaved] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = add(name, phone);
    if (r === 'ok') {
      setName('');
      setPhone('');
      setError(null);
      nameRef.current?.focus(); // ready for the next contact
    } else setError(r === 'full' ? t('contacts.full', { n: MAX_CONTACTS }) : t('contacts.badPhone'));
  };

  return (
    <main className="data-page page-enter">
      <div className="page-side">
        <header className="data-head">
          <button
            type="button"
            className="icon-btn"
            style={{ border: 0 }}
            onClick={() => (history.length > 1 ? nav(-1) : nav('/plan'))}
            aria-label={t('common.back')}
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="h2">{t('contacts.title')}</h1>
          <LangToggle />
        </header>
        <p className="sub">{t('contacts.intro')}</p>
        <div className="page-side-art" aria-hidden="true">
          <img src="/art/street-day.svg" alt="" width={1000} height={920} loading="lazy" decoding="async" />
        </div>
      </div>
      <div className="page-body">
        <form
          className="form-panel"
          aria-labelledby="self-label"
          onSubmit={(e) => {
            e.preventDefault();
            const r = setSelfPhone(self);
            setSelfError(r === 'ok' ? null : t('contacts.badPhone'));
            setSelfSaved(r === 'ok');
          }}
          noValidate
        >
          <div className="field">
            <label className="h3" id="self-label" htmlFor="contact-self">
              {t('setup.self')}
            </label>
            {/* Number and its Save sit on one line: one value, one action. */}
            <div className="inline-field">
              <input
                id="contact-self"
                value={self}
                onChange={(e) => {
                  setSelf(e.target.value);
                  setSelfSaved(false);
                }}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="08X XXX XXXX"
                aria-invalid={!!selfError}
                data-testid="contact-self"
              />
              <button type="submit" className="btn btn--ghost" data-saved={selfSaved || undefined}>
                {selfSaved && <Check size={20} aria-hidden="true" />}
                {selfSaved ? t('common.saved') : t('common.save')}
              </button>
            </div>
          </div>
          {selfError && (
            <p className="small route-warn" role="alert">
              {selfError}
            </p>
          )}
        </form>

        <section className="form-panel" aria-labelledby="contacts-h">
          <div className="panel-head">
            <h2 className="h3" id="contacts-h">
              {t('setup.contacts')}
            </h2>
            <span className="small">
              {contacts.length}/{MAX_CONTACTS}
            </span>
          </div>
          <ul className="list contact-list" data-testid="contact-list">
            {contacts.length === 0 && <li className="small contact-empty">{t('contacts.empty')}</li>}
            {contacts.map((c) => (
              <li key={c.id} className="row-wrap">
                <span className="row">
                  <span className="row-ic" aria-hidden="true">
                    <UserRound size={20} />
                  </span>
                  <span className="row-text">
                    <span className="row-title">{c.name}</span>
                    <span className="row-detail">{c.phone}</span>
                  </span>
                </span>
                <button type="button" className="icon-btn" style={{ border: 0 }} onClick={() => {
                    const at = contacts.findIndex((x) => x.id === c.id);
                    remove(c.id);
                    // Keep focus in the list (keyboard / screen readers): the row that took its place, else the one above, else the name field.
                    requestAnimationFrame(() => {
                      const btns = document.querySelectorAll<HTMLElement>('[data-testid="contact-list"] .icon-btn');
                      (btns[Math.min(at, btns.length - 1)] ?? nameRef.current)?.focus();
                    });
                  }} aria-label={t('contacts.remove', { name: c.name })}>
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {contacts.length < MAX_CONTACTS && (
            <form className="contact-form contact-add" onSubmit={submit} noValidate>
              <div className="field-pair">
                <label className="field">
                  <span className="small">{t('contacts.name')}</span>
                  <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} data-testid="contact-name" />
                </label>
                <label className="field">
                  <span className="small">{t('contacts.phone')}</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    data-testid="contact-phone"
                    aria-invalid={!!error}
                  />
                </label>
              </div>
              {error && (
                <p className="small route-warn" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn--primary">
                <Plus size={20} aria-hidden="true" />
                {t('contacts.add')}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
