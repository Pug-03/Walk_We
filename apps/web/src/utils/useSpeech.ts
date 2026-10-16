import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n.ts';

// Speech-to-text through the browser's own Web Speech API (Chrome, Edge,
// Android, recent Safari). No AI and nothing of ours on a server: the browser
// vendor does the recognition. Where the API is missing, `supported` is false
// and the mic button simply isn't shown.

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};
type Ctor = new () => Recognition;
const SpeechCtor: Ctor | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as { SpeechRecognition?: Ctor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: Ctor }).webkitSpeechRecognition);

export interface Speech {
  supported: boolean;
  listening: boolean;
  /** Last problem (e.g. "not-allowed" when the mic is blocked), or null. */
  error: string | null;
  start(): void;
  stop(): void;
}

/** Push-to-talk: `onText` gets the words live (interim) and once more when final. */
export function useSpeech(lang: Lang, onText: (text: string, final: boolean) => void): Speech {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;
  useEffect(() => () => rec.current?.stop(), []);

  const start = () => {
    if (!SpeechCtor || listening) return;
    const r = new SpeechCtor();
    r.lang = lang === 'th' ? 'th-TH' : 'en-US';
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let text = '';
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i]?.[0]?.transcript ?? '';
        final = e.results[i]?.isFinal ?? false;
      }
      cb.current(text.trim(), final);
    };
    r.onerror = (e) => {
      setError(e.error);
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };
  return { supported: !!SpeechCtor, listening, error, start, stop: () => rec.current?.stop() };
}
