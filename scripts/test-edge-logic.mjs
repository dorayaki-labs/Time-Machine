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
import { buildEmbed, buildMessage, sanitize } from '../supabase/functions/_shared/discord.js';
import { checkRoleAction, canReviewContribution, canBanUser, checkSetRoleAction } from '../supabase/functions/_shared/rbac.js';
import { authenticate } from '../supabase/functions/_shared/auth.js';
import { handleManageUsers } from '../supabase/functions/_shared/handlers/manageUsers.js';
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
  schemaVersion: 4, id: 'anime-1979-0004', type: 'episode', seriesId: 'anime-1979', number: 4,
  originalLanguage: 'ja', release: { date: null, precision: null, region: null },
  sources: [],
  segments: [{
    id: 'anime-1979-0004-01', segmentNumber: 1, title: { en: 'Episode 4', ja: null },
    alternateTitles: [], summary: null, description: null, image: { url: null, alt: null },
    screenshots: [], characters: [], gadgets: [], voiceActors: [], durationMinutes: null,
  }],
};

test('valid single-segment episode passes', () => {
  assert.equal(validateEntryRecord(baseEpisode).ok, true);
});

test('valid multi-segment episode passes (stable ids, positional segmentNumber)', () => {
  const reordered = {
    ...baseEpisode,
    segments: [
      { ...baseEpisode.segments[0] },
      { ...baseEpisode.segments[0], id: 'anime-1979-0004-02', segmentNumber: 2, title: { en: 'Story B' } },
    ],
  };
  assert.equal(validateEntryRecord(reordered).ok, true);
  // Reorder: the -02 segment moves first; its stable id stays, numbers follow position.
  const moved = {
    ...reordered,
    segments: [
      { ...reordered.segments[1], segmentNumber: 1 },
      { ...reordered.segments[0], segmentNumber: 2 },
    ],
  };
  assert.equal(validateEntryRecord(moved).ok, true);
});

test('episode without segments fails', () => {
  const { segments, ...bare } = baseEpisode;
  const res = validateEntryRecord(bare);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('segments')));
});

test('bad or duplicate segment ids fail', () => {
  const badId = validateEntryRecord({
    ...baseEpisode,
    segments: [{ ...baseEpisode.segments[0], id: 'segment-1' }],
  });
  assert.equal(badId.ok, false);
  assert.ok(badId.errors.some((e) => e.includes('segment 1') && e.includes('id')));
  const dup = validateEntryRecord({
    ...baseEpisode,
    segments: [
      { ...baseEpisode.segments[0] },
      { ...baseEpisode.segments[0], id: 'anime-1979-0004-01', segmentNumber: 2 },
    ],
  });
  assert.equal(dup.ok, false);
  assert.ok(dup.errors.some((e) => e.includes('duplicate segment id')));
});

test('story fields on the episode record are rejected — title (broadcast name) is the exception', () => {
  // `title` is now the episode's broadcast name and validates fine…
  const named = { ...baseEpisode, title: { en: `Episode ${baseEpisode.number}` } };
  assert.equal(validateEntryRecord(named).ok, true);
  const badTitle = { ...baseEpisode, title: { en: 42 } };
  assert.equal(validateEntryRecord(badTitle).ok, false);
  assert.ok(validateEntryRecord(badTitle).errors.some((e) => e.includes('title')));
  // …while the remaining story fields still belong on segments only.
  const legacy = { ...baseEpisode, summary: 'Leftover story text' };
  const res = validateEntryRecord(legacy);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('"summary"')));
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
  const body = buildEmbed('submitted', {
    number: 12, title: '@everyone <@123> hi', contributor: 'bob', type: 'source', notes: 'ping @here',
  });
  // The title/description and the notes field all go through sanitize().
  assert.ok(!JSON.stringify(body).includes('@everyone'));
  assert.ok(!JSON.stringify(body).includes('@here'));
  assert.ok(body.description.includes('[mention]'));
  assert.ok(body.fields.find((f) => f.name === '🗒️ Notes').value.includes('@\u200bhere'));
  const message = buildMessage('submitted', {});
  assert.deepEqual(message.allowed_mentions, { parse: [] });
});

test('accepted embed includes changes and commit', () => {
  const body = buildEmbed('accepted', {
    number: 12, title: 'Fix title', contributor: 'bob', reviewer: 'checker',
    changes: [{ field: 'title.en', before: 'Old', after: 'New' }],
    commit: 'abc1234def5678abc1234def5678abc1234def56',
  });
  const commit = body.fields.find((f) => f.name === '🔖 Commit');
  assert.ok(commit && commit.value.includes('abc1234') && commit.value.includes('github.com'), 'commit link missing');
  const change = body.fields.find((f) => f.name.startsWith('🟠') && f.name.includes('title.en'));
  assert.ok(change, 'modified change field missing');
  assert.ok(change.value.includes('**Before:** Old') && change.value.includes('**After:** New'));
});

test('embed summaries stay compact and human', () => {
  const submitted = buildEmbed('submitted', { number: 9, title: 'Add source', contributor: 'alice', type: 'source', entry: 'movie-0001' });
  const contributor = submitted.fields.find((f) => f.name === '📝 Contributor');
  assert.ok(contributor && contributor.value.includes('**alice**'), 'contributor identity missing');
  const type = submitted.fields.find((f) => f.name === '🗂️ Submission type');
  const record = submitted.fields.find((f) => f.name === '📦 Record');
  assert.ok(type && type.value.includes('Viewing source'), 'type label missing');
  assert.ok(record && record.value.includes('movie-0001'), 'record missing');
  const role = buildEmbed('role', { target: 'bob', role: 'checker', action: 'granted', actor: 'owner' });
  const roleField = role.fields.find((f) => f.name === '🔐 Role');
  assert.ok(roleField && roleField.value.includes('granted') && roleField.value.includes('checker'), 'role action missing');
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
    record: { ...baseEpisode, segments: [{ ...baseEpisode.segments[0], title: { en: 'Corrected title', ja: '正しいタイトル' } }] },
  });
  assert.equal(res.error, undefined, res.error);
  assert.equal(res.files.length, 1);
  const changes = res.changes.map((c) => c.field).sort();
  assert.deepEqual(changes, ['segments.0.title.en', 'segments.0.title.ja']);
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


// ---------------------------------------------------------------- banning + owner panel
const OWNER = { id: 'u-owner', discord_id: '111', display_name: 'Owner', role: 'owner', banned: false };
const ADMIN = { id: 'u-admin', discord_id: '222', display_name: 'Admin', role: 'admin', banned: false };
const MEMBER = { id: 'u-member', discord_id: '333', display_name: 'Member', role: 'member', banned: false };

function mockBackend() {
  const profiles = new Map([OWNER, ADMIN, MEMBER].map((p) => [p.id, { ...p }]));
  const audits = [];
  const calls = [];
  const db = {
    profileById: async (id) => profiles.get(id) ?? null,
    profileByDiscordId: async (d) => [...profiles.values()].find((p) => p.discord_id === String(d)) ?? null,
    listProfiles: async ({ q, role, banned } = {}) => [...profiles.values()].filter((p) =>
      (!role || p.role === role)
      && (banned === null || banned === undefined || Boolean(p.banned) === banned)
      && (!q || p.display_name.toLowerCase().includes(q.toLowerCase()))),
    contributionCounts: async () => [{ profile_id: MEMBER.id, total_submitted: 4, accepted: 3, pending: 1 }],
    setProfileRole: async (id, role) => { calls.push(['role', id, role]); profiles.get(id).role = role; },
    setBanState: async (id, state) => { calls.push(['ban', id, state.banned]); profiles.get(id).banned = state.banned; },
    insertAudit: async (row) => audits.push(row),
    insert: async () => ({}),
    outboxByKey: async () => null,
    staleOutbox: async () => [],
    markOutbox: async () => ({}),
  };
  const authApi = {
    getUser: async (token) => {
      const profile = [...profiles.values()].find((p) => p.discord_id === token);
      return profile ? { data: { user: { id: profile.id, user_metadata: {} } } } : { error: new Error('nope') };
    },
  };
  const env = { get: (k) => (k === 'ALLOWED_ORIGINS' ? 'https://tm.example' : null) };
  const call = (actor, body) => handleManageUsers(new Request('https://tm.example/functions/v1/manage-users', {
    method: 'POST',
    headers: { origin: 'https://tm.example', authorization: `Bearer ${actor.discord_id}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), { db, authApi, env, webhooks: { main: null, ban: null } });
  return { db, authApi, env, profiles, audits, calls, call };
}

test('authenticate rejects banned users before any handler runs', async () => {
  const { db, authApi, env, profiles } = mockBackend();
  profiles.get('u-member').banned = true;
  const req = new Request('https://tm.example/f', {
    method: 'POST', headers: { origin: 'https://tm.example', authorization: 'Bearer 333' },
  });
  const auth = await authenticate({ authApi, db }, req);
  assert.equal(auth.error?.code, 403);
  assert.ok(auth.error.message.includes('banned'));
});

test('ban helpers: owner protected, admins can ban, guests cannot', () => {
  assert.equal(canBanUser('admin', MEMBER), true);
  assert.equal(canBanUser('admin', OWNER), false, 'owner accounts are protected');
  assert.equal(canBanUser('checker', MEMBER), false);
  assert.equal(canBanUser('member', MEMBER), false);
});

test('set-role guard: owner only, never self, never the owner row', () => {
  assert.equal(checkSetRoleAction(OWNER, MEMBER, 'checker').ok, true);
  assert.equal(checkSetRoleAction(ADMIN, MEMBER, 'checker').ok, false, 'admins cannot set roles from this panel');
  assert.equal(checkSetRoleAction(OWNER, OWNER, 'admin').ok, false, 'cannot change own role');
  assert.equal(checkSetRoleAction(OWNER, { ...MEMBER, role: 'owner' }, 'admin').ok, false, 'owner row immutable');
  assert.equal(checkSetRoleAction(OWNER, MEMBER, 'owner').ok, false, 'owner role never granted here');
  assert.equal(checkSetRoleAction(OWNER, MEMBER, 'wizard').ok, false);
});

test('manage-users: non-owner gets 403, owner can list with stats', async () => {
  const { call } = mockBackend();
  const denied = await call(ADMIN, { action: 'list' });
  assert.equal(denied.status, 403);
  const ok = await call(OWNER, { action: 'list' });
  const body = await ok.json();
  assert.equal(body.ok, true);
  assert.equal(body.users.length, 3);
  const member = body.users.find((u) => u.id === 'u-member');
  assert.equal(member.stats.accepted, 3);
});

test('manage-users: ban / unban round-trip with audit', async () => {
  const { call, profiles, audits } = mockBackend();
  const ban = await call(OWNER, { action: 'ban', userId: 'u-member', reason: 'vandalism' });
  assert.equal((await ban.json()).ok, true);
  assert.equal(profiles.get('u-member').banned, true);
  assert.ok(audits.some((a) => a.action === 'user.banned' && a.review_notes === 'vandalism'));
  const again = await call(OWNER, { action: 'ban', userId: 'u-member' });
  assert.equal(again.status, 409, 'double ban refused');
  const ownerBan = await call(OWNER, { action: 'ban', userId: 'u-owner' });
  assert.equal(ownerBan.status, 403, 'owner cannot be banned');
  const unban = await call(OWNER, { action: 'unban', userId: 'u-member' });
  assert.equal((await unban.json()).ok, true);
  assert.equal(profiles.get('u-member').banned, false);
  assert.ok(audits.some((a) => a.action === 'user.unbanned'));
});

test('manage-users: role change validates and demotes to member', async () => {
  const { call, profiles, audits } = mockBackend();
  const grant = await call(OWNER, { action: 'set-role', userId: 'u-member', role: 'checker' });
  assert.equal((await grant.json()).ok, true);
  assert.equal(profiles.get('u-member').role, 'checker');
  assert.ok(audits.some((a) => a.action === 'role.grant'));
  const demote = await call(OWNER, { action: 'set-role', userId: 'u-member', role: 'member' });
  assert.equal((await demote.json()).ok, true);
  assert.equal(profiles.get('u-member').role, 'member');
  assert.ok(audits.some((a) => a.action === 'role.demote'));
});

test('manage-users: banning by discord id works (staff admin tab path)', async () => {
  const { call, profiles } = mockBackend();
  const res = await call(OWNER, { action: 'ban', discordId: '333', reason: null });
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(profiles.get('u-member').banned, true);
});

test('manage-users: admins can ban and unban, but the directory and roles stay owner-only', async () => {
  const { call, profiles } = mockBackend();
  const deniedList = await call(ADMIN, { action: 'list' });
  assert.equal(deniedList.status, 403, 'the directory stays owner-only');
  const deniedRole = await call(ADMIN, { action: 'set-role', userId: 'u-member', role: 'checker' });
  assert.equal(deniedRole.status, 403, 'role changes stay owner-only');
  const ban = await call(ADMIN, { action: 'ban', userId: 'u-member', reason: 'spam' });
  assert.equal((await ban.json()).ok, true, 'admins can ban');
  assert.equal(profiles.get('u-member').banned, true);
  const unban = await call(ADMIN, { action: 'unban', userId: 'u-member' });
  assert.equal((await unban.json()).ok, true, 'admins can lift bans');
  assert.equal(profiles.get('u-member').banned, false);
  const memberBan = await call(MEMBER, { action: 'ban', userId: 'u-owner' });
  assert.equal(memberBan.status, 403, 'members cannot ban');
  const adminOwnerTarget = await call(ADMIN, { action: 'ban', userId: 'u-owner' });
  assert.equal(adminOwnerTarget.status, 403, 'admins still cannot ban the owner');
  const unknown = await call(ADMIN, { action: 'nope' });
  assert.equal(unknown.status, 400, 'unknown actions are refused before any lookup');
});

await run();
console.log(`\n${passed} test groups passed${process.exitCode ? ' (with failures above)' : ''}.`);
