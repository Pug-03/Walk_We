import {
  AIUnavailableError,
  explanationMatchesFacts,
  explanationSchema,
  routeIntentSchema,
  type AIAdapter,
  type ParseRequest,
  type RouteFacts,
  type RouteIntent,
} from '@walkwe/core/ai';

const TIMEOUT_MS = 15_000;

/**
 * Claude through the Walk We proxy (apps/ai-proxy). The browser never holds
 * the API key; it sends only the typed text or the computed route numbers,
 * never coordinates. Everything returned is validated again here.
 */
export class ProxyAIAdapter implements AIAdapter {
  constructor(private readonly baseUrl: string) {}

  private async post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    signal?.addEventListener('abort', () => ctl.abort(), { once: true });
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal,
        credentials: 'omit',
      });
      if (res.status === 429) throw new AIUnavailableError('rate_limited');
      if (res.status === 422) throw new AIUnavailableError('invalid');
      if (!res.ok) throw new AIUnavailableError('failed');
      return await res.json();
    } catch (e) {
      if (e instanceof AIUnavailableError) throw e;
      if ((e as Error)?.name === 'AbortError' && signal?.aborted) throw e;
      throw new AIUnavailableError('failed');
    } finally {
      clearTimeout(timer);
    }
  }

  async parseRouteRequest(req: ParseRequest, signal?: AbortSignal): Promise<RouteIntent> {
    const out = routeIntentSchema.safeParse(await this.post('/parse', req, signal));
    if (!out.success) throw new AIUnavailableError('invalid');
    return out.data;
  }

  async explainRoute(facts: RouteFacts, signal?: AbortSignal): Promise<string> {
    const out = explanationSchema.safeParse(await this.post('/explain', facts, signal));
    // Checked on both sides: a sentence with a number we didn't compute is dropped.
    if (!out.success || !explanationMatchesFacts(out.data.text, facts)) throw new AIUnavailableError('invalid');
    return out.data.text;
  }
}
