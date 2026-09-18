import { defineConfig } from 'vitest/config';
export default defineConfig({
  // No CSS in this package; an explicit empty config stops Vite adopting an
  // unrelated project's postcss.config.js from a parent directory.
  css: { postcss: { plugins: [] } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
