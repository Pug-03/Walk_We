import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, MessageCircle, MessageSquareText, Phone, Share2, UserPlus, X } from 'lucide-react';
import { activeCity } from '@walkwe/config';
import type { LatLng } from '@walkwe/core';
import { createSosController, type SosState } from '../../sos/controller.ts';
import { lineShareUrl, smsUrl, sosMessage } from '../../sos/message.ts';
import { isIOS } from '../../pwa/install.ts';
import { platform } from '../../services.ts';
import { loadContacts, loadSelfPhone } from '../../store/contacts.ts';
import { getAccess } from '../../store/access.ts';
import { speak, stopSpeaking } from '../../utils/speak.ts';
import { useI18n } from '../../store/i18n.tsx';
import { useToast } from '../ui.tsx';

const HOLD_MS = 1000;
/** SOS lives on the screens used while out walking (product decision, 15 Oct 2026). */
export const SOS_SCREENS = ['/plan', '/navigate'];
const COUNTDOWN_S = 5;

/**
 * SOS, top-right on the planning and navigation screens: press and hold 1 s (progress
 * ring) → full-screen 5 s countdown with a large Cancel, vibrating each
 * second → a screen of one-tap ways to send your location (browsers can't
 * send on their own) plus quick-dial numbers from the city config.
 */
export function SosButton() {
  const { pathname } = useLocation();
  if (!SOS_SCREENS.includes(pathname)) return null;
  return <SosButtonInner />;
}

function SosButtonInner() {
  const { t, lang } = useI18n();
  const langRef = useRef(lang);
  langRef.current = lang;
  const toast = useToast();
  const [state, setState] = useState<SosState>('idle');
  const [hold, setHold] = useState(0);
  const [left, setLeft] = useState(COUNTDOWN_S);
  const [fix, setFix] = useState<{ p: LatLng; accuracy: number } | null | 'pending'>(null);
  const locating = useRef<Promise<void> | null>(null);

  const ctl = useMemo(
    () =>
      createSosController({
        holdMs: HOLD_MS,
        countdownS: COUNTDOWN_S,
        onState: setState,
        onHold: setHold,
        onTick: (n) => {
          setLeft(n);
          platform.vibrate(200);
          // Read aloud: the count itself, so it's clear without looking.
          if (getAccess().voice) void speak(String(n), langRef.current, { local: true });
        },
        onSend: () => platform.vibrate([400, 100, 400]),
      }),
    [],
  );
  useEffect(() => () => ctl.reset(), [ctl]);

  // Start finding the location as soon as the hold begins, so it's ready
  // by the time the countdown ends.
  const locate = () => {
    if (locating.current) return;
    setFix('pending');
    locating.current = platform
      .currentPosition({ highAccuracy: true, timeoutMs: 10_000 })
      .then((f) => setFix({ p: { lat: f.lat, lng: f.lng }, accuracy: f.accuracy }))
      .catch(() => setFix(null))
      .finally(() => (locating.current = null));
  };

  const press = () => {
    locate();
    ctl.press();
  };
  const fabRef = useRef<HTMLButtonElement>(null);
  const sendRef = useRef<HTMLDivElement>(null);
  /** Back to idle, focus returned to the SOS button (it was hidden meanwhile). */
  const close = () => {
    ctl.reset();
    requestAnimationFrame(() => fabRef.current?.focus());
  };
  const cancel = () => {
    stopSpeaking();
    ctl.cancel();
    toast(t('sos.cancelled'));
    close();
  };
  // Keyboard: Escape cancels the countdown / closes the send screen; on the
  // send screen focus moves in and Tab stays inside it.
  useEffect(() => {
    if (state !== 'countdown' && state !== 'sent') return undefined;
    if (state === 'sent') requestAnimationFrame(() => sendRef.current?.querySelector<HTMLElement>('a, button')?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return state === 'countdown' ? cancel() : close();
      if (e.key !== 'Tab' || state !== 'sent' || !sendRef.current) return;
      const items = sendRef.current.querySelectorAll<HTMLElement>('a, button');
      const a = items[0], z = items[items.length - 1];
      if (!a || !z) return;
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ring: two half-masks rotated with transform only (brief §3 motion rule).
  const right = Math.min(hold, 0.5) * 360;
  const leftHalf = Math.max(0, hold - 0.5) * 360;

  const message = () =>
    sosMessage({
      lang,
      at: new Date(),
      timeZone: activeCity.timezone,
      location: fix && fix !== 'pending' ? fix.p : null,
      accuracyM: fix && fix !== 'pending' ? fix.accuracy : null,
      selfPhone: loadSelfPhone(),
    });
  const contacts = state === 'sent' ? loadContacts() : [];

  return (
    <>
      <button
        type="button"
        ref={fabRef}
        className="sos-fab"
        aria-label={t('sos.label')}
        data-testid="sos"
        data-state={state}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          press();
        }}
        onPointerUp={() => ctl.release()}
        onPointerCancel={() => ctl.release()}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            press();
          }
        }}
        onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && ctl.release()}
        hidden={state === 'countdown' || state === 'sent'}
      >
        <span className="sos-ring" aria-hidden="true">
          <span className="sos-half sos-half--right">
            <span className="sos-fill" style={{ transform: `rotate(${right}deg)` }} />
          </span>
          <span className="sos-half sos-half--left">
            <span className="sos-fill" style={{ transform: `rotate(${leftHalf}deg)` }} />
          </span>
        </span>
        <span className="sos-face">SOS</span>
      </button>
      {state === 'holding' && hold > 0.05 && (
        <span className="sos-hint" role="status">
          {t('sos.hold')}
        </span>
      )}

      {state === 'countdown' &&
        createPortal(
          <div className="sos-overlay sos-overlay--count" role="alertdialog" aria-modal="true" aria-labelledby="sos-count-title" data-testid="sos-countdown">
            <p className="sos-count-title" id="sos-count-title">
              {t('sos.countdownTitle')}
            </p>
            <div className="sos-dial-ring">
              {/* Sonar rings, one per second, restarted by the key. */}
              <span key={`pulse-${left}`} className="sos-pulse" aria-hidden="true">
                <i />
                <i />
              </span>
              {/* Drains over the whole countdown (one animation, started with the overlay). */}
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="92" className="sos-ring-track" />
                <circle cx="100" cy="100" r="92" className="sos-ring-left" pathLength={1} style={{ animationDuration: `${COUNTDOWN_S}s` }} />
              </svg>
              <p className="sos-count" aria-live="assertive">
                <span key={left} className="sos-count-n">
                  {left}
                </span>
                <span className="sr-only">{t('sos.seconds', { n: left })}</span>
              </p>
            </div>
            <p className="sos-fix">
              <MapPin size={18} aria-hidden="true" />
              {fix === 'pending' ? t('sos.locating') : fix ? t('sos.located', { m: Math.max(5, Math.round(fix.accuracy)) }) : t('sos.noLocationShort')}
            </p>
            <button type="button" className="btn sos-cancel" onClick={cancel} autoFocus data-testid="sos-cancel">
              <X size={26} aria-hidden="true" />
              {t('sos.cancel')}
            </button>
          </div>,
          document.body,
        )}

      {state === 'sent' &&
        createPortal(
          <div ref={sendRef} className="sos-overlay sos-overlay--send" role="dialog" aria-modal="true" aria-labelledby="sos-send-title" data-testid="sos-send">
            <header className="sos-send-head">
            <span className="sos-send-mark" aria-hidden="true">
              <i />
              <i />
              <MapPin size={34} />
            </span>
            <h2 className="h2 sos-send-title" id="sos-send-title">
              {t('sos.readyTitle')}
            </h2>
            <p className="small sos-note">{t('sos.readyNote')}</p>
            <p className={`sos-fix sos-fix--chip${fix && fix !== 'pending' ? ' is-found' : ''}`}>
              <MapPin size={16} aria-hidden="true" />
              {fix === 'pending' ? t('sos.locating') : fix ? t('sos.located', { m: Math.max(5, Math.round(fix.accuracy)) }) : t('sos.noLocation')}
            </p>
            </header>
            <div className="sos-actions">
              {contacts.length > 0 ? (
                <a className="btn sos-action" href={smsUrl(contacts.map((c) => c.phone), message(), isIOS())} data-testid="sos-sms">
                  <span className="sos-action-ic" aria-hidden="true">
                    <MessageSquareText size={22} />
                  </span>
                  {t('sos.sms', { n: contacts.length })}
                </a>
              ) : (
                <Link className="btn sos-action" to="/contacts" onClick={() => ctl.reset()}>
                  <span className="sos-action-ic" aria-hidden="true">
                    <UserPlus size={22} />
                  </span>
                  {t('sos.addContacts')}
                </Link>
              )}
              <a className="btn sos-action" href={lineShareUrl(message())} target="_blank" rel="noreferrer" data-testid="sos-line">
                <span className="sos-action-ic" aria-hidden="true">
                  <MessageCircle size={22} />
                </span>
                {t('sos.line')}
              </a>
              {typeof navigator.share === 'function' && (
                <button type="button" className="btn sos-action" onClick={() => void platform.share({ text: message() })}>
                  <span className="sos-action-ic" aria-hidden="true">
                    <Share2 size={22} />
                  </span>
                  {t('sos.share')}
                </button>
              )}
            </div>
            <section className="sos-call" aria-labelledby="sos-call-title">
            <h3 className="sos-call-title" id="sos-call-title">
              {t('sos.call')}
            </h3>
            <div className="sos-dial">
              {activeCity.emergencyNumbers.map((n) => (
                <a key={n.id} className="btn sos-dial-btn" href={`tel:${n.number}`} data-testid={`dial-${n.number}`}>
                  <span className="sos-dial-ic" aria-hidden="true">
                    <Phone size={18} />
                  </span>
                  <strong>{n.number}</strong>
                  <span>{n.label[lang]}</span>
                </a>
              ))}
            </div>
            </section>
            <button type="button" className="btn btn--ghost sos-close" onClick={close}>
              <X size={20} aria-hidden="true" />
              {t('sos.close')}
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
