// Bulletproof post-build asset-path rewriter.
//
// No matter what Vite baked into dist/ — whether `base` was honoured or not —
// every root-absolute reference to a public asset is rewritten to sit under
// the configured base path. This is the safety net that makes the GitHub
// Pages deploy correct even when a CI env var is missing or ignored.
//
// Idempotent: won't double-prefix paths that already carry the base.
// Run after `vite build` (the npm build script chains it automatically).
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

// Default to the Pages target: the repo name segment. An env var always wins.
const base = (process.env.VITE_BASE_PATH || '/time-machine/').replace(/\/+$/, '') + '/';
if (base === '/') {
  console.log('fix-asset-paths: base is "/" — nothing to rewrite.');
  process.exit(0);
}

// Match a root-absolute path to a known public asset, preceded by a delimiter
// (quote, paren, equals, or backtick). Captures the delimiter so it is
// preserved. Won't touch protocol-relative `//host/...`, won't re-prefix an
// already-prefixed `/time-machine/assets/...` (the segment after `/` would be
// `time-machine`, not one of the listed names).
const ROOT_ABS = /(["'(=`])(\/)(assets|fonts|archive|data|favicon\.ico|robots\.txt|site\.webmanifest|vite\.svg|logo)/g;

function rewrite(text) {
  return text.replace(ROOT_ABS, (_m, pre, _slash, name) => `${pre}${base}${name}`);
}

async function* walk(dir) {
  for (const entry of await readdir(dir)) {
    const p = join(dir, entry);
    const s = await stat(p);
    if (s.isDirectory()) yield* walk(p);
    else if (/\.(html|css|js|webmanifest|json)$/.test(extname(p))) yield p;
  }
}

let touched = 0;
for await (const file of walk(DIST)) {
  const orig = await readFile(file, 'utf8');
  const fixed = rewrite(orig);
  if (fixed !== orig) {
    await writeFile(file, fixed);
    touched++;
  }
}
console.log(`fix-asset-paths: rewrote root-absolute paths under ${base} in ${touched} file(s).`);
