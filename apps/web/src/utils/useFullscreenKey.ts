import { useEffect } from 'react';

// Older Safari only has the webkit-prefixed Fullscreen API.
type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };

/** Is the key going into a text field (where "f" is just a letter)? */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/** Press F anywhere (outside a text field) to toggle full screen. */
export function useFullscreenKey(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave Cmd/Ctrl+F (find) and friends alone.
      if (e.key.toLowerCase() !== 'f' || e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return;
      const doc = document as WebkitDocument;
      const root = document.documentElement as WebkitElement;
      e.preventDefault();
      if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {});
        else doc.webkitExitFullscreen?.();
      } else if (root.requestFullscreen) {
        void root.requestFullscreen().catch(() => {});
      } else {
        root.webkitRequestFullscreen?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
