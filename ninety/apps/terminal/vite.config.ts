import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  // An explicit empty PostCSS config: this app ships its own plain CSS and must
  // not adopt an unrelated project's postcss.config.js from a parent directory.
  css: { postcss: { plugins: [] } },
  resolve: { alias: { '@ninety/shared': resolve(__dirname, '../../packages/shared/src/index.ts') } },
  server: { port: 5173, host: true },
  build: { outDir: 'dist', sourcemap: true, target: 'es2020' },
});
