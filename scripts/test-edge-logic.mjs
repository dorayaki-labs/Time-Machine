// Local tests for the Edge Function business logic (pure modules only —
// these run in Node without Supabase or Deno). The parts that need live
// services (auth, database, deployed functions) are covered by
// scripts/test-backend.mjs against the real deployment.
//
//   npm run test:edge-logic   (or: node scripts/test-edge-logic.mjs)

import assert from 'node:assert/strict';
import { deepDiff, summarizeChanges } from '../supabase/functions/_shared/diff.js';
import {
  validateEntryRecord, validateEntityRecord, validateContributionPayload, isUnsafeUrl,
} from '../supabase/functions/_shared/validate.js';
import { FORM_SPECS } from '../supabase/functions/_shared/formSpec.js';
import { buildEmbed, sanitize } from '../supabase/functions/_shared/discord.js';
import { checkRoleAction, canReviewContribution } from '../supabase/functions/_shared/rbac.js';
import { applyArchivePatch, resolvePaths } from '../supabase/functions/_shared/patch.js';

let passed = 0;
const pending = [];
const test = (name, fn) => {
  pending.push({ name, fn });
};
async function run() {
  for (const { name, fn } of pending) {
    try {
      await fn();
      passed++;
    } catch (err) {
      console.error(`✗ ${name}\n  ${err.message}`);
      process.exitCode = 1;
    }
  }
}

// ---------------------------------------------------------------- diff.js
test('deepDiff reports nested and array changes', () => {
  const before = { title: { en: 'Old', ja: null }, sources: [{ data: 'a.mp4' }], summary: 'x' };
  const after = { title: { en: 'New', ja: '新しい' }, sources: [{ data: 'a.mp4' }, { data: 'b.mp4' }], summary: 'x' };
  const d = deepDiff(before, after);
  const fields = d.map((c) => c.field).sort();
  assert.deepEqual(fields, ['sources.1', 'title.en', 'title.ja']);
  assert.equal(d.find((c) => c.field === 'title.ja').after, '新しい');
});

test('deepDiff returns nothing for identical data', () => {
  assert.equal(deepDiff({ a: [1, 2] }, { a: [1, 2] }).length, 0);
});

test('summarizeChanges caps output', () => {
  const changes = Array.from({ length: 20 }, (_, i) => ({ field: `f${i}`, before: null, after: 'x'.repeat(500) }));
  const s = summarizeChanges(changes, { maxFields: 5, maxLen: 20 });
  assert.ok(s.length <= 6);
  assert.ok(s[s.length - 1].includes('15 more'));
});

// ---------------------------------------------------------------- validate.js
const baseEpisode = {
  schemaVersion: 3, id: 'anime-1979-0004', type: 'episode', seriesId: 'anime-1979', number: 4,
  title: { en: 'Episode 4', ja: null }, sources: [],
};

test('valid episode record passes', () => {
  assert.equal(validateEntryRecord(baseEpisode).ok, true);
});

test('episode with wrong seriesId fails', () => {
  assert.equal(validateEntryRecord({ ...baseEpisode, seriesId: 'movies' }).ok, false);
});

test('episode with malformed date and unsafe source fails', () => {
  const bad = {
    ...baseEpisode,
    release: { date: '1979-13-40', precision: 'day' },
    sources: [{ type: 'direct', data: 'javascript:alert(1)' }],
  };
  const res = validateEntryRecord(bad);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('release.date')));
  assert.ok(res.errors.some((e) => e.includes('source')));
});

test('movie needs durationMinutes as integer when present', () => {
  const movie = { schemaVersion: 3, id: 'movie-0007', type: 'movie', seriesId: 'movies', number: 7, title: { en: 'Movie 7' }, durationMinutes: 90.5 };
  assert.equal(validateEntryRecord(movie).ok, false);
  assert.equal(validateEntryRecord({ ...movie, durationMinutes: 90 }).ok, true);
});

test('character record validation', () => {
  assert.equal(validateEntityRecord({ id: 'char-nobita', name: { en: 'Nobita' }, description: 'x' }, 'character').ok, true);
  assert.equal(validateEntityRecord({ id: 'nonsense', name: { en: 'Nobita' } }, 'character').ok, false);
  assert.equal(validateEntityRecord({ id: 'gadget-door', name: { en: 'Door' }, howItWorks: 'opens' }, 'gadget').ok, true);
});

test('isUnsafeUrl blocks credentials, localhost, weird protocols', () => {
  assert.equal(isUnsafeUrl('https://user:pass@example.com/x'), true);
  assert.equal(isUnsafeUrl('http://localhost/x'), true);
  assert.equal(isUnsafeUrl('ftp://example.com/x'), true);
  assert.equal(isUnsafeUrl('https://example.com/x'), false);
});

test('contribution payload validation mirrors the form rules', () => {
  const spec = FORM_SPECS.source;
  const ok = validateContributionPayload(spec, {
    entryId: 'movie-0001', sourceType: 'direct', data: 'https://example.com/v.mp4',
    subtitles: 'hard', quality: '1080p',
  });
  assert.equal(ok.ok, true);
  const bad = validateContributionPayload(spec, { entryId: 'nope', data: '' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.entryId && bad.errors.data);
  const urls = validateContributionPayload(FORM_SPECS.images, {
    entryId: 'movie-0001', kind: 'image', urls: 'https://a.example/1.png\njavascript:x', alts: 'x', rights: 'own-work',
  });
  assert.equal(urls.ok, false);
});

test('every FORM_SPECS type is one the frontend submits', () => {
  assert.deepEqual(
    Object.keys(FORM_SPECS).sort(),
    ['broken-source', 'character', 'gadget', 'images', 'metadata-correction', 'missing-entry', 'source'],
  );
});

// ---------------------------------------------------------------- discord.js
test('embed sanitizes user text and never allows mentions', () => {
  const embed = buildEmbed('submitted', {
    number: 12, title: '@everyone <@123> hi', contributor: 'bob', type: 'source', notes: 'ping @here',
  });
  const body = embed.embeds[0];
  // The summary line and the notes field both go through sanitize().
  assert.ok(!JSON.stringify(body).includes('@everyone'));
  assert.ok(!JSON.stringify(body).includes('@here'));
  assert.ok(body.description.includes('[mention]'));
  assert.ok(body.fields.find((f) => f.name === 'Notes').value.includes('@\u200bhere'));
  assert.deepEqual(embed.allowed_mentions, { parse: [] });
});

test('accepted embed includes changes and commit', () => {
  const embed = buildEmbed('accepted', {
    number: 12, title: 'Fix title', contributor: 'bob', reviewer: 'checker',
    changes: '• title.en: Old → New', commit: 'abc1234',
  });
  const body = embed.embeds[0];
  assert.ok(body.description.includes('abc1234'));
  // The change list keeps its original bullets — no double "• •".
  const changes = body.fields.find((f) => f.name === 'Changed Fields');
  assert.ok(changes && changes.value.includes('title.en'));
  assert.ok(!changes.value.includes('• •'));
});

test('embed summaries stay compact and human', () => {
  const submitted = buildEmbed('submitted', { number: 9, title: 'Add source', contributor: 'alice', type: 'source', entry: 'movie-0001' });
  assert.ok(submitted.embeds[0].description.includes('**alice**'));
  assert.ok(submitted.embeds[0].description.includes('a viewing source'));
  assert.ok(submitted.embeds[0].description.includes('`movie-0001`'));
  const role = buildEmbed('role', { target: 'bob', role: 'checker', action: 'grant', actor: 'owner' });
  assert.ok(role.embeds[0].description.includes('granted the **checker** role'));
});

// ---------------------------------------------------------------- rbac.js
test('role hierarchy and self-review prevention', () => {
  assert.equal(canReviewContribution('member', 'u1', { contributor_id: 'u1' }), false);
  assert.equal(canReviewContribution('checker', 'u1', { contributor_id: 'u1' }), false);
  assert.equal(canReviewContribution('checker', 'u1', { contributor_id: 'u2' }), true);
  // The owner has ultimate authority, including over their own submissions.
  assert.equal(canReviewContribution('owner', 'u1', { contributor_id: 'u1' }), true);
  assert.equal(checkRoleAction({ role: 'admin' }, 'grant', 'checker').ok, true);
  assert.equal(checkRoleAction({ role: 'admin' }, 'grant', 'admin').ok, false);
  assert.equal(checkRoleAction({ role: 'owner' }, 'grant', 'admin').ok, true);
  assert.equal(checkRoleAction({ role: 'checker' }, 'grant', 'checker').ok, false);
});

// ---------------------------------------------------------------- patch.js
test('resolvePaths derives paths, never trusts the client', () => {
  assert.equal(resolvePaths('episode', 'anime-1979-0004').recordPath, 'public/archive/anime-1979/episodes/0004.json');
  assert.equal(resolvePaths('episode', 'anime-1973-0002').recordPath, 'public/archive/historical/anime-1973/episodes/0002.json');
  assert.equal(resolvePaths('movie', 'movie-0007').recordPath, 'public/archive/movies/0007.json');
  assert.equal(resolvePaths('character', 'char-nobita').arrayPath, 'public/data/characters.json');
  assert.ok(resolvePaths('episode', 'bogus-id').error);
});

const files = {};
const fakeGithub = {
  getJsonFile: async (path) => (path in files ? { content: JSON.parse(files[path]), missing: false } : { content: null, missing: true }),
  commit: async (list, message) => {
    for (const f of list) files[f.path] = f.content;
    lastCommitMessage = message;
    return 'newsha123';
  },
};
let lastCommitMessage = '';

test('update patch diffs, validates and commits the record file', async () => {
  files['public/archive/anime-1979/episodes/0004.json'] = JSON.stringify(baseEpisode);
  const res = await applyArchivePatch(fakeGithub, {
    entityType: 'episode', entityId: 'anime-1979-0004', mode: 'update',
    record: { ...baseEpisode, title: { en: 'Corrected title', ja: '正しいタイトル' } },
  });
  assert.equal(res.error, undefined);
  assert.equal(res.files.length, 1);
  const changes = res.changes.map((c) => c.field).sort();
  assert.deepEqual(changes, ['title.en', 'title.ja']);
});

test('update with identical data is rejected', async () => {
  const res = await applyArchivePatch(fakeGithub, {
    entityType: 'episode', entityId: 'anime-1979-0004', mode: 'update', record: baseEpisode,
  });
  assert.ok(res.error.includes('nothing to change'));
});

test('create patch updates the index atomically', async () => {
  files['public/archive/movies/index.json'] = JSON.stringify({
    schemaVersion: 3, id: 'movies', type: 'series', title: 'Movies', description: '',
    entries: [{ id: 'movie-0001', number: 1, path: '0001.json' }],
  });
  const movie = {
    schemaVersion: 3, id: 'movie-0002', type: 'movie', seriesId: 'movies', number: 2,
    title: { en: 'New movie', ja: null }, sources: [], durationMinutes: 95,
  };
  const res = await applyArchivePatch(fakeGithub, { entityType: 'movie', entityId: 'movie-0002', mode: 'create', record: movie });
  assert.equal(res.error, undefined);
  assert.equal(res.files.length, 2, 'record + index committed together');
  assert.equal(res.indexChanged, true);
  await fakeGithub.commit(res.files, `archive: accept contribution #1 (movie movie-0002)`);
  const index = JSON.parse(files['public/archive/movies/index.json']);
  assert.equal(index.entries.length, 2);
  assert.deepEqual(index.entries[1], { id: 'movie-0002', number: 2, path: '0002.json' });
  assert.ok(lastCommitMessage.includes('movie-0002'));
});

test('create on an existing entity and update on a missing one both fail', async () => {
  files['public/archive/movies/0001.json'] = JSON.stringify({
    schemaVersion: 3, id: 'movie-0001', type: 'movie', seriesId: 'movies', number: 1,
    title: { en: 'Movie 1', ja: null }, sources: [],
  });
  const dupe = await applyArchivePatch(fakeGithub, {
    entityType: 'movie', entityId: 'movie-0001', mode: 'create',
    record: { schemaVersion: 3, id: 'movie-0001', type: 'movie', seriesId: 'movies', number: 1, title: { en: 'Movie 1' }, sources: [] },
  });
  assert.ok(dupe.error.includes('already exists'), dupe.error);
  const missing = await applyArchivePatch(fakeGithub, { entityType: 'episode', entityId: 'anime-1979-9999', mode: 'update', record: { ...baseEpisode, id: 'anime-1979-9999', number: 9999 } });
  assert.ok(missing.error.includes('does not exist'), missing.error);
});

test('character update edits the array file by id', async () => {
  files['public/data/characters.json'] = JSON.stringify([
    { id: 'char-nobita', name: { en: 'Nobita', ja: null }, aliases: [], description: null, category: 'main', image: { url: null, alt: null }, voiceActors: [], firstAppearance: { entryId: null, note: null } },
  ]);
  const record = JSON.parse(files['public/data/characters.json'])[0];
  record.description = 'Protagonist.';
  const res = await applyArchivePatch(fakeGithub, { entityType: 'character', entityId: 'char-nobita', mode: 'update', record });
  assert.equal(res.error, undefined);
  await fakeGithub.commit(res.files, 'test commit');  // handlers commit after applying
  const list = JSON.parse(files['public/data/characters.json']);
  assert.equal(list.length, 1);
  assert.equal(list[0].description, 'Protagonist.');
  assert.deepEqual(res.changes, [{ field: 'description', before: null, after: 'Protagonist.' }]);
});

test('references is stripped from every write', async () => {
  const res = await applyArchivePatch(fakeGithub, {
    entityType: 'character', entityId: 'char-nobita', mode: 'update',
    record: { id: 'char-nobita', name: { en: 'Nobita', ja: null }, description: 'Updated.', references: ['https://example.com'] },
  });
  assert.equal(res.error, undefined);
  await fakeGithub.commit(res.files, 'strip test');
  const stored = JSON.parse(files['public/data/characters.json'])[0];
  assert.equal(stored.description, 'Updated.');
  assert.equal('references' in stored, false, 'references must not survive a commit');
});

test('delete mode removes the episode file and its index entry', async () => {
  files['public/archive/movies/0009.json'] = JSON.stringify({
    schemaVersion: 3, id: 'movie-0009', type: 'movie', seriesId: 'movies', number: 9,
    title: { en: 'Movie 9', ja: null }, sources: [],
  });
  files['public/archive/movies/index.json'] = JSON.stringify({
    schemaVersion: 3, id: 'movies', type: 'series', title: 'Movies', description: '',
    entries: [{ id: 'movie-0001', number: 1, path: '0001.json' }, { id: 'movie-0009', number: 9, path: '0009.json' }],
  });
  const res = await applyArchivePatch(fakeGithub, { entityType: 'movie', entityId: 'movie-0009', mode: 'delete' });
  assert.equal(res.error, undefined);
  assert.ok(res.files.some((f) => f.delete && f.path === 'public/archive/movies/0009.json'));
  const index = JSON.parse(res.files.find((f) => f.path === 'public/archive/movies/index.json').content);
  assert.equal(index.entries.length, 1, 'index entry removed atomically');
});

test('delete mode on an array file removes the record', async () => {
  const res = await applyArchivePatch(fakeGithub, { entityType: 'gadget', entityId: 'gadget-anywhere-door', mode: 'delete' })
    .catch(() => null);
  // gadget file may not exist in this mock — patch one in and retry properly
  files['public/data/gadgets.json'] = JSON.stringify([
    { id: 'gadget-anywhere-door', name: { en: 'Anywhere Door', ja: null }, description: 'A door.' },
    { id: 'gadget-small-light', name: { en: 'Small Light', ja: null }, description: 'A torch.' },
  ]);
  const res2 = await applyArchivePatch(fakeGithub, { entityType: 'gadget', entityId: 'gadget-anywhere-door', mode: 'delete' });
  assert.equal(res2.error, undefined);
  const list = JSON.parse(res2.files[0].content);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'gadget-small-light');
});

test('baseRecord freshness check rejects edits made against stale data', async () => {
  files['public/archive/movies/0001.json'] = JSON.stringify({
    schemaVersion: 3, id: 'movie-0001', type: 'movie', seriesId: 'movies', number: 1,
    title: { en: 'Movie 1 (current)', ja: null }, sources: [],
  });
  const staleBase = {
    schemaVersion: 3, id: 'movie-0001', type: 'movie', seriesId: 'movies', number: 1,
    title: { en: 'Movie 1 (stale)', ja: null }, sources: [],
  };
  const res = await applyArchivePatch(fakeGithub, {
    entityType: 'movie', entityId: 'movie-0001', mode: 'update',
    record: { ...staleBase, title: { en: 'Movie 1 (edited)', ja: null } },
    baseRecord: staleBase,
  });
  assert.ok(res.error.includes('changed since it was loaded'), res.error);
});

await run();
console.log(`\n${passed} test groups passed${process.exitCode ? ' (with failures above)' : ''}.`);
