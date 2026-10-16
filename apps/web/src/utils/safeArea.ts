// env(safe-area-inset-*) can't be read from JS directly; measure a probe.
export function safeAreaInset(side: 'top' | 'bottom'): number {
  if (typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  // Through the CSS variable, so the iPhone mockup mode (main.tsx) counts too.
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;height:var(--safe-${side === 'top' ? 't' : 'b'})`;
  document.body.appendChild(probe);
  const h = probe.offsetHeight;
  probe.remove();
  return h;
}
