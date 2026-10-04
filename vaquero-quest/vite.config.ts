import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200, assetsInlineLimit: 200000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
