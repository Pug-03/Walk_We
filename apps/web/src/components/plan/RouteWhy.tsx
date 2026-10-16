import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Route, WalkMode } from '@walkwe/core';
import type { RouteFacts } from '@walkwe/core/ai';
import { ai } from '../../services.ts';
import { useI18n } from '../../store/i18n.tsx';

/** AI sentences already fetched this session, by facts: going back and forth never pays twice. */
const explained = new Map<string, string>();

/**
 * "Why this route" (AI feature 3). The rule-based sentence shows at once and
 * stays if AI is off or fails; when AI answers, its sentence replaces it. AI
 * gets only the computed numbers, and both sides reject a sentence carrying a
 * number the router didn't produce.
 */
export function RouteWhy({ route, shortest, mode }: { route: Route; shortest: Route; mode: WalkMode }) {
  const { t, lang } = useI18n();
  const facts: RouteFacts = {
    lang,
    mode,
    minutes: Math.max(1, Math.round(route.durationS / 60)),
    meters: Math.round(route.lengthM),
    shortestMeters: Math.round(shortest.lengthM),
    shadePct: mode === 'day' ? Math.round(route.shadeShare * 100) : null,
    shortestShadePct: mode === 'day' ? Math.round(shortest.shadeShare * 100) : null,
    safety: mode === 'night' && route.safetyScore != null ? Math.round(route.safetyScore * 10) / 10 : null,
    shortestSafety: mode === 'night' && shortest.safetyScore != null ? Math.round(shortest.safetyScore * 10) / 10 : null,
    isShortest: route === shortest,
  };
  const extra = Math.max(0, facts.meters - facts.shortestMeters);
  const rule =
    mode === 'day'
      ? facts.isShortest
        ? t('ai.why.dayShortest', { p: facts.shadePct ?? 0 })
        : t('ai.why.day', { p: facts.shadePct ?? 0, q: facts.shortestShadePct ?? 0, d: extra })
      : facts.isShortest
        ? t('ai.why.nightShortest', { s: (facts.safety ?? 0).toFixed(1) })
        : t('ai.why.night', { s: (facts.safety ?? 0).toFixed(1), b: (facts.shortestSafety ?? 0).toFixed(1), d: extra });

  const key = JSON.stringify(facts);
  const [aiText, setAiText] = useState<{ key: string; text: string } | null>(() => {
    const hit = explained.get(key);
    return hit ? { key, text: hit } : null;
  });
  useEffect(() => {
    if (!ai) return;
    const hit = explained.get(key);
    if (hit) return void setAiText({ key, text: hit });
    const ctl = new AbortController();
    // Slow answers aren't worth the wait: the rule-based sentence stays.
    const giveUp = setTimeout(() => ctl.abort(), 9000);
    ai.explainRoute(facts, ctl.signal).then(
      (text) => {
        explained.set(key, text);
        setAiText({ key, text });
      },
      () => {}, // keep the rule-based sentence
    );
    return () => {
      clearTimeout(giveUp);
      ctl.abort();
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromAi = aiText?.key === key;
  return (
    <section className="why" aria-label={t('ai.why.title')} data-testid="route-why">
      <h3 className="section-label">{t('ai.why.title')}</h3>
      <p className="why-text">{fromAi ? aiText.text : rule}</p>
      <p className="small why-source">
        {fromAi && (
          <span className="ai-badge" aria-hidden="true">
            <Sparkles size={12} />
            AI
          </span>
        )}
        {fromAi ? t('ai.why.byAi') : t('ai.why.byRule')}
      </p>
    </section>
  );
}
