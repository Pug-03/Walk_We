import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Shared primitives, same split as DeePer's components/ui.jsx: toast +
// dialog providers and small state views. No bare spinners: loading states
// are skeletons.

// ---------- Toast ----------
type Toast = (text: string, durationMs?: number) => void;
const ToastCtx = createContext<Toast>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback<Toast>((text, durationMs = 3600) => {
    setMsg({ text, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), durationMs);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {/* Always mounted so screen readers pick up each message. */}
      <div role="status" aria-live="polite" className="sr-only">
        {msg?.text}
      </div>
      {msg && (
        <div key={msg.id} className="toast" aria-hidden="true">
          {msg.text}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

// ---------- Dialog ----------
export interface DialogProps {
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}

/** Bottom-anchored modal: focus moves in, Tab is trapped, Escape closes. */
export function Dialog({ title, icon, children, actions, onClose }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useRef(`dlg-${Math.random().toString(36).slice(2)}`).current;
  // Latest onClose without re-running the focus effect: parents re-render often
  // (GPS fixes), and re-running it pulled focus back to the first button.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('button, [href], input');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = ref.current.querySelectorAll<HTMLElement>('button, [href], input');
      if (!items.length) return;
      const a = items[0]!;
      const z = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="dialog-scrim fade-in" onClick={onClose}>
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {icon && <div className="dialog-ic">{icon}</div>}
        <h2 className="h2" id={titleId}>
          {title}
        </h2>
        {children}
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}

// ---------- Skeleton ----------
export function SkeletonRows({ count = 3, label }: { count?: number; label: string }) {
  return (
    <div role="status" aria-label={label} style={{ display: 'grid', gap: 6 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
