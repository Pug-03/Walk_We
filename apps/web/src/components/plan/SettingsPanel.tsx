import { TLink as Link } from '../TLink.tsx';
import { useI18n } from '../../store/i18n.tsx';
import { LangToggle } from '../LangToggle.tsx';
import { useTheme, type ThemePref } from '../../store/theme.tsx';
import { loadContacts } from '../../store/contacts.ts';

const PREFS: ThemePref[] = ['auto', 'day', 'night'];

/** Language + theme. Lives in the sheet (thumb zone), not the top bar. */
export function SettingsPanel() {
  const { t, lang } = useI18n();
  const { pref, setPref } = useTheme();
  return (
    <section className="settings" aria-label={`${t('lang.label')} / ${t('theme.label')}`}>
      <div className="setting-row">
        <span className="h3">{t('lang.label')}</span>
        <span className="lang-row">
          <span className="small">{lang === 'th' ? 'ไทย' : 'English'}</span>
          <LangToggle />
        </span>
      </div>
      <div className="setting-row">
        <span className="h3" id="theme-label">
          {t('theme.label')}
        </span>
        <div className="seg" role="group" aria-labelledby="theme-label">
          {PREFS.map((p) => (
            <button key={p} type="button" aria-pressed={pref === p} onClick={() => setPref(p)}>
              {t(`theme.${p}`)}
            </button>
          ))}
        </div>
      </div>
      <Link to="/contacts" className="row" data-testid="settings-contacts-link">
        <span className="row-text">
          <span className="row-title">{t('contacts.link', { n: loadContacts().length })}</span>
        </span>
      </Link>
      <Link to="/data" className="row" data-testid="settings-data-link">
        <span className="row-text">
          <span className="row-title">{t('data.link')}</span>
        </span>
      </Link>
      <Link to="/privacy" className="row" data-testid="settings-privacy-link">
        <span className="row-text">
          <span className="row-title">{t('privacy.link')}</span>
        </span>
      </Link>
    </section>
  );
}
