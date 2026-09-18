import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  // The API has no CSS. Declaring an empty PostCSS config stops Vite walking up
  // the filesystem and adopting an unrelated project's postcss.config.js.
  css: { postcss: { plugins: [] } },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/**/*.test.ts', 'src/db/seed.ts'] },
  },
  resolve: { alias: { '@ninety/shared': resolve(__dirname, '../../packages/shared/src/index.ts') } },
});
