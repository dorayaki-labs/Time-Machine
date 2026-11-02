import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Rewrites %BASE_URL% in index.html so font/icon references follow the
// configured base path on both hosting targets.
function baseUrlPlugin(basePath) {
  return {
    name: 'tm-base-url',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%BASE_URL%', basePath),
    },
  };
}

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// GitHub Pages serves project sites under /<repo>/ — the build must know that
// prefix or every asset URL lands at the domain root. Resolution order: real
// environment variable (CI) → .env.production file (so any build gets the
// right base even when CI vars are missing) → "/" for dev and root hosting.
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '');
  const basePath = process.env.VITE_BASE_PATH || fileEnv.VITE_BASE_PATH || '/';

  return {
    base: basePath,
    plugins: [react(), baseUrlPlugin(basePath)],

    resolve: {
      alias: {
        '@': r('./src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
    },
  };
});
