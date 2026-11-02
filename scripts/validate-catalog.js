#!/usr/bin/env node
// Validates every JSON file under public/archive and public/data against
// schema 3. Exits with code 1 when something is structurally wrong. Missing
// summaries, images or dates are allowed: an honest empty field beats an
// invented one.
//
// Schema 3 in one line: the record files are the single source of truth and
// index.json is only a roster ({id, number, path}). Metadata status and
// availability are computed by the app, so records must NOT carry a "status"
// field any more.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public');
const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);
const warn = (file, msg) => warnings.push(`${relative(ROOT, file)}: ${msg}`);

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    err(file, `invalid JSON (${e.message})`);
    return null;
  }
}

const categories = readJson(join(DATA, 'data/categories.json'));
const characters = readJson(join(DATA, 'data/characters.json')) ?? [];
const gadgets = readJson(join(DATA, 'data/gadgets.json')) ?? [];
const languages = readJson(join(DATA, 'data/languages.json')) ?? [];

const ids = (list, key = 'id') => (categories?.[list] ?? []).map((x) => x[key]);
const CHAR_IDS = new Set(characters.map((c) => c.id));
const GADGET_IDS = new Set(gadgets.map((g) => g.id));
const PRESERVATION = new Set(['extant', 'partial', 'lost']);
const SCHEMA = 3;
const SOURCE_TYPES = new Set(['direct', 'embed']);

const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const ENTRY_ID = /^(anime-(1979|2005|1973)-\d{4}|movie-\d{4})$/;

const CATALOGUES = [
  { dir: 'archive/anime-1979', id: 'anime-1979', kind: 'episode' },
  { dir: 'archive/anime-2005', id: 'anime-2005', kind: 'episode' },
  { dir: 'archive/movies', id: 'movies', kind: 'movie' },
  { dir: 'archive/historical/anime-1973', id: 'anime-1973', kind: 'episode', historical: true },
];

const seenIds = new Set();
let entryCount = 0;

function checkImage(file, image) {
  if (image === undefined || image === null) return;
  if (typeof image !== 'object' || Array.isArray(image)) { err(file, 'image must be an object { url, alt } or null'); return; }
  if (image.url !== null && image.url !== undefined && typeof image.url !== 'string') err(file, 'image.url must be a string or null');
  if (image.alt !== null && image.alt !== undefined && typeof image.alt !== 'string') err(file, 'image.alt must be a string or null');
}

function checkSources(file, record) {
  const sources = record.sources ?? [];
  if (typeof sources === 'string') {
    warn(file, 'sources is a bare string — write an array: [{ "type": "direct", "data": "…" }]. The app copes, but fix the shape.');
    return;
  }
  if (!Array.isArray(sources)) { err(file, 'sources must be an array of { type, data } entries'); return; }
  sources.forEach((s, i) => {
    const at = `source ${i + 1}`;
    if (!s || typeof s !== 'object' || Array.isArray(s)) { err(file, `${at}: each entry must be an object { type, data }`); return; }
    if (typeof s.data !== 'string' || !s.data.trim()) { err(file, `${at}: "data" is required (a URL or iframe code)`); }
    else if (!/^(https?:)?\/\//.test(s.data.trim()) && !s.data.trim().startsWith('<')) {
      err(file, `${at}: "data" should be an http(s) URL or an <iframe> snippet`);
    }
    if (s.type === undefined) warn(file, `${at}: no "type" — the app guesses (add "direct" or "embed" to be explicit)`);
    else if (!SOURCE_TYPES.has(String(s.type).toLowerCase())) err(file, `${at}: unknown type "${s.type}" (use "direct" or "embed")`);
    if (s.url !== undefined) warn(file, `${at}: legacy "url" field — rename it to "data"`);
    for (const key of ['label', 'language', 'quality', 'notes']) {
      if (s[key] !== undefined && s[key] !== null && typeof s[key] !== 'string') err(file, `${at}: "${key}" must be a string`);
    }
    const subs = s.subtitles;
    if (subs !== undefined && subs !== null && typeof subs !== 'string' && typeof subs !== 'boolean' && typeof subs !== 'object') {
      err(file, `${at}: "subtitles" must be "none"/"hard"/"soft", true/false, or { has, type, languages }`);
    } else if (subs && typeof subs === 'object' && !Array.isArray(subs)) {
      if (subs.has !== undefined && typeof subs.has !== 'boolean') err(file, `${at}: subtitles.has must be true or false`);
      if (subs.type !== undefined && !['hard', 'soft', 'none', null].includes(subs.type)) err(file, `${at}: subtitles.type must be "hard", "soft", "none", or null`);
      if (subs.languages !== undefined && !Array.isArray(subs.languages)) err(file, `${at}: subtitles.languages must be an array of names`);
    }
    if (s.status !== undefined) warn(file, `${at}: "status" is not a source field — the app computes availability itself`);
  });
}

function checkRecord(file, record, cat) {
  if (record.schemaVersion !== SCHEMA) err(file, `schemaVersion must be ${SCHEMA}`);
  if (!cat.historical && !ENTRY_ID.test(record.id)) err(file, `id "${record.id}" does not match the entry id pattern`);
  if (seenIds.has(record.id)) err(file, `duplicate id "${record.id}"`);
  seenIds.add(record.id);
  if (record.type !== cat.kind) err(file, `type must be "${cat.kind}"`);
  if (record.seriesId !== cat.id) err(file, `seriesId must be "${cat.id}"`);
  if (!Number.isInteger(record.number)) err(file, 'number must be an integer');
  const title = record.title;
  const hasTitle = typeof title === 'string' ? title.trim() : Boolean(title?.en || title?.ja);
  if (!hasTitle) err(file, 'title needs at least one language (a string, or { en, ja })');
  if ('status' in record) warn(file, 'records no longer carry "status" — the app computes it from the filled fields; remove this field');
  if ('availability' in record || 'sourceCount' in record) warn(file, 'availability/sourceCount are derived from sources — remove them from the record');
  const release = record.release ?? {};
  if (release.date !== null && release.date !== undefined && !DATE.test(release.date)) err(file, `release.date "${release.date}" is not YYYY-MM-DD, YYYY-MM or YYYY`);
  if (release.precision !== undefined && !['day', 'month', 'year'].includes(release.precision)) err(file, `release.precision "${release.precision}" is invalid`);
  (record.characters ?? []).forEach((id) => { if (!CHAR_IDS.has(id)) err(file, `unknown character "${id}"`); });
  (record.gadgets ?? []).forEach((id) => { if (!GADGET_IDS.has(id)) err(file, `unknown gadget "${id}"`); });
  if ('category' in record) err(file, 'records carry no category field');
  checkImage(file, record.image);
  checkSources(file, record);
  if (cat.historical && record.preservation && !PRESERVATION.has(record.preservation)) err(file, `unknown preservation "${record.preservation}"`);
  entryCount += 1;
}

function checkCatalogue(cat) {
  const indexFile = join(DATA, cat.dir, 'index.json');
  const index = readJson(indexFile);
  if (!index) return;
  if (index.schemaVersion !== SCHEMA) err(indexFile, `schemaVersion must be ${SCHEMA}`);
  if (index.id !== cat.id) err(indexFile, `index id must be "${cat.id}"`);

  const numbers = new Set();
  for (const e of index.entries ?? []) {
    if (!ENTRY_ID.test(e.id ?? '')) err(indexFile, `roster entry id "${e.id}" does not match the pattern`);
    if (!Number.isInteger(e.number)) err(indexFile, `entry ${e.id}: roster "number" must be an integer`);
    if (typeof e.path !== 'string' || !e.path) err(indexFile, `entry ${e.id}: roster "path" is required`);
    if (numbers.has(e.number)) err(indexFile, `duplicate number ${e.number}`);
    numbers.add(e.number);
    for (const stale of ['title', 'release', 'availability', 'sourceCount', 'status', 'languages', 'characters', 'gadgets', 'updatedAt']) {
      if (stale in e) warn(indexFile, `entry ${e.id}: roster entries carry only {id, number, path} — "${stale}" is ignored, edit the record file`);
    }
    const recordFile = join(DATA, cat.dir, e.path ?? '');
    if (!existsSync(recordFile)) { err(indexFile, `entry ${e.id}: file "${e.path}" does not exist`); continue; }
    const record = readJson(recordFile);
    if (!record) continue;
    checkRecord(recordFile, record, cat);
    if (record.id !== e.id) err(recordFile, `id does not match the roster entry "${e.id}"`);
    if (record.number !== e.number) err(recordFile, `number does not match the roster entry (${e.number})`);
  }

  // Records that exist on disk but are missing from the roster would be invisible to the site.
  const sub = cat.kind === 'movie' ? '.' : 'episodes';
  const dir = join(DATA, cat.dir, sub);
  if (existsSync(dir)) {
    for (const name of sub === '.' ? readdirSync(dir) : readdirSync(dir)) {
      if (!name.endsWith('.json') || name === 'index.json') continue;
      const path = sub === '.' ? name : `episodes/${name}`;
      if (!(index.entries ?? []).some((e) => e.path === path)) err(join(DATA, cat.dir, path), 'record exists but is not listed in index.json');
    }
  }
}

for (const cat of CATALOGUES) checkCatalogue(cat);

// characters / gadgets
characters.forEach((c) => {
  const file = join(DATA, 'data/characters.json');
  if (!c.id || !/^[a-z0-9-]+$/.test(c.id)) err(file, `character id "${c.id}" must be lowercase and hyphenated`);
  if (!c.name?.en) err(file, `character ${c.id}: name.en is required`);
  if (!(categories?.characterCategories ?? []).some((x) => x.id === c.category)) err(file, `character ${c.id}: unknown category "${c.category}"`);
  checkImage(file, c.image);
});
gadgets.forEach((g) => {
  const file = join(DATA, 'data/gadgets.json');
  if (!g.id || !/^[a-z0-9-]+$/.test(g.id)) err(file, `gadget id "${g.id}" must be lowercase and hyphenated`);
  if (!g.name?.en) err(file, `gadget ${g.id}: name.en is required`);
  if ('category' in g) err(file, `gadget ${g.id}: gadgets carry no category`);
  checkImage(file, g.image);
});

for (const e of errors) console.error(`  ✗ ${e}`);
for (const w of warnings) console.warn(`  ⚠ ${w}`);
console.log(`Catalogue ${errors.length ? 'has errors' : 'is valid'}. ${entryCount} entries, ${characters.length} characters, ${gadgets.length} gadgets.`);
if (errors.length) {
  console.error(`\n${errors.length} error(s) found.`);
  process.exit(1);
}
