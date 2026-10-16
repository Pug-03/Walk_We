import { Accessibility, Type, Vibrate, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StringKey } from '../i18n.ts';
import { setAccess, useAccess, type AccessPrefs } from '../store/access.ts';
import { useI18n } from '../store/i18n.tsx';
import { speak } from '../utils/speak.ts';

const ROWS: Array<{ key: keyof AccessPrefs; Icon: LucideIcon }> = [
  { key: 'stepFree', Icon: Accessibility },
  { key: 'voice', Icon: Volume2 },
  { key: 'bigText', Icon: Type },
  { key: 'haptics', Icon: Vibrate },
];

/** Accessibility switches: each is a real switch (role="switch") with its own label and hint. */
export function AccessPanel() {
  const { t, lang } = useI18n();
  const prefs = useAccess();
  return (
    <ul className="access-list" data-testid="access-panel">
      {ROWS.map(({ key, Icon }) => {
        const on = prefs[key];
        return (
          <li key={key}>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              className={`access-row${on ? ' is-on' : ''}`}
              data-testid={`access-${key}`}
              onClick={() => {
                setAccess({ [key]: !on });
                // Turning the voice on says so, out loud: proof it works on this phone.
                if (key === 'voice' && !on) void speak(t('access.voice.hello'), lang);
                if (key === 'haptics' && !on) navigator.vibrate?.(40);
              }}
            >
              <span className="access-ic" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span className="access-text">
                <span className="access-title">{t(`access.${key}.title` as StringKey)}</span>
                <span className="access-hint">{t(`access.${key}.hint` as StringKey)}</span>
              </span>
              <span className="access-switch" aria-hidden="true">
                <span />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
