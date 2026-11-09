#!/usr/bin/env node
// Migrates episode records from schema 3 (one story per record) to schema 4
// (a broadcast episode containing one or more segments). Movies stay on
// schema 3 — they are single stories by nature.
//
// Safety properties:
//   * Idempotent — a record already carrying `segments` is left untouched,
//     so the script can be run any number of times without duplicating.
//   * Non-destructive — with --backup, each changed file is copied to
//     <file>.pre-v4.bak first. Existing fields are MOVED, never dropped:
//     story-level fields become segment 1, broadcast-level fields stay put.
//   * Verifiable — run with --check to validate every file after migrating
//     and print a per-catalogue summary of what moved where.
//
// Usage:
//   node scripts/migrate-episodes-to-segments.mjs            # migrate in place
//   node scripts/migrate-episodes-to-segments.mjs --check    # report only, no writes
//   node scripts/migrate-episodes-to-segments.mjs --backup   # also write .pre-v4.bak copies

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public');
const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has('--check');
const BACKUP = args.has('--backup');

const CATALOGUES = [
  { dir: 'archive/anime-1979', id: 'anime-1979' },
  { dir: 'archive/anime-2005', id: 'anime-2005' },
  { dir: 'archive/historical/anime-1973', id: 'anime-1973' },
];

// Story-level fields: they describe ONE story, so they move into its segment.
// Everything else on the record (release, originalLanguage, sources,
// preservation, seriesId, number, id, type) is broadcast-level and stays.
const STORY_FIELDS = ['title', 'alternateTitles', 'summary', 'description', 'image',
  'screenshots', 'characters', 'gadgets', 'voiceActors', 'durationMinutes'];

let migrated = 0;
let skipped = 0;
let alreadyV4 = 0;
let errors = 0;

for (const cat of CATALOGUES) {
  const index = JSON.parse(readFileSync(join(DATA, cat.dir, 'index.json'), 'utf8'));
  for (const entry of index.entries ?? []) {
    const file = join(DATA, cat.dir, entry.path);
    if (!existsSync(file)) { console.error(`  ✗ missing: ${relative(ROOT, file)}`); errors++; continue; }
    let record;
    try { record = JSON.parse(readFileSync(file, 'utf8')); }
    catch (e) { console.error(`  ✗ invalid JSON: ${relative(ROOT, file)} (${e.message})`); errors++; continue; }

    if (Array.isArray(record.segments) && record.segments.length > 0) { alreadyV4++; continue; }
    if (record.schemaVersion !== 3) {
      console.error(`  ✗ ${relative(ROOT, file)}: schemaVersion ${record.schemaVersion} is neither 3 nor a migrated record`);
      errors++; continue;
    }

    // Segment 1 = everything story-specific the record carried. `description`
    // and `durationMinutes` did not exist on schema 3 episodes; they are
    // added as explicit nulls so every segment has the same complete shape.
    const segment = {
      id: `${record.id}-01`,
      segmentNumber: 1,
      title: record.title ?? { en: '', ja: null },
      alternateTitles: Array.isArray(record.alternateTitles) ? record.alternateTitles : [],
      summary: record.summary ?? null,
      description: record.description ?? null,
      image: record.image ?? { url: null, alt: null },
      screenshots: Array.isArray(record.screenshots) ? record.screenshots : [],
      characters: Array.isArray(record.characters) ? record.characters : [],
      gadgets: Array.isArray(record.gadgets) ? record.gadgets : [],
      voiceActors: Array.isArray(record.voiceActors) ? record.voiceActors : [],
      durationMinutes: record.durationMinutes ?? null,
    };

    const next = {
      schemaVersion: 4,
      id: record.id,
      type: record.type,
      seriesId: record.seriesId,
      number: record.number,
      originalLanguage: record.originalLanguage ?? 'ja',
      release: record.release ?? { date: null, precision: null, region: null },
      ...(record.preservation !== undefined ? { preservation: record.preservation } : {}),
      sources: Array.isArray(record.sources) ? record.sources : [],
      segments: [segment],
      updatedAt: record.updatedAt ?? null,
    };

    if (CHECK_ONLY) { skipped++; continue; }

    if (BACKUP && !existsSync(`${file}.pre-v4.bak`)) copyFileSync(file, `${file}.pre-v4.bak`);
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    migrated++;
  }
}

console.log(`Migration ${CHECK_ONLY ? 'check' : 'run'} complete: ${migrated} migrated, ${alreadyV4} already on v4, ${skipped} checked, ${errors} error(s).`);

if (!CHECK_ONLY) {
  // Post-migration verification: every story field value must survive inside
  // segment 1, and every broadcast field must still be on the record.
  let verified = 0; let lost = 0;
  for (const cat of CATALOGUES) {
    const index = JSON.parse(readFileSync(join(DATA, cat.dir, 'index.json'), 'utf8'));
    for (const entry of index.entries ?? []) {
      const file = join(DATA, cat.dir, entry.path);
      const record = JSON.parse(readFileSync(file, 'utf8'));
      if (!Array.isArray(record.segments) || record.segments.length !== 1) continue;
      const seg = record.segments[0];
      if (seg.segmentNumber !== 1 || seg.id !== `${record.id}-01`) { lost++; console.error(`  ✗ ${relative(ROOT, file)}: bad segment identity`); continue; }
      for (const f of STORY_FIELDS) {
        if (record[f] !== undefined) { lost++; console.error(`  ✗ ${relative(ROOT, file)}: story field "${f}" still on the record`); }
      }
      verified++;
    }
  }
  console.log(`Verification: ${verified} single-segment records verified, ${lost} problem(s).`);
  if (errors || lost) process.exit(1);
}
