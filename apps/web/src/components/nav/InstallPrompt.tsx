import { useState } from 'react';
import { Share, SquarePlus } from 'lucide-react';
import { installOffer, markInstallPrompted, runNativeInstall } from '../../pwa/install.ts';
import { useI18n } from '../../store/i18n.tsx';

/** Shown once, after the first completed route (brief §5.9). */
export function InstallPrompt() {
  const { t } = useI18n();
  const [kind] = useState(installOffer);
  const [open, setOpen] = useState(kind !== null);
  if (!open || !kind) return null;
  const close = () => {
    markInstallPrompted();
    setOpen(false);
  };
  return (
    <section className="install-card fade-in" aria-labelledby="install-title" data-testid="install-prompt">
      <h3 className="h3" id="install-title">
        {t('install.title')}
      </h3>
      <p className="small">{t('install.body')}</p>
      {kind === 'ios' ? (
        <ol className="install-steps">
          <li>
            <Share size={22} aria-hidden="true" />
            {t('install.ios1')}
          </li>
          <li>
            <SquarePlus size={22} aria-hidden="true" />
            {t('install.ios2')}
          </li>
          <li>
            <span className="install-add" aria-hidden="true">
              {t('install.add')}
            </span>
            {t('install.ios3')}
          </li>
        </ol>
      ) : (
        <button
          type="button"
          className="btn btn--primary"
          onClick={async () => {
            await runNativeInstall();
            close();
          }}
        >
          {t('install.cta')}
        </button>
      )}
      <button type="button" className="btn btn--text" style={{ justifySelf: 'center' }} onClick={close}>
        {t('install.later')}
      </button>
    </section>
  );
}
