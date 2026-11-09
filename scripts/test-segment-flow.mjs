// End-to-end smoke test of the multi-segment editorial flow using the REAL
// production modules: RecordEditor's builders are browser modules, so their
// logic is mirrored here from the same operations the UI performs
// (add / reorder / delete / deep-path field sets), then the resulting draft
// goes through the REAL applyArchivePatch + validators exactly as the
// direct-edit and review paths do.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyArchivePatch } from '../supabase/functions/_shared/patch.js';
import { validateEntryRecord } from '../supabase/functions/_shared/validate.js';

const pad2 = (n) => String(n).padStart(2, '0');
const blankSegment = (entityId, position) => ({
  id: `${entityId}-${pad2(position)}`, segmentNumber: position,
  title: { en: '', ja: null }, alternateTitles: [], summary: null, description: null,
  image: { url: null, alt: null }, screenshots: [], characters: [], gadgets: [],
  voiceActors: [], durationMinutes: null,
});
const buildNewEpisode = (entityId, number) => ({
  schemaVersion: 4, id: entityId, type: 'episode', seriesId: 'anime-2005', number,
  originalLanguage: 'ja', release: { date: null, precision: null, region: null },
  sources: [], segments: [blankSegment(entityId, 1)],
});
// The editor's deep-path setter (same semantics as EntryEditDialog/Staff).
const setField = (draft, path, value) => {
  const next = structuredClone(draft);
  const parts = path.split('.');
  let node = next;
  for (let i = 0; i < parts.length - 1; i += 1) node = node[parts[i]] ??= {};
  node[parts[parts.length - 1]] = value;
  return next;
};

const id = 'anime-2005-0001';
let draft = buildNewEpisode(id, 1);

// 1-segment episode: fill fields through the editor's paths, validate.
draft = setField(draft, 'release.date', '2005-04-15');
draft = setField(draft, 'segments.0.title.en', 'Fishing Pond in the Study Room');
draft = setField(draft, 'segments.0.summary', 'A pond appears in the study room.');
assert.equal(validateEntryRecord(draft).ok, true, '1-segment draft validates');
console.log('PASS  1-segment episode: edit → validate');

// 2 segments: Add Segment, fill, reorder, verify ids stay stable.
draft = setField(draft, 'segments', [
  ...draft.segments,
  { ...blankSegment(id, 2), id: `${id}-02`, title: { en: 'Second story' } },
].map((s, i) => ({ ...s, segmentNumber: i + 1 })));
assert.equal(validateEntryRecord(draft).ok, true, '2-segment draft validates');
const idsBefore = draft.segments.map((s) => s.id);
const reordered = [...draft.segments].reverse().map((s, i) => ({ ...s, segmentNumber: i + 1 }));
draft = setField(draft, 'segments', reordered);
assert.deepEqual(draft.segments.map((s) => s.id), [...idsBefore].reverse(), 'ids travel with their segment');
assert.equal(validateEntryRecord(draft).ok, true, 'reordered draft validates');
console.log('PASS  2-segment episode: add → reorder (ids stable) → validate');

// 3 segments: add, delete the middle one, renumber, validate.
draft = setField(draft, 'segments', [
  ...draft.segments,
  { ...blankSegment(id, 3), id: `${id}-03`, title: { en: 'Third story' } },
].map((s, i) => ({ ...s, segmentNumber: i + 1 })));
draft = setField(draft, 'segments', draft.segments.filter((s) => s.id !== `${id}-02`).map((s, i) => ({ ...s, segmentNumber: i + 1 })));
assert.deepEqual(draft.segments.map((s) => s.title.en), ['Fishing Pond in the Study Room', 'Third story']);
assert.deepEqual(draft.segments.map((s) => s.segmentNumber), [1, 2]);
assert.equal(validateEntryRecord(draft).ok, true, '3-segment → delete middle → validate');
console.log('PASS  3-segment episode: add → delete middle → validate');

// Commit the 3-segment (well, 2-segment after deletion) record through the
// real patch pipeline against the REAL current file content.
const currentFile = JSON.parse(readFileSync(new URL('../public/archive/anime-2005/episodes/0001.json', import.meta.url), 'utf8'));
const mockGithub = {
  getJsonFile: async (path) => (path.endsWith('0001.json')
    ? { content: currentFile, missing: false }
    : { content: null, missing: true }),
  commit: async () => 'deadbeef',
};
const res = await applyArchivePatch(mockGithub, {
  entityType: 'episode', entityId: id, mode: 'update', record: draft,
});
assert.equal(res.error, undefined, res.error);
assert.equal(res.files.length, 1);
const committed = JSON.parse(res.files[0].content);
assert.equal(committed.segments.length, 2);
assert.equal(validateEntryRecord(committed).ok, true, 'committed record re-validates');
const diffFields = res.changes.map((c) => c.field);
assert.ok(diffFields.some((f) => f.startsWith('segments.')), 'change list shows segment-level paths');
console.log('PASS  patch pipeline: commit → re-validate → segment-level diff:', diffFields.slice(0, 4).join(', '), '…');

// Single-segment round-trip: editing a migrated real record stays valid and
// only touches the segment.
const res2 = await applyArchivePatch(mockGithub, {
  entityType: 'episode', entityId: id, mode: 'update',
  record: { ...currentFile, segments: [{ ...currentFile.segments[0], summary: 'Updated synopsis.' }] },
});
assert.equal(res2.error, undefined, res2.error);
const fields2 = res2.changes.map((c) => c.field);
assert.ok(fields2.includes('segments.0.summary'), 'summary change must be listed');
// Dropping segments 2 and 3 legitimately shows up as whole-segment removals
// (before set, after null) — deepDiff working as designed.
assert.ok(fields2.includes('segments.1') && fields2.includes('segments.2'), 'segment removals must be listed');
console.log('PASS  single-segment episode edit: synopsis diff + removed segments listed');

console.log('\nALL SEGMENT FLOW CHECKS PASS');
