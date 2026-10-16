import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PRIVACY_POLICY } from '../privacyPolicy.ts';
import { LangToggle } from '../components/LangToggle.tsx';
import { useI18n } from '../store/i18n.tsx';
import { storage } from '../utils/storage.ts';
import { useGo } from '../utils/transition.ts';

// Every key the app writes (grep "'ww_" when adding one).
const LOCAL_KEYS = [
  'ww_self',
  'ww_emergency_contacts',
  'ww_saved_places',
  'ww_recent_places',
  'ww_nav',
  'ww_night_factors',
  'ww_lang',
  'ww_theme',
  'ww_onboarded',
  'ww_setup_done',
  'ww_install_prompted',
  'ww_chunk_reload',
];

/** Wipes everything Walk We keeps on this device: ww_* keys and offline caches. */
async function deleteAllLocalData(): Promise<void> {
  // Through the storage wrapper so the in-memory fallback is cleared too.
  // Keep the language the user is reading in; everything else goes.
  for (const k of LOCAL_KEYS) if (k !== 'ww_lang') storage.removeItem(k);
  if ('caches' in window) {
    const keys = await caches.keys().catch(() => [] as string[]);
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

export default function Privacy() {
  const { t, lang } = useI18n();
  const nav = useGo();
  const p = PRIVACY_POLICY[lang];
  // Two taps instead of a browser confirm() dialog: the first arms, the
  // second deletes; it disarms by itself after a few seconds.
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const id = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(id);
  }, [armed]);
  const onDelete = async () => {
    if (!armed) return setArmed(true);
    await deleteAllLocalData();
    setArmed(false);
    setDone(true);
  };

  return (
    <main className="data-page page-enter">
      <div className="page-side">
        <header className="data-head">
          <button
            type="button"
            className="icon-btn"
            style={{ border: 0 }}
            onClick={() => (history.length > 1 ? nav(-1) : nav('/'))}
            aria-label={t('common.back')}
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="h2">
            {/* Break only at the copy's marked point: Thai compounds stay whole. */}
            {p.title.split('\u200b').map((w, i) => (
              <span key={i}>
                {i > 0 && '\u200b'}
                <span className="nowrap">{w}</span>
              </span>
            ))}
          </h1>
          <LangToggle />
        </header>
        <p className="small data-meta">{p.updated}</p>
        <p className="sub">{p.intro}</p>
        <div className="page-side-art" aria-hidden="true">
          <img src="/art/street-day.svg" alt="" width={1000} height={920} loading="lazy" decoding="async" />
        </div>
      </div>
      <div className="page-body">
        <div className="list data-list data-sheet">
          {p.sections.map((s) => (
            <section key={s.title} className="data-item">
              <h2 className="h3">{s.title}</h2>
              {s.body && <p className="small">{s.body}</p>}
              {s.items && (
                <ul className="privacy-items">
                  {s.items.map((it) => (
                    <li key={it} className="small">
                      {it}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        <div className="privacy-actions">
          <button type="button" className="btn btn--primary" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))}>
            {t('privacy.done')}
          </button>
        </div>
        {/* Destructive, so it sits apart from Done, never next to it in the thumb zone. */}
        <div className="privacy-danger">
          <button type="button" className="btn btn--ghost btn--fit" onClick={onDelete} disabled={done} aria-live="polite" data-testid="privacy-delete">
            {done ? t('privacy.deleted') : armed ? t('privacy.deleteConfirm') : t('privacy.delete')}
          </button>
        </div>
      </div>
    </main>
  );
}
