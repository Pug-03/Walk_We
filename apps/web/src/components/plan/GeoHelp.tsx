import { LocateOff } from 'lucide-react';
import type { GeoEnvironment } from '../../platform/geoEnv.ts';
import type { StringKey } from '../../i18n.ts';
import { useI18n } from '../../store/i18n.tsx';
import { Dialog } from '../ui.tsx';

export type GeoProblem = 'insecure' | 'in-app' | 'denied' | 'timeout' | 'unsupported';

const APP_NAME = { line: 'LINE', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' } as const;
const STEPS: Record<GeoEnvironment['os'], StringKey[]> = {
  ios: ['geo.help.ios1', 'geo.help.ios2', 'geo.help.ios3'],
  android: ['geo.help.android1', 'geo.help.android2'],
  desktop: ['geo.help.desktop1'],
};

interface Props {
  problem: GeoProblem;
  env: GeoEnvironment;
  onRetry: () => void;
  onInstead: () => void;
}

/** Says why "use current location" didn't work and how to fix it, per device. */
export function GeoHelp({ problem, env, onRetry, onInstead }: Props) {
  const { t } = useI18n();
  const title: StringKey =
    problem === 'insecure' ? 'geo.help.insecureTitle'
      : problem === 'in-app' ? 'geo.help.inAppTitle'
        : problem === 'timeout' ? 'geo.help.timeoutTitle'
          : problem === 'unsupported' ? 'geo.help.unsupportedTitle'
            : 'geo.help.deniedTitle';
  const canRetry = problem === 'denied' || problem === 'timeout';
  return (
    <Dialog
      title={t(title)}
      icon={<LocateOff size={28} aria-hidden="true" />}
      onClose={onInstead}
      actions={
        <>
          {canRetry && (
            <button type="button" className="btn btn--primary" onClick={onRetry} data-testid="geo-retry">
              {t('geo.help.retry')}
            </button>
          )}
          <button type="button" className={canRetry ? 'btn btn--text' : 'btn btn--primary'} style={canRetry ? { justifySelf: 'center' } : undefined} onClick={onInstead}>
            {t('geo.help.instead')}
          </button>
        </>
      }
    >
      <div data-testid={`geo-help-${problem}`} style={{ display: 'grid', gap: 8 }}>
        {problem === 'insecure' && <p className="sub">{t('geo.help.insecureBody', { origin: location.origin })}</p>}
        {problem === 'in-app' && env.inApp && <p className="sub">{t('geo.help.inAppBody', { app: APP_NAME[env.inApp] })}</p>}
        {problem === 'timeout' && <p className="sub">{t('geo.help.timeoutBody')}</p>}
        {problem === 'denied' && (
          <>
            <p className="sub">{t('geo.help.deniedBody')}</p>
            <ol className="help-steps">
              {STEPS[env.os].map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ol>
          </>
        )}
      </div>
    </Dialog>
  );
}
