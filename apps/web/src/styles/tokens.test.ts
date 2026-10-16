import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Reads tokens.css and checks WCAG contrast of every text/background pair the
// components use. Key text (body text, headings, primary buttons) ≥ 7:1,
// secondary text ≥ 4.5:1 — the brief's sunlight-legibility rule.

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function block(selector: RegExp): Record<string, string> {
  const m = css.match(selector);
  if (!m) throw new Error(`block not found: ${selector}`);
  const vars: Record<string, string> = {};
  for (const [, k, v] of m[1]!.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[k!] = v!.trim();
  return vars;
}

const root = block(/:root \{([^}]*)\}/);
const themes = {
  day: { ...root, ...block(/\[data-theme='day'\] \{([^}]*)\}/) },
  night: { ...root, ...block(/\[data-theme='night'\] \{([^}]*)\}/) },
};

function resolve(vars: Record<string, string>, name: string): string {
  let v = vars[name];
  for (let i = 0; v?.startsWith('var(') && i < 5; i++) v = vars[v.slice(6, -1)];
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${name} is not a solid hex colour: ${v}`);
  return v;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const KEY: Array<[string, string]> = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['heading', 'bg'],
  ['heading', 'surface'],
  ['primary-text', 'primary-bg'],
];
// SOS text sits on --sos-bg in both themes (white text, ≥ 4.5:1).
const SOS: Array<[string, string]> = [['white', 'sos-bg']];
const SECONDARY: Array<[string, string]> = [
  ['text', 'surface-2'],
  ['text-dim', 'bg'],
  ['text-dim', 'surface'],
  ['text-dim', 'surface-2'],
];

describe.each(Object.entries(themes))('%s theme contrast', (_name, vars) => {
  it.each(KEY)('key text %s on %s ≥ 7:1', (fg, bg) => {
    expect(contrast(resolve(vars, fg), resolve(vars, bg))).toBeGreaterThanOrEqual(7);
  });
  it.each(SOS)('SOS: %s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(resolve(vars, fg), resolve(vars, bg))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(SECONDARY)('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(resolve(vars, fg), resolve(vars, bg))).toBeGreaterThanOrEqual(4.5);
  });
});
