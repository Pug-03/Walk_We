import { useEffect, useRef, useState } from 'react';
import { Mic, Sparkles } from 'lucide-react';
import type { AIUnavailableError, RouteIntent } from '@walkwe/core/ai';
import { ai } from '../../services.ts';
import { useI18n } from '../../store/i18n.tsx';

// Speech input where the browser has it (Chrome, Edge, Android); Safari's
// support for Thai is patchy, so the button only shows when the API exists.
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};
const SpeechCtor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
  .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

/** Window event: start listening in the ask box (fired by the planner's header mic). */
export const ASK_LISTEN = 'ww:ask-listen';

interface Props {
  /** Resolves the intent into places and runs the router; returns a message to show, or null when done. */
  onIntent: (intent: RouteIntent) => Promise<string | null>;
}

/**
 * Natural-language route request (AI feature 1). Hidden when no AI proxy is
 * configured; the manual From/To above always works on its own.
 */
export function AskBox({ onIntent }: Props) {
  const { t, lang } = useI18n();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const rec = useRef<Recognition | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const listenRef = useRef<() => void>(() => {});
  useEffect(() => () => {
    ctl.current?.abort();
    rec.current?.stop();
  }, []);
  // The planner's header mic speaks to this box when AI is on (ASK_LISTEN).
  useEffect(() => {
    const onAsk = () => {
      formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      listenRef.current();
    };
    window.addEventListener(ASK_LISTEN, onAsk);
    return () => window.removeEventListener(ASK_LISTEN, onAsk);
  }, []);
  if (!ai) return null;

  const submit = async () => {
    const q = text.trim();
    if (q.length < 2 || busy) return;
    ctl.current?.abort();
    ctl.current = new AbortController();
    setBusy(true);
    setMessage(null);
    try {
      const intent = await ai!.parseRouteRequest({ text: q, lang }, ctl.current.signal);
      setMessage(intent.clarification || (await onIntent(intent)));
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      // By name: importing the error class would pull the AI schemas into this page's bundle.
      const rateLimited = (e as Error)?.name === 'AIUnavailableError' && (e as AIUnavailableError).reason === 'rate_limited';
      setMessage(rateLimited ? t('ai.ask.busy') : t('ai.ask.failed'));
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    if (!SpeechCtor) return;
    if (listening) return rec.current?.stop();
    const r = new SpeechCtor();
    r.lang = lang === 'th' ? 'th-TH' : 'en-US';
    r.interimResults = false;
    r.onresult = (e) => setText(e.results[0]?.[0]?.transcript ?? '');
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  listenRef.current = listen;

  return (
    <form
      ref={formRef}
      className="ask"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      data-testid="ai-ask"
    >
      <label className="ask-label" htmlFor="ai-ask-input">
        <span className="ai-badge" aria-hidden="true">
          <Sparkles size={12} />
          AI
        </span>
        {t('ai.ask.label')}
      </label>
      <div className="ask-row">
        <input
          id="ai-ask-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? t('ai.ask.listening') : t('ai.ask.placeholder')}
          maxLength={300}
          autoComplete="off"
          enterKeyHint="go"
        />
        {SpeechCtor && (
          <button type="button" className="icon-btn" onClick={listen} aria-pressed={listening} aria-label={t('ai.ask.voice')}>
            <Mic size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      <button type="submit" className="btn ask-go" disabled={busy || text.trim().length < 2}>
        {busy ? t('ai.ask.working') : t('ai.ask.submit')}
      </button>
      <p className="small" role="status" aria-live="polite">
        {message}
      </p>
      <p className="small ask-note">{t('ai.ask.note')}</p>
    </form>
  );
}
