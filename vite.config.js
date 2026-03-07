import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    host: host || false,
    port: 5173,
    strictPort: true,
    hmr: host
      ? { protocol: 'ws', host, port: 5183 }
      : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  clearScreen: false,
});
