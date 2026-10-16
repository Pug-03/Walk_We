import { useEffect, useState } from 'react';
import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { activeCity } from '@walkwe/config';
import type { LatLng } from '@walkwe/core';
import { lineShareUrl, shareMessage } from '../../sos/message.ts';
import { platform } from '../../services.ts';
import { useI18n } from '../../store/i18n.tsx';
import { Dialog, useToast } from '../ui.tsx';

interface Props {
  destination: { name: string; location: LatLng } | null;
  etaMin: number | null;
  /** Last known position, if any; otherwise one is requested. */
  known: LatLng | null;
  onClose: () => void;
}

/** Share location + destination + ETA, LINE first (brief §8). One-off, honest about it. */
export function ShareLocation({ destination, etaMin, known, onClose }: Props) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [loc, setLoc] = useState<LatLng | null>(known);
  useEffect(() => {
    if (known) return;
    let live = true;
    platform.currentPosition({ highAccuracy: true, timeoutMs: 8000 }).then((f) => live && setLoc({ lat: f.lat, lng: f.lng }), () => {});
    return () => {
      live = false;
    };
  }, [known]);
  const text = shareMessage({ lang, at: new Date(), timeZone: activeCity.timezone, location: loc, destination, etaMin });
  return (
    <Dialog
      title={t('share.title')}
      icon={<MessageCircle size={28} aria-hidden="true" />}
      onClose={onClose}
      actions={
        <>
          <a className="btn btn--primary" href={lineShareUrl(text)} target="_blank" rel="noreferrer" data-testid="share-line">
            <MessageCircle size={22} aria-hidden="true" />
            {t('share.line')}
          </a>
          {typeof navigator.share === 'function' && (
            <button type="button" className="btn" onClick={() => void platform.share({ text })}>
              <Share2 size={22} aria-hidden="true" />
              {t('share.other')}
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigator.clipboard?.writeText(text).then(() => toast(t('share.copied')), () => {})}
          >
            <Copy size={20} aria-hidden="true" />
            {t('share.copy')}
          </button>
          <button type="button" className="btn btn--text" style={{ justifySelf: 'center' }} onClick={onClose}>
            {t('common.close')}
          </button>
        </>
      }
    >
      <p className="sub">{t('share.body')}</p>
      <p className="small">{t('share.honest')}</p>
    </Dialog>
  );
}
