import { ArrowUpDown } from 'lucide-react';
import { useI18n } from '../../store/i18n.tsx';
import type { Field, PickedPlace } from '../../store/plan.ts';
import { coordText } from '../../utils/format.ts';

interface Props {
  from: PickedPlace | null;
  to: PickedPlace | null;
  onEdit: (field: Field) => void;
  onSwap: () => void;
}

/** The "From / To" card: always visible at the sheet's peek height. */
export function RouteCard({ from, to, onEdit, onSwap }: Props) {
  const { t } = useI18n();
  const row = (field: Field, p: PickedPlace | null) => {
    const label = t(field === 'from' ? 'plan.from' : 'plan.to');
    const empty = t(field === 'from' ? 'plan.fromEmpty' : 'plan.toEmpty');
    return (
      <button
        type="button"
        className="point-btn"
        onClick={() => onEdit(field)}
        data-testid={`point-${field}`}
        data-coords={p ? coordText(p.location) : ''}
        aria-label={`${label}: ${p?.name ?? empty}. ${t('plan.edit', { what: label })}`}
      >
        <span className={`point-dot${field === 'to' ? ' point-dot--to' : ''}`} aria-hidden="true" />
        <span className="point-text">
          <span className="point-label">{label}</span>
          <span className="point-value" data-empty={!p}>
            {p?.name ?? empty}
          </span>
        </span>
      </button>
    );
  };
  return (
    <div className="route-card">
      <div className="route-points">
        {row('from', from)}
        {row('to', to)}
      </div>
      <button type="button" className="icon-btn" onClick={onSwap} aria-label={t('plan.swap')} disabled={!from && !to}>
        <ArrowUpDown size={22} aria-hidden="true" />
      </button>
    </div>
  );
}
