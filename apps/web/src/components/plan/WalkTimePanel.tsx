import { Moon, Sun } from 'lucide-react';
import { activeCity } from '@walkwe/config';
import { localInputValue, type NightFactor, type WalkMode } from '@walkwe/core';
import { useI18n } from '../../store/i18n.tsx';

export type Departure = { kind: 'now' } | { kind: 'at'; local: string };

interface Props {
  departure: Departure;
  onDeparture: (d: Departure) => void;
  /** Mode picked from the time (sunrise–sunset). */
  autoMode: WalkMode;
  override: WalkMode | null;
  onOverride: (m: WalkMode | null) => void;
  factors: NightFactor[];
  onFactors: (f: NightFactor[]) => void;
  onFind: () => void;
}

const FACTORS: NightFactor[] = ['crowded', 'cctv', 'lit'];

/** Walk time (now / scheduled) → day/night mode, overridable. Brief §5.6. */
export function WalkTimePanel({ departure, onDeparture, autoMode, override, onOverride, factors, onFactors, onFind }: Props) {
  const { t } = useI18n();
  const mode = override ?? autoMode;
  const now = new Date();
  const min = localInputValue(now, activeCity.timezone);
  const max = localInputValue(new Date(now.getTime() + 14 * 86_400_000), activeCity.timezone);

  return (
    <section className="walk-time" aria-labelledby="walk-time-title">
      <h3 className="section-label" id="walk-time-title">
        {t('time.title')}
      </h3>
      <div className="seg seg--full" role="group" aria-labelledby="walk-time-title">
        <button type="button" aria-pressed={departure.kind === 'now'} onClick={() => onDeparture({ kind: 'now' })}>
          {t('time.now')}
        </button>
        <button
          type="button"
          aria-pressed={departure.kind === 'at'}
          onClick={() => departure.kind === 'now' && onDeparture({ kind: 'at', local: localInputValue(new Date(now.getTime() + 3_600_000), activeCity.timezone) })}
        >
          {t('time.later')}
        </button>
      </div>
      {departure.kind === 'at' && (
        <label className="field">
          <span className="small">{t('time.label')}</span>
          <input
            type="datetime-local"
            value={departure.local}
            min={min}
            max={max}
            onChange={(e) => e.target.value && onDeparture({ kind: 'at', local: e.target.value })}
            data-testid="walk-time-input"
          />
        </label>
      )}
      <div className="setting-row" style={{ marginTop: 12 }}>
        <span className="h3" id="mode-label">
          {t('time.mode')}
          <span className="small" style={{ display: 'block', fontWeight: 400 }}>
            {override ? t('time.overridden') : t('time.auto')}
          </span>
        </span>
        <div className="seg" role="group" aria-labelledby="mode-label">
          {(['day', 'night'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => onOverride(m === autoMode ? null : m)}
              data-testid={`mode-${m}`}
            >
              {m === 'day' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
              <span style={{ marginInlineStart: 6 }}>{t(m === 'day' ? 'theme.day' : 'theme.night')}</span>
            </button>
          ))}
        </div>
      </div>
      {mode === 'night' && (
        <fieldset className="factors">
          <legend className="h3">{t('night.factors')}</legend>
          {FACTORS.map((f) => {
            const on = factors.includes(f);
            const last = on && factors.length === 1;
            return (
              <label key={f} className="check">
                <input
                  type="checkbox"
                  checked={on}
                  // Keep at least one factor: with none, "safer" would mean nothing.
                  aria-disabled={last}
                  onChange={() => {
                    if (last) return;
                    onFactors(on ? factors.filter((x) => x !== f) : [...factors, f]);
                  }}
                  data-testid={`factor-${f}`}
                />
                <span>{t(`night.${f}`)}</span>
              </label>
            );
          })}
          {factors.length === 1 && <p className="small">{t('night.keepOne')}</p>}
        </fieldset>
      )}
      <button type="button" className="btn btn--primary" style={{ marginTop: 16 }} onClick={onFind} data-testid="find-routes">
        {t('plan.findRoutes')}
      </button>
    </section>
  );
}
