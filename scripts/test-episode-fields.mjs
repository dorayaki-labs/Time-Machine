// Unit tests for the episode documentation accounting
// (src/lib/episodeFields.js) — the numbers shown in the Archive
// Completeness section and the dots on the segment cards must be computed
// from real record data, so these run against the actual episode records in
// public/archive/.
//
//   node scripts/test-episode-fields.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { episodeFieldChecklist, segmentDocStatus } from '../src/lib/episodeFields.js';

const readRecord = (id) => JSON.parse(readFileSync(new URL(`../public/archive/anime-2005/episodes/${id}.json`, import.meta.url), 'utf8'));
const merged = (record) => ({
  ...record,
  characters: [...new Set((record.segments ?? []).flatMap((s) => s.characters))],
});

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
};

console.log('episode field accounting');

const ep1 = readRecord('0001');
const s1 = ep1.segments[0];
const s3 = ep1.segments[2];

// --- segmentDocStatus -------------------------------------------------------
test('a fully documented segment reports level full', () => {
  const doc = segmentDocStatus(s1);
  assert.equal(doc.level, 'full');
  assert.equal(doc.total, 9);
  assert.equal(doc.done, 8, 'everything but gadgets');
});

test('a segment with only images/screenshots reports partial with counts', () => {
  const doc = segmentDocStatus(s3);
  assert.equal(doc.level, 'partial');
  assert.equal(doc.done, 4, 'title + image + screenshots + duration');
  assert.equal(doc.total, 9);
});

test('a segment with nothing documented reports empty', () => {
  const doc = segmentDocStatus({ id: 'x', title: { en: '' }, summary: null, description: null, image: {}, screenshots: [], characters: [], gadgets: [], voiceActors: [] });
  assert.equal(doc.level, 'empty');
  assert.equal(doc.done, 0);
});

// --- episodeFieldChecklist ---------------------------------------------------
test('counts are computed from the record, never hardcoded', () => {
  const check = episodeFieldChecklist(merged(ep1), s1, 1, 3);
  assert.equal(check.total, 16, '6 episode fields + 10 segment fields');
  assert.equal(check.groups.length, 2);
  assert.equal(check.groups[0].label, 'Episode');
  assert.equal(check.groups[1].label, 'Segment 1 of 3');
});

test('episode 0001 segment 1: documented fields counted correctly', () => {
  const check = episodeFieldChecklist(merged(ep1), s1, 1, 3);
  const states = Object.fromEntries(check.groups.flatMap((g) => g.fields.map((f) => [f.label, f.state])));
  assert.equal(states['Broadcast date'], 'done');
  assert.equal(states['Original language'], 'done');
  assert.equal(states['Region'], 'done');
  assert.equal(states['Preservation'], 'missing', 'record has no preservation value');
  assert.equal(states['Viewing sources'], 'done', 'the Anikoto source');
  assert.equal(states['Segments'], 'done', 'all three segments have titles');
  assert.equal(states['Title (EN)'], 'done');
  assert.equal(states['Title (JA)'], 'done', 'both en and ja present');
  assert.equal(states['Summary'], 'done');
  assert.equal(states['Synopsis'], 'done');
  assert.equal(states['Cover image'], 'done');
  assert.equal(states['Screenshots'], 'done');
  assert.equal(states['Characters'], 'done');
  assert.equal(states['Gadgets'], 'missing');
  assert.equal(states['Voice actors'], 'done');
  assert.equal(states['Duration'], 'done');
  assert.equal(check.done, 14);
  assert.equal(check.percent, Math.round((14 / 16) * 100), '88%');
});

test('a segment with only some fields shows the missing japanese title as partial', () => {
  const check = episodeFieldChecklist(merged(ep1), s3, 3, 3);
  const states = Object.fromEntries(check.groups.flatMap((g) => g.fields.map((f) => [f.label, f.state])));
  assert.equal(states['Title (EN)'], 'done');
  assert.equal(states['Title (JA)'], 'done', 'segment 3 carries both languages');
  assert.equal(states['Summary'], 'missing');
  assert.equal(states['Synopsis'], 'missing');
  assert.equal(states['Characters'], 'missing');
  assert.equal(states['Voice actors'], 'missing');
  assert.equal(check.partial, 0);
});

test('an english-only segment title counts as partial documentation', () => {
  const half = { ...s3, title: { en: 'Only English', ja: null } };
  const check = episodeFieldChecklist(merged(ep1), half, 3, 3);
  const states = Object.fromEntries(check.groups.flatMap((g) => g.fields.map((f) => [f.label, f.state])));
  assert.equal(states['Title (JA)'], 'partial', 'en present, ja missing');
  assert.equal(check.partial, 1);
});

test('episode-level fields are never counted as segment fields', () => {
  const check = episodeFieldChecklist(merged(ep1), s1, 1, 3);
  assert.deepEqual(
    check.groups[0].fields.map((f) => f.label),
    ['Broadcast date', 'Original language', 'Region', 'Preservation', 'Viewing sources', 'Segments'],
  );
  assert.ok(!check.groups[1].fields.some((f) => f.label === 'Viewing sources'), 'sources are episode-level');
});

test('every chip carries the section it scrolls to', () => {
  const check = episodeFieldChecklist(merged(ep1), s1, 1, 3);
  for (const group of check.groups) {
    for (const f of group.fields) assert.match(f.section, /^[a-z-]+$/);
  }
  const states = Object.fromEntries(check.groups.flatMap((g) => g.fields.map((f) => [f.label, f])));
  assert.equal(states.Characters.section, 'appearances');
  assert.equal(states.Screenshots.section, 'screenshots');
  assert.equal(states['Voice actors'].section, 'voice-cast');
});

test('a single-segment episode labels its group without "of N"', () => {
  const check = episodeFieldChecklist(merged(ep1), s1, 1, 1);
  assert.equal(check.groups[1].label, 'Segment 1');
});

test('a record without sources or dates still yields a full checklist', () => {
  const bare = { id: 'x', segments: [{ id: 'x-01', segmentNumber: 1, title: { en: null, ja: null } }] };
  const check = episodeFieldChecklist(bare, bare.segments[0], 1, 1);
  assert.equal(check.done, 0);
  assert.equal(check.percent, 0);
  assert.equal(check.total, 16);
});

console.log(`\n${passed} assertions passed${process.exitCode ? ' (with failures)' : ''}`);
