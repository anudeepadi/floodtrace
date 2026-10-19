import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rollupOptions: {
      // Landing page at /, dashboard at /app/.
      input: { home: resolve(__dirname, 'index.html'), app: resolve(__dirname, 'app/index.html') },
    },
  },
  test: {
    environment: 'node',
    coverage: { include: ['src/geo/**', 'src/sim/**', 'src/data/**', 'src/state.ts'] },
  },
});
