import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Project GitHub Pages sites are served from /<repo>/, so the build can be
// pointed at a sub-path while local dev keeps the domain root. Read through
// globalThis so this file typechecks without @types/node installed.
const baseUrl =
  (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.VITE_BASE_URL ?? '/';

export default defineConfig({
  base: baseUrl,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['.style.dev'],
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
});
