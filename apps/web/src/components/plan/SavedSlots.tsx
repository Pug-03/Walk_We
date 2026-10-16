import { Briefcase, Home, MapPin, TrainFront, X } from 'lucide-react';
import type { SavedPlace, SavedSlot } from '@walkwe/data';
import { useI18n } from '../../store/i18n.tsx';

export const SLOT_ICON = { home: Home, work: Briefcase, station: TrainFront, other: MapPin } as const;
const FIXED: Exclude<SavedSlot, 'other'>[] = ['home', 'work', 'station'];

interface Props {
  saved: SavedPlace[];
  onGo: (place: SavedPlace) => void;
  onSet: (slot: SavedSlot) => void;
  onRemove: (place: SavedPlace) => void;
}

/** Home / Work / Station chips (one tap to route) + other saved places. */
export function SavedSlots({ saved, onGo, onSet, onRemove }: Props) {
  const { t } = useI18n();
  const others = saved.filter((p) => p.slot === 'other');
  return (
    <section aria-label={t('plan.saved')}>
      <h3 className="section-label">{t('plan.saved')}</h3>
      <div className="slots">
        {FIXED.map((slot) => {
          const Icon = SLOT_ICON[slot];
          const place = saved.find((p) => p.slot === slot);
          const slotName = t(`slot.${slot}`);
          return place ? (
            <button
              key={slot}
              type="button"
              className="slot"
              onClick={() => onGo(place)}
              aria-label={`${t('slot.goTo', { slot: slotName })}: ${place.name}`}
              data-testid={`slot-${slot}`}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="slot-name">{slotName}</span>
            </button>
          ) : (
            <button
              key={slot}
              type="button"
              className="slot"
              data-empty="true"
              onClick={() => onSet(slot)}
              data-testid={`slot-${slot}`}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="slot-name">{t('slot.set', { slot: slotName })}</span>
            </button>
          );
        })}
      </div>
      {saved.length > 0 && (
        <ul className="list" style={{ marginTop: 8 }}>
          {[...saved.filter((p) => p.slot !== 'other'), ...others].map((p) => {
            const Icon = SLOT_ICON[p.slot];
            return (
              <li key={`${p.slot}:${p.id}`} className="row-wrap">
                <button type="button" className="row" onClick={() => onGo(p)}>
                  <span className="row-ic" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="row-text">
                    <span className="row-title">{p.slot === 'other' ? p.name : t(`slot.${p.slot}`)}</span>
                    <span className="row-detail">{p.slot === 'other' ? p.detail : p.name}</span>
                  </span>
                </button>
                <button type="button" className="icon-btn" style={{ border: 0 }} onClick={() => onRemove(p)} aria-label={t('slot.remove', { name: p.name })}>
                  <X size={20} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
