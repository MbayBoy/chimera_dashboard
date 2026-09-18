import { defineConfig } from 'vitest/config';
export default defineConfig({
  // No CSS in this package. An explicit empty PostCSS config stops Vite walking
  // up the filesystem and adopting an unrelated project's postcss.config.js.
  css: { postcss: { plugins: [] } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' } ,
});
