import { forwardRef, useEffect } from 'react';
import { ArrowLeft, Clock, LocateFixed, MapPin, MapPinned, Mic, Search, X } from 'lucide-react';
import type { Place } from '@walkwe/core';
import type { RecentPlace, SavedPlace } from '@walkwe/data';
import { useI18n } from '../../store/i18n.tsx';
import { useSpeech } from '../../utils/useSpeech.ts';
import { SkeletonRows } from '../ui.tsx';
import { SLOT_ICON } from './SavedSlots.tsx';
import type { SearchState } from './usePlaceSearch.ts';

interface HeaderProps {
  title: string;
  query: string;
  onQuery: (q: string) => void;
  onBack: () => void;
  onFocus: () => void;
  /** Start listening straight away (the user tapped the mic on the planner). */
  autoListen?: boolean;
}

/** Picker header: back, title and the search box (top of the sheet, so the keyboard never covers it). */
export const PickerHeader = forwardRef<HTMLInputElement, HeaderProps>(function PickerHeader(
  { title, query, onQuery, onBack, onFocus, autoListen = false },
  inputRef,
) {
  const { t, lang } = useI18n();
  // Say the place instead of typing it: the words land in the search box and the search runs as usual.
  const speech = useSpeech(lang, (text) => onQuery(text));
  useEffect(() => {
    if (autoListen) speech.start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="icon-btn" style={{ border: 0 }} onClick={onBack} aria-label={t('common.back')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <h2 className="h2">{title}</h2>
      </div>
      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onFocus={onFocus}
          placeholder={speech.listening ? t('plan.listening') : t('plan.searchPlaceholder')}
          aria-label={t('plan.searchLabel')}
        />
        {speech.supported && (
          <button
            type="button"
            className={`icon-btn search-mic${speech.listening ? ' is-on' : ''}`}
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            aria-pressed={speech.listening}
            aria-label={t('plan.voice')}
            data-testid="search-mic"
          >
            <Mic size={20} aria-hidden="true" />
          </button>
        )}
        {query && !speech.listening && (
          <button type="button" className="icon-btn" onClick={() => onQuery('')} aria-label={t('common.close')}>
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </form>
      {speech.error && (
        <p className="small route-warn" role="alert">
          {speech.error === 'not-allowed' || speech.error === 'service-not-allowed' ? t('plan.voiceBlocked') : t('plan.voiceFailed')}
        </p>
      )}
    </div>
  );
});

interface BodyProps {
  query: string;
  search: SearchState;
  allowCurrent: boolean;
  locating: boolean;
  saved: SavedPlace[];
  recents: RecentPlace[];
  onCurrent: () => void;
  onPinMode: () => void;
  onPick: (place: Place, kind: 'search' | 'saved' | 'recent') => void;
}

export function PickerBody({ query, search, allowCurrent, locating, saved, recents, onCurrent, onPinMode, onPick }: BodyProps) {
  const { t } = useI18n();
  const row = (key: string, icon: React.ReactNode, title: string, detail: string, onClick: () => void, testId?: string, primary = false) => (
    <li key={key}>
      <button type="button" className="row" onClick={onClick} data-testid={testId}>
        <span className={`row-ic${primary ? ' row-ic--primary' : ''}`} aria-hidden="true">
          {icon}
        </span>
        <span className="row-text">
          <span className="row-title">{title}</span>
          {detail && <span className="row-detail">{detail}</span>}
        </span>
      </button>
    </li>
  );

  return (
    <div style={{ display: 'grid', gap: 4, paddingTop: 4 }}>
      <ul className="list">
        {allowCurrent &&
          row(
            'current',
            <LocateFixed size={20} />,
            locating ? t('geo.locating') : t('plan.useCurrent'),
            '',
            onCurrent,
            'use-current',
            true,
          )}
        {row('pin', <MapPinned size={20} />, t('plan.chooseOnMap'), '', onPinMode, 'choose-on-map')}
      </ul>

      {search.status === 'loading' && (
        <>
          <h3 className="section-label">{t('plan.results')}</h3>
          <SkeletonRows label={t('plan.searching')} />
        </>
      )}
      {search.status === 'error' && <p className="notice" role="alert">{t('plan.searchError')}</p>}
      {search.status === 'done' &&
        (search.results.length ? (
          <section aria-label={t('plan.results')}>
            <h3 className="section-label">{t('plan.results')}</h3>
            <ul className="list" data-testid="search-results">
              {search.results.map((p) => row(p.id, <MapPin size={20} />, p.name, p.detail, () => onPick(p, 'search')))}
            </ul>
            {search.more && <SkeletonRows count={1} label={t('plan.searching')} />}
          </section>
        ) : (
          <p className="small" role="status" style={{ padding: '12px 4px' }}>
            {t('plan.searchEmpty', { q: query.trim() })}
          </p>
        ))}

      {search.status === 'idle' && (
        <>
          {saved.length > 0 && (
            <section aria-label={t('plan.saved')}>
              <h3 className="section-label">{t('plan.saved')}</h3>
              <ul className="list">
                {saved.map((p) => {
                  const Icon = SLOT_ICON[p.slot];
                  const title = p.slot === 'other' ? p.name : t(`slot.${p.slot}`);
                  return row(`${p.slot}:${p.id}`, <Icon size={20} />, title, p.slot === 'other' ? p.detail : p.name, () => onPick(p, 'saved'));
                })}
              </ul>
            </section>
          )}
          {recents.length > 0 && (
            <section aria-label={t('plan.recent')}>
              <h3 className="section-label">{t('plan.recent')}</h3>
              <ul className="list">
                {recents.map((p) => row(p.id, <Clock size={20} />, p.name, p.detail, () => onPick(p, 'recent')))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
