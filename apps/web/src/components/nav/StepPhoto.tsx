import { useRef, useState } from 'react';
import { Expand, X } from 'lucide-react';
import type { PhotoManifest } from '@walkwe/data';
import { useI18n } from '../../store/i18n.tsx';

const BASE = '/data/routes/photos/generated/';

interface Props {
  photo: string;
  caption: string;
  manifest: PhotoManifest | null;
  /** Adjacent steps load eagerly; the rest wait (brief §4: lazy-load). */
  eager: boolean;
  /** The step on screen: fetch its photo first. */
  priority?: boolean;
  onOpen: () => void;
}

/** Route photo: AVIF/WebP/JPEG srcset over a blurred placeholder; tap for full screen. */
export function StepPhoto({ photo, caption, manifest, eager, priority = false, onOpen }: Props) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  const down = useRef<{ x: number; y: number } | null>(null);
  const m = manifest?.photos[photo];
  const base = photo.replace(/\.jpg$/, '');
  const widths = m?.widths ?? [960];
  const set = (ext: string) => widths.map((w) => `${BASE}${base}-${w}.${ext} ${w}w`).join(', ');
  const largest = widths[widths.length - 1]!;

  return (
    // Not a <button>: a swipe that starts on the photo must move the carousel.
    // Tap opens full screen (ignored if the finger travelled — that was a
    // swipe); the expand button is the keyboard / screen-reader path.
    <div
      className="step-photo"
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onClick={(e) => {
        const d = down.current;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10) onOpen();
      }}
    >
      {m?.blur && <img className="step-photo-blur" src={m.blur} alt="" aria-hidden="true" draggable={false} />}
      <picture>
        <source type="image/avif" srcSet={set('avif')} sizes="(max-width: 560px) 100vw, 560px" />
        <source type="image/webp" srcSet={set('webp')} sizes="(max-width: 560px) 100vw, 560px" />
        <img
          src={`${BASE}${base}-${Math.min(960, largest)}.jpg`}
          srcSet={set('jpg')}
          sizes="(max-width: 560px) 100vw, 560px"
          alt={caption}
          width={m?.width}
          height={m?.height}
          loading={eager ? 'eager' : 'lazy'}
          // React 18 passes this through as the lowercase HTML attribute.
          {...({ fetchpriority: priority ? 'high' : 'auto' } as Record<string, string>)}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          // The on-screen step skips the fade so it paints (and counts as LCP) as soon as it decodes.
          data-loaded={loaded || priority}
          className="step-photo-img"
        />
      </picture>
      {m?.placeholder && <span className="photo-badge">{t('nav.placeholderPhoto')}</span>}
      <button type="button" className="icon-btn photo-expand" onClick={onOpen} aria-label={`${t('nav.photoOpen')}: ${caption}`}>
        <Expand size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

export function PhotoViewer({ photo, caption, manifest, onClose }: { photo: string; caption: string; manifest: PhotoManifest | null; onClose: () => void }) {
  const { t } = useI18n();
  const m = manifest?.photos[photo];
  const largest = m?.widths[m.widths.length - 1] ?? 960;
  const base = photo.replace(/\.jpg$/, '');
  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={caption} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <picture>
        <source type="image/avif" srcSet={`${BASE}${base}-${largest}.avif`} />
        <source type="image/webp" srcSet={`${BASE}${base}-${largest}.webp`} />
        {/* touch-action: pinch-zoom lets the browser zoom the image natively. */}
        <img src={`${BASE}${base}-${largest}.jpg`} alt={caption} />
      </picture>
      <p className="photo-viewer-caption">{caption}</p>
      <button type="button" className="icon-btn photo-viewer-close" onClick={onClose} aria-label={t('nav.photoClose')} autoFocus>
        <X size={24} aria-hidden="true" />
      </button>
    </div>
  );
}
