import { defineConfig } from 'vitest/config';

// One test run for every workspace. packages/* run in Node (they must not
// depend on the browser); the web app's unit tests opt into jsdom per file.
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'config/**/*.test.ts', 'apps/web/src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
