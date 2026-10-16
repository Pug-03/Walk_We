import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// public/_headers allows the one inline script in index.html by hash; if the
// script changes, the hash must change with it or the theme script is blocked.
describe('CSP', () => {
  it('allows exactly the inline scripts in index.html', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    for (const body of inline) {
      const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
      expect(headers).toContain(hash);
    }
  });
});
