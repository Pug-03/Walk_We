import { env } from '../env.ts';

// Read text aloud. With the AI proxy configured, the voice comes from
// ElevenLabs (natural Thai and English, through the proxy so the key never
// reaches the browser). Without it, or if that fails, the phone's own
// speech engine reads it. One utterance at a time: a new one stops the last.

type Lang = 'th' | 'en';

const audioCache = new Map<string, string>(); // text → object URL
let currentAudio: HTMLAudioElement | null = null;
let ctl: AbortController | null = null;
/** Once the proxy says it has no voice (or fails twice), stop asking this session. */
let remoteOff = !env.aiProxyUrl;
let remoteFails = 0;

export function stopSpeaking(): void {
  ctl?.abort();
  ctl = null;
  currentAudio?.pause();
  currentAudio = null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function speakLocal(text: string, lang: Lang): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'th' ? 'th-TH' : 'en-GB';
    u.rate = 0.95;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

async function remoteUrl(text: string, lang: Lang, signal: AbortSignal): Promise<string | null> {
  const key = `${lang}:${text}`;
  const hit = audioCache.get(key);
  if (hit) return hit;
  if (remoteOff) return null;
  try {
    const res = await fetch(`${env.aiProxyUrl}/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, lang }),
      credentials: 'omit',
      signal: AbortSignal.any ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : signal,
    });
    if (res.status === 204 || res.status === 503) {
      remoteOff = true; // no voice key on the proxy: use the phone's voice from now on
      return null;
    }
    if (!res.ok) throw new Error(String(res.status));
    const url = URL.createObjectURL(await res.blob());
    audioCache.set(key, url);
    remoteFails = 0;
    return url;
  } catch (e) {
    if ((e as Error)?.name === 'AbortError' && signal.aborted) throw e;
    if (++remoteFails >= 2) remoteOff = true;
    return null;
  }
}

/** Speak `text` (stopping anything already playing). Resolves when done or stopped. */
export async function speak(text: string, lang: Lang, opts: { local?: boolean } = {}): Promise<void> {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!clean) return;
  stopSpeaking();
  const mine = new AbortController();
  ctl = mine;
  try {
    // Short, time-critical words (the SOS count) skip the network.
    const url = opts.local ? null : await remoteUrl(clean, lang, mine.signal);
    if (mine.signal.aborted) return;
    if (url) {
      const a = new Audio(url);
      currentAudio = a;
      const played = await new Promise<boolean>((resolve) => {
        a.onended = () => resolve(true);
        a.onerror = () => resolve(false);
        // iOS may block audio that starts after a network wait: then the phone voice reads it.
        a.play().catch(() => resolve(false));
      });
      if (played || mine.signal.aborted) return;
    }
    await speakLocal(clean, lang);
  } catch {
    /* stopped */
  }
}

export const canSpeak = (): boolean => !!env.aiProxyUrl || 'speechSynthesis' in window;
