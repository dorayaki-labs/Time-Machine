import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Rewrites %BASE_URL% in index.html so font/icon references follow the
// configured base path on both hosting targets.
function baseUrlPlugin() {
  return {
    name: 'tm-base-url',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%BASE_URL%', basePath),
    },
  };
}

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// GitHub Pages serves project sites under /<repo>/ — set VITE_BASE_PATH when
// building for it (the Pages workflow does this automatically). Surge and
// local development use the default "/".
const basePath = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [react(), baseUrlPlugin()],

  resolve: {
    alias: {
      '@': r('./src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
});

