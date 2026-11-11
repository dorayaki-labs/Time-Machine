// Generates public/menu-images/manifest.json — the runtime's only way of
// knowing which hero illustrations exist. Vite copies public/ verbatim and
// cannot enumerate it at runtime, so the manifest is (re)generated at dev
// start and before every build (see package.json: predev / prebuild).
//
// The directory name intentionally keeps the user's space: "menu images/".
// Drop any .png/.jpg/.jpeg/.webp/.avif/.gif in there and it appears in the
// rotation on the next dev restart or build — no code changes, no manual
// manifest edits.
//
//   node scripts/generate-menu-manifest.mjs
//
// Idempotent and self-healing: creates the directory, always rewrites the
// manifest to match the directory exactly, and exits 0 with a note when
// there is nothing to list.

import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const DIR = fileURLToPath(new URL('../public/menu images/', import.meta.url));
const OUT = join(DIR, 'manifest.json');
const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);

await mkdir(DIR, { recursive: true });

const files = (await readdir(DIR))
  .filter((name) => EXTENSIONS.has(extname(name).toLowerCase()))
  .sort();

const manifest = { count: files.length, images: files.map((name) => ({ name, path: `menu images/${encodeURIComponent(name)}` })) };

await writeFile(OUT, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`menu-images manifest: ${files.length} image(s)${files.length ? ` — ${files.join(', ')}` : ' (drop images into "public/menu images/" to fill the rotation)'}`);
