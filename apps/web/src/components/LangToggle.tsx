import { useState } from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../store/i18n.tsx';

/**
 * One tap switches Thai ⇄ English (no picker). The badge always shows the
 * active language; on each switch the ring pulses, the glyph turns in and the
 * new code drops into the badge. The label names the language you'd switch to.
 */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const [turn, setTurn] = useState(0);
  const next = lang === 'th' ? 'en' : 'th';
  return (
    <button
      type="button"
      className={`lang-toggle ${className}`}
      onClick={() => {
        setLang(next);
        setTurn((n) => n + 1);
      }}
      aria-label={next === 'en' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
      lang={next}
      data-turn={turn}
      data-testid="lang-toggle"
    >
      {/* Keyed by turn so each switch replays the motion. */}
      <span key={`p${turn}`} className="lang-toggle-pulse" aria-hidden="true" />
      <Languages key={`i${turn}`} size={22} aria-hidden="true" className="lang-toggle-ic" />
      <span key={lang} className="lang-toggle-badge" aria-hidden="true">
        {lang === 'th' ? 'TH' : 'EN'}
      </span>
    </button>
  );
}
