// Migration: give every episode record an episode-level broadcast name.
//
// Schema-4 records moved story fields (title, summary, …) onto segments, which
// left episodes with no name of their own — the UI had to comma-join segment
// titles to name a broadcast. This migration adds the broadcast name back as
// an optional episode-level `title` ({ en, ja }) WITHOUT touching segments:
//
//   "title": { "en": "Episode 1", "ja": null }
//
// inserted right after "number" so the key order matches the schema-3 shape.
// Idempotent: records that already carry a title are left untouched, and the
// file formatting (2-space indent, trailing newline) is preserved.
//
//   node scripts/migrate-episode-titles.mjs
//
// Run scripts/validate-catalog.js afterwards; the validators (validate.js and
// this repo's validate-catalog.js) now accept `title` on episode records.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'archive');

function listEpisodeFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listEpisodeFiles(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

// Episode record files live under any .../episodes/ directory (anime-2005,
// anime-1979, historical/anime-1973). Movies keep their own titles and are
// never touched.
const files = listEpisodeFiles(ROOT).filter((p) => dirname(p).endsWith('episodes'));

let migrated = 0;
let skipped = 0;
const changed = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const record = JSON.parse(raw);
  if (record.type !== 'episode') { skipped += 1; continue; }
  if (record.title) { skipped += 1; continue; }

  const named = {
    en: `Episode ${record.number ?? '?'}`,
    ja: null,
  };

  // Rebuild with `title` placed after `number` (schema-3 key order), keeping
  // every other key and its order exactly as-is.
  const next = {};
  for (const [key, value] of Object.entries(record)) {
    next[key] = value;
    if (key === 'number') next.title = named;
  }
  if (!('title' in next)) next.title = named; // records without a number field

  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  migrated += 1;
  changed.push(`${record.id} → "${named.en}"`);
}

console.log(`episodes scanned: ${files.length}`);
console.log(`migrated: ${migrated}`);
console.log(`skipped (movies or already named): ${skipped}`);
if (changed.length) console.log(changed.slice(0, 8).join('\n') + (changed.length > 8 ? `\n… and ${changed.length - 8} more` : ''));
