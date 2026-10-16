import { useGo } from '../utils/transition.ts';
import { useState } from 'react';
import { ArrowLeft, FlaskConical, Plus } from 'lucide-react';
import { MAX_CONTACTS, normalisePhone } from '@walkwe/data';
import { markSetupDone, useContacts } from '../store/contacts.ts';
import { LangToggle } from '../components/LangToggle.tsx';
import { useI18n } from '../store/i18n.tsx';

interface Row {
  name: string;
  phone: string;
}

/**
 * Asked once, right after Start on the welcome page and before the app: the
 * walker's own number and, optionally, emergency contacts for SOS. Contact
 * fields stay closed until "Add" is tapped (user, 15 Oct 2026), so the page
 * is short and the judges' demo button is in view. Skippable — a safety app
 * must not stand between someone and their route — and editable later.
 */
export default function SafetySetup() {
  const { t } = useI18n();
  const nav = useGo();
  const { contacts, add, selfPhone, setSelfPhone } = useContacts();
  const [self, setSelf] = useState(selfPhone ?? '');
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const finish = () => {
    markSetupDone();
    nav('/plan', { replace: true });
  };

  // Judges' demo: no numbers needed, opens the planner with the pilot's
  // photo-guided route (BTS Siam → CentralWorld) already filled in.
  const demo = () => {
    markSetupDone();
    nav('/plan?demo=1', { replace: true });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (self.trim() && !normalisePhone(self)) errs.self = t('contacts.badPhone');
    rows.forEach((r, i) => {
      const hasName = !!r.name.trim(),
        hasPhone = !!r.phone.trim();
      if (!hasName && !hasPhone) return; // empty row: ignored
      if (!hasName) errs[`name${i}`] = t('setup.needName');
      if (!hasPhone) errs[`phone${i}`] = t('setup.needPhone');
      else if (!normalisePhone(r.phone)) errs[`phone${i}`] = t('contacts.badPhone');
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      // After React has marked the fields: focus the first one that needs fixing.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSelfPhone(self);
    for (const r of rows) if (r.name.trim() && r.phone.trim()) add(r.name, r.phone);
    finish();
  };

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const canAddRow = contacts.length + rows.length < MAX_CONTACTS;

  return (
    <main className="data-page page-enter setup-page">
      <div className="page-side">
        <header className="flow-top">
          <button
            type="button"
            className="icon-btn setup-back"
            // History back would land on "/", which sends an onboarded user
            // straight back here; the welcome page is where this arrow leads.
            onClick={() => nav('/welcome')}
            aria-label={t('common.back')}
            data-testid="setup-back"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <LangToggle />
        </header>
        <h1 className="h1">{t('setup.title')}</h1>
        <p className="sub">{t('setup.intro')}</p>
        <div className="page-side-art" aria-hidden="true">
          <img src="/art/street-day.svg" alt="" width={1000} height={920} loading="lazy" decoding="async" />
        </div>
      </div>
      <div className="page-body">
        <form className="contact-form setup-form" onSubmit={save} noValidate>
          <div className="form-panel">
            <label className="field">
              <span className="h3">{t('setup.self')}</span>
              <input
                value={self}
                onChange={(e) => setSelf(e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="08X XXX XXXX"
                aria-invalid={!!errors.self}
                data-testid="setup-self"
              />
              {errors.self && (
                <span className="small route-warn" role="alert">
                  {errors.self}
                </span>
              )}
            </label>

            {contacts.length > 0 && (
              <div className="setup-existing">
                <h2 className="h3">{t('setup.contacts')}</h2>
                {contacts.map((c) => (
                  <p key={c.id} className="small">
                    {c.name} · {c.phone}
                  </p>
                ))}
              </div>
            )}
            {rows.map((r, i) => (
              <fieldset key={i} className="setup-row">
                <legend className="small">{t('setup.contactN', { n: contacts.length + i + 1 })}</legend>
                <label className="field">
                  <span className="small">{t('contacts.name')}</span>
                  <input
                    value={r.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    autoComplete="off"
                    maxLength={60}
                    aria-invalid={!!errors[`name${i}`]}
                    data-testid={`setup-name-${i}`}
                    autoFocus={i === rows.length - 1}
                  />
                  {errors[`name${i}`] && (
                    <span className="small route-warn" role="alert">
                      {errors[`name${i}`]}
                    </span>
                  )}
                </label>
                <label className="field">
                  <span className="small">{t('contacts.phone')}</span>
                  <input
                    value={r.phone}
                    onChange={(e) => update(i, { phone: e.target.value })}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    aria-invalid={!!errors[`phone${i}`]}
                    data-testid={`setup-phone-${i}`}
                  />
                  {errors[`phone${i}`] && (
                    <span className="small route-warn" role="alert">
                      {errors[`phone${i}`]}
                    </span>
                  )}
                </label>
              </fieldset>
            ))}
            {canAddRow && (
              <button type="button" className="btn btn--add" onClick={() => setRows((rs) => [...rs, { name: '', phone: '' }])} data-testid="setup-add-contact">
                <Plus size={20} aria-hidden="true" />
                {rows.length || contacts.length ? t('setup.addAnother') : t('setup.addContact')}
              </button>
            )}

            <div className="setup-actions">
              <button type="submit" className="btn btn--primary" data-testid="setup-save">
                {t('setup.save')}
              </button>
              <button type="button" className="btn btn--text" onClick={finish} data-testid="setup-skip">
                {t('setup.skip')}
              </button>
              <p className="small setup-later">{t('setup.later')}</p>
            </div>
          </div>
          <div className="setup-demo">
            <button type="button" className="btn btn--ghost" onClick={demo} data-testid="setup-demo">
              <FlaskConical size={20} aria-hidden="true" />
              {t('setup.demo')}
            </button>
            <p className="small">{t('setup.demoNote')}</p>
          </div>
        </form>
      </div>
    </main>
  );
}
