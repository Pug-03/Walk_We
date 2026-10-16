import { Accessibility, AlertTriangle, ArrowLeft, Cloud, Info, Store } from 'lucide-react';
import { useAccess } from '../../store/access.ts';
import { TLink as Link } from '../TLink.tsx';
import type { Route, RouteKind, RouteResult, WalkMode } from '@walkwe/core';
import type { StringKey } from '../../i18n.ts';
import type { DatasetMeta } from '../../routing/protocol.ts';
import { useI18n } from '../../store/i18n.tsx';
import { formatDistance } from '../../utils/format.ts';
import { RouteWhy } from './RouteWhy.tsx';

export type RoutingState =
  | { status: 'loading' }
  | { status: 'error'; reason: 'outside-coverage' | 'no-path' | 'too-far' | 'too-far-step-free' | 'failed' }
  | { status: 'done'; result: RouteResult; mode: WalkMode; cloud: number | null };

const pct = (x: number) => Math.round(x * 100);

export function ResultsHeader({ onBack, mode }: { onBack: () => void; mode: WalkMode }) {
  const { t } = useI18n();
  const legend = t(mode === 'night' ? 'results.legendNight' : 'results.legend');
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="icon-btn results-back" onClick={onBack} aria-label={t('common.back')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <h2 className="h2">{t('results.title')}</h2>
      </div>
      <p className="legend small" aria-label={legend}>
        <span className="legend-line legend-line--shade" aria-hidden="true" />
        <span className="legend-line legend-line--sun" aria-hidden="true" />
        <span>{legend}</span>
      </p>
    </div>
  );
}

interface Props {
  state: RoutingState;
  selected: number;
  onSelect: (i: number) => void;
  onRetry: () => void;
  onStart: () => void;
  /** Error states offer a way out: pick another destination. */
  onChangeTo: () => void;
  /** Mode being computed, for the loading line. */
  loadingMode: WalkMode;
  meta: DatasetMeta | null;
}

export function RouteResults({ state, selected, onSelect, onRetry, onStart, onChangeTo, meta, loadingMode }: Props) {
  const { t, lang } = useI18n();
  const { stepFree } = useAccess();

  if (state.status === 'loading') {
    return (
      <div role="status" aria-label={t(loadingMode === 'night' ? 'results.computingNight' : 'results.computing')} style={{ display: 'grid', gap: 10, paddingTop: 4 }}>
        <p className="small">{t(loadingMode === 'night' ? 'results.computingNight' : 'results.computing')}</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-row" style={{ height: 104 }} />
        ))}
      </div>
    );
  }
  if (state.status === 'error') {
    const key: StringKey =
      state.reason === 'outside-coverage' ? 'results.outside' : state.reason === 'no-path' ? 'results.noPath' : state.reason === 'too-far' ? 'results.tooFar' : state.reason === 'too-far-step-free' ? 'results.tooFarStepFree' : 'results.failed';
    return (
      <div className="notice" role="alert" style={{ marginTop: 4 }}>
        <AlertTriangle size={20} aria-hidden="true" />
        <div style={{ display: 'grid', gap: 8 }}>
          <span>{t(key)}</span>
          {state.reason === 'failed' ? (
            <button type="button" className="btn btn--ghost" onClick={onRetry}>
              {t('common.retry')}
            </button>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={onChangeTo} data-testid="change-to">
              {t('results.changeDest')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const { result, mode, cloud } = state;
  const shortest = result.routes.find((r) => r.kinds.includes('shortest')) ?? result.routes[0]!;
  const kindLabel = (k: RouteKind) => t(`results.kind.${k}` as StringKey);

  const night = mode === 'night';
  const card = (r: Route, i: number) => {
    const isBase = r === shortest;
    const label = r.kinds.map(kindLabel).join(' · ');
    const rel: string[] = [];
    if (!isBase) {
      if (night) {
        const more = Math.round(((r.safetyScore ?? 0) - (shortest.safetyScore ?? 0)) * 10) / 10;
        if (more > 0) rel.push(t('results.moreSafety', { s: more }));
      } else {
        const more = pct(r.shadeShare) - pct(shortest.shadeShare);
        if (more > 0) rel.push(t('results.moreShade', { p: more }));
      }
      const longer = r.lengthM - shortest.lengthM;
      if (longer >= 10) rel.push(t('results.longer', { d: formatDistance(longer, lang) }));
    }
    const score = night ? t('results.safety', { s: (r.safetyScore ?? 0).toFixed(1) }) : t('results.shade', { p: pct(r.shadeShare) });
    return (
      <li key={i}>
        <button
          type="button"
          className="route-option"
          aria-pressed={i === selected}
          onClick={() => onSelect(i)}
          aria-label={`${t('results.select', { kind: label })}: ${t('results.minutes', { n: Math.max(1, Math.round(r.durationS / 60)) })}, ${formatDistance(r.lengthM, lang)}, ${score}`}
          data-testid={`route-${r.kinds[0]}`}
        >
          <span className="route-kind">{label}</span>
          <span className="route-main">
            <span className="route-time">{t('results.minutes', { n: Math.max(1, Math.round(r.durationS / 60)) })}</span>
            <span className="route-dist">{formatDistance(r.lengthM, lang)}</span>
            <span className="route-shade">{score}</span>
          </span>
          {/* Shade (day) or safety (night) as a bar, so routes compare at a glance. */}
          <span className="route-meter" aria-hidden="true">
            <span style={{ width: `${night ? ((r.safetyScore ?? 0) / 10) * 100 : pct(r.shadeShare)}%` }} className={night ? 'is-night' : ''} />
          </span>
          <span className="small">{isBase ? t('results.baseline') : rel.join(' · ')}</span>
          {/* Step-free mode: say plainly whether this way has stairs (from map data). */}
          {stepFree && (
            <span className={`route-access${r.stairsM > 0 ? ' has-stairs' : ''}`}>
              <Accessibility size={15} aria-hidden="true" />
              {r.stairsM > 0 ? t('results.stairs', { m: Math.max(1, Math.round(r.stairsM)) }) : t('results.stepFree')}
            </span>
          )}
          {r.incidentsOnRoute > 0 ? (
            <span className="small route-warn">{t('results.incidentsOnRoute', { n: r.incidentsOnRoute })}</span>
          ) : (
            !isBase && shortest.incidentsOnRoute > 0 && <span className="small">{t('results.incidentsAvoided')}</span>
          )}
          {!night && r.estimatedShadeShare >= 0.2 && <span className="small">{t('results.estimated', { p: pct(r.estimatedShadeShare) })}</span>}
          {night && r.litKnownShare != null && r.litKnownShare < 0.8 && (
            <span className="small">{t('results.litEstimated', { p: pct(1 - r.litKnownShare) })}</span>
          )}
          {r.mallsUsed.length > 0 && <span className="small">{t('results.throughMall', { names: r.mallsUsed.join(', ') })}</span>}
        </button>
      </li>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 10, paddingTop: 4 }}>
      <ul className="list route-list">{result.routes.map(card)}</ul>
      {result.routes[selected] && <RouteWhy route={result.routes[selected]!} shortest={shortest} mode={mode} />}
      {/* Pinned to the sheet's foot on phones: the main action never hides below the fold. */}
      <div className="start-dock">
        <button type="button" className="btn btn--primary" onClick={onStart} data-testid="start-nav">
          {t('nav.start')}
        </button>
      </div>
      {night && (
        <p className="notice">
          <Info size={20} aria-hidden="true" />
          <span>{t('results.nightDisclaimer')}</span>
        </p>
      )}
      {import.meta.env.DEV && meta && meta.incidents.placeholders > 0 && (
        <p className="dev-note">{t('results.placeholderIncidents', { n: meta.incidents.placeholders })}</p>
      )}
      {mode === 'day' && result.routes.length === 1 && <p className="small">{t('results.onlyOne')}</p>}
      {result.closedMalls.length > 0 && (
        <p className="small route-note">
          <Store size={18} aria-hidden="true" />
          {t('results.closedMalls', { n: result.closedMalls.length })}
        </p>
      )}
      {mode === 'day' && cloud != null && cloud >= 30 && (
        <p className="small route-note">
          <Cloud size={18} aria-hidden="true" />
          {t('results.cloud', { p: Math.round(cloud) })}
        </p>
      )}
      {meta && (
        <footer className="data-note small">
          <Link to="/data" className="data-link" data-testid="data-link">
            {t('data.link')}
          </Link>
          <span>{t('results.heightNote', { p: pct(meta.estimatedHeightShare) })}</span>
          <span>
            {t('results.dataSource', {
              sources: meta.sources.map((s) => `© ${s.name} (${s.license})`).join(', '),
              date: new Date(meta.osmUpdatedAt).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            })}
          </span>
        </footer>
      )}
    </div>
  );
}
