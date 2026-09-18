import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [] } },
  resolve: { alias: { '@ninety/shared': resolve(__dirname, '../../packages/shared/src/index.ts') } },
  server: { port: 5174, host: true },
  build: { outDir: 'dist', sourcemap: true },
});
