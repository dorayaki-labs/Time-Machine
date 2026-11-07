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
// prefix or every asset URL lands at the domain root. Cloudflare Pages (and
// any other root-domain host) must instead build with base "/". Resolution
// order: an explicit VITE_BASE_PATH (set by the build scripts and CI) →
// Cloudflare Pages builds always serve at the domain root, and CF_PAGES is
// set in every Pages build, so a plain `npm run build` is safe there too →
// .env.production (the GitHub Pages default) → "/" for dev.
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '');
  const basePath = process.env.VITE_BASE_PATH
    || (process.env.CF_PAGES ? '/' : undefined)
    || fileEnv.VITE_BASE_PATH
    || '/';
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
