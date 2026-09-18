import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], environment: 'node' },
  resolve: { alias: { '@ninety/shared': resolve(__dirname, '../../packages/shared/src/index.ts') } },
});
