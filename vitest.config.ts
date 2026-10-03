import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  resolve: {
    alias: { '@cinv/core': fileURLToPath(new URL('./packages/cinv/src/index.ts', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'packages/**/*.test.ts', 'extension/**/*.test.ts', 'tools/**/*.test.mjs'],
    environment: 'node',
    restoreMocks: true,
  },
});
