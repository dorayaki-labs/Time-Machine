// The data layer. Everything in the UI reads archive data through this module.
//
// The record files under public/archive/ are the single source of truth: the
// app fetches the small index rosters (id, number, path) once per session and
// then every record file itself, merging each record over its roster entry.
// Editing a record file is therefore visible everywhere — cards, search, the
// detail page — after a refresh, with no second copy to keep in sync.

import { normalizeSources, availabilityFor } from './sources.js';
import { computeStatus } from './records.js';

const BASE = import.meta.env.BASE_URL || '/';

// ---- where the archive JSON is read from ------------------------------------
//
// The repository is the single source of truth, and JSON commits no longer
// redeploy the site. The browser therefore reads the archive directly from
// GitHub (raw.githubusercontent.com) instead of from the deployed site:
//
//   1. The current HEAD sha of the main branch is resolved once (cached in
//      sessionStorage for 3 minutes) from the GitHub API.
//   2. Every file is fetched from raw.githubusercontent.com with ?v=<sha>.
//      Between commits the sha never changes, so every file is served from
//      the browser cache with zero network requests. After a commit the sha
//      changes, every URL changes, and no stale copy can be served — this is
//      what makes archive edits visible without a rebuild.
//   3. If GitHub cannot be reached, every file falls back to the copy bundled
//      with the deployed site, so the archive keeps working offline.
//
// In dev the site copy is used directly (edits show up instantly, no GitHub
// round trip). VITE_ARCHIVE_REPO / VITE_ARCHIVE_BRANCH override the defaults
// for forks.
const ARCHIVE_REPO = import.meta.env.VITE_ARCHIVE_REPO || 'karizzmaa/time-machine';
const ARCHIVE_BRANCH = import.meta.env.VITE_ARCHIVE_BRANCH || 'main';
const SHA_CACHE_KEY = 'tm-archive-head';
const SHA_CACHE_TTL = 3 * 60_000;

async function archiveHeadSha() {
  const cached = sessionStorage.getItem(SHA_CACHE_KEY);
  if (cached) {
    try {
      const { sha, ts } = JSON.parse(cached);
      if (sha && Date.now() - ts < SHA_CACHE_TTL) return sha;
    } catch { /* re-resolve */ }
  }
  const res = await fetch(`https://api.github.com/repos/${ARCHIVE_REPO}/commits/${ARCHIVE_BRANCH}`, {
    headers: { accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const sha = (await res.json())?.sha;
  if (!sha) throw new Error('GitHub API returned no sha');
  sessionStorage.setItem(SHA_CACHE_KEY, JSON.stringify({ sha, ts: Date.now() }));
  return sha;
}

let sourcePromise = null;

function archiveSource() {
  if (!sourcePromise) {
    sourcePromise = (async () => {
      if (import.meta.env.DEV) return { prefix: BASE, bust: '' };
      try {
        const sha = await archiveHeadSha();
        return {
          prefix: `https://raw.githubusercontent.com/${ARCHIVE_REPO}/${ARCHIVE_BRANCH}/public`,
          bust: `?v=${sha}`,
        };
      } catch (err) {
        console.warn('Time Machine: archive HEAD unavailable, using the deployed site copy', err);
        return { prefix: BASE, bust: '' };
      }
    })();
  }
  return sourcePromise;
}

/** Drops the resolved archive source so the next load re-resolves HEAD. */
export function resetArchiveSource() {
  sourcePromise = null;
  try { sessionStorage.removeItem(SHA_CACHE_KEY); } catch { /* private mode */ }
}

async function fetchJson(path) {
  const { prefix, bust } = await archiveSource();
  if (prefix !== BASE) {
    try {
      const res = await fetch(`${prefix}/${path}${bust}`, { headers: { accept: 'application/json' } });
      if (res.ok) return res.json();
      console.warn(`Time Machine: ${path} unavailable from GitHub (${res.status}), using the deployed site copy`);
    } catch { /* fall through to the bundled copy */ }
  }
  const response = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
}

export const SERIES = {
  'anime-1979': { id: 'anime-1979', kind: 'episode', label: 'Anime (1979)', short: '1979', basePath: '/anime/1979', historical: false, yearsCovered: '1979–2005' },
  'anime-2005': { id: 'anime-2005', kind: 'episode', label: 'Anime (2005)', short: '2005', basePath: '/anime/2005', historical: false, yearsCovered: '2005–Present' },
  movies: { id: 'movies', kind: 'movie', label: 'Movies', short: 'Movies', basePath: '/movies', historical: false, yearsCovered: '1980–Present' },
  'anime-1973': { id: 'anime-1973', kind: 'episode', label: 'Anime (1973)', short: '1973', basePath: '/historical/1973', historical: true, yearsCovered: '1973–1974' },
};
export const SERIES_IDS = ['anime-1979', 'anime-2005', 'movies'];
export const HISTORICAL_IDS = ['anime-1973'];

const INDEX_PATHS = {
  'anime-1979': 'archive/anime-1979/index.json',
  'anime-2005': 'archive/anime-2005/index.json',
  movies: 'archive/movies/index.json',
  'anime-1973': 'archive/historical/anime-1973/index.json',
};

const state = {
  loaded: false,
  entries: [],
  entriesById: new Map(),
  series: new Map(),
  rawEntries: new Map(),
  characters: [],
  gadgets: [],
  languages: [],
  categories: {},
  relations: null,
};

let loadPromise = null;

/**
 * Merges a record file over its roster entry. The record wins on every field
 * it defines; the roster only supplies identity (id, number, path) and the
 * routing the UI needs. Derived fields (normalized sources, availability,
 * status) are computed here so no component ever sees raw editor input.
 */
function mergeEntry(rosterEntry, record, seriesId, meta) {
  const base = {
    id: rosterEntry.id,
    number: rosterEntry.number,
    path: rosterEntry.path,
    seriesId,
    kind: meta.kind,
    url: `${meta.basePath}/${rosterEntry.id}`,
  };
  const entry = { ...base, ...(record ?? {}) };
  entry.characters = Array.isArray(entry.characters) ? entry.characters : [];
  entry.gadgets = Array.isArray(entry.gadgets) ? entry.gadgets : [];
  entry.languages = Array.isArray(entry.languages) ? entry.languages : [];
  entry.alternateTitles = Array.isArray(entry.alternateTitles) ? entry.alternateTitles : [];
  entry.image = entry.image && typeof entry.image === 'object' ? entry.image : { url: null, alt: null };
  entry.sources = normalizeSources(entry.sources);
  entry.availability = availabilityFor(entry.sources);
  entry.status = computeStatus(entry);
  return entry;
}

async function buildState() {
  const [idx79, idx05, idxMovies, idx73, characters, gadgets, languages, categories] = await Promise.all([
    fetchJson(INDEX_PATHS['anime-1979']),
    fetchJson(INDEX_PATHS['anime-2005']),
    fetchJson(INDEX_PATHS.movies),
    fetchJson(INDEX_PATHS['anime-1973']),
    fetchJson('data/characters.json'),
    fetchJson('data/gadgets.json'),
    fetchJson('data/languages.json'),
    fetchJson('data/categories.json'),
  ]);

  const indexes = { 'anime-1979': idx79, 'anime-2005': idx05, movies: idxMovies, 'anime-1973': idx73 };

  // Every record file, fetched in parallel. A missing or damaged file fails
  // alone: that entry shows up as an untitled skeleton instead of taking the
  // whole archive down.
  const recordsBySeries = {};
  await Promise.all(Object.entries(indexes).flatMap(([id, index]) =>
    (index.entries ?? []).map(async (rosterEntry) => {
      const dir = SERIES[id].historical ? 'archive/historical/' : 'archive/';
      try {
        (recordsBySeries[id] ??= {})[rosterEntry.id] = await fetchJson(`${dir}${id}/${rosterEntry.path}`);
      } catch (error) {
        console.warn(`Time Machine: record for ${rosterEntry.id} could not be loaded`, error);
      }
    })));

  // Raw record files, exactly as stored in the repository. The staff editor
  // commits against THESE — the merged entry carries derived fields (path,
  // kind, forced arrays, normalized sources) that never exist in the file,
  // so using it as an edit base fails the server's concurrency check.
  state.rawEntries = new Map(Object.values(recordsBySeries).flatMap((recs) => Object.entries(recs)));

  // Raw record files, exactly as stored in the repository. The staff editor
  // commits against THESE — the merged entry carries derived fields (path,
  // kind, forced arrays, normalized sources) that never exist in the file,
  // so using it as an edit base fails the server's concurrency check.
  state.rawEntries = new Map(Object.values(recordsBySeries).flatMap((recs) => Object.entries(recs)));

  state.entries = [];
  state.entriesById = new Map();

  for (const [id, meta] of Object.entries(SERIES)) {
    const index = indexes[id];
    const records = recordsBySeries[id] ?? {};
    const entries = (index.entries ?? []).map((rosterEntry) => mergeEntry(rosterEntry, records[rosterEntry.id], id, meta));
    for (const entry of entries) state.entriesById.set(entry.id, entry);
    state.series.set(id, {
      ...meta,
      title: index.title ?? meta.label,
      description: index.description ?? '',
      entries,
    });
    state.entries.push(...entries);
  }

  state.characters = characters;
  state.gadgets = gadgets;
  state.languages = languages;
  state.categories = categories;
  state.relations = null;
  state.loaded = true;
}

/** Loads the catalogue once. Concurrent callers share the same request. */
export function loadCatalog() {
  if (!loadPromise) {
    loadPromise = buildState().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}

/**
 * Drops everything and reloads the catalogue from GitHub. Called after a
 * staff edit (accept, direct edit, delete) so the live UI reflects the
 * repository's new state without a page reload.
 */
export function reloadCatalog() {
  state.loaded = false;
  state.entries = [];
  state.entriesById = new Map();
  state.series = new Map();
  state.rawEntries = new Map();
  loadPromise = null;
  resetArchiveSource();
  return loadCatalog();
}

export const isCatalogReady = () => state.loaded;

export const getSeries = (seriesId) => state.series.get(seriesId)
  ?? { ...SERIES[seriesId], title: SERIES[seriesId].label, description: '', entries: [] };
export const getEntries = (seriesId) => getSeries(seriesId).entries;
export const getAllEntries = () => state.entries;
export const getEntry = (id) => state.entriesById.get(id) ?? null;

/**
 * Full record behind an entry (or an entry id). Records are merged into the
 * catalogue at load time, so this simply resolves to the merged entry.
 * Resolves to null when the id is unknown.
 */
export async function loadRecord(entryOrId) {
  const entry = typeof entryOrId === 'string' ? getEntry(entryOrId) : entryOrId;
  return entry ?? null;
}

/**
 * The RAW record file behind an entry id, exactly as stored in the repository
 * (no roster merge, no derived fields). This is what editing and committing
 * must round-trip through. Null when the id is unknown or its file failed to
 * load.
 */
export const getRawEntry = (id) => state.rawEntries.get(id) ?? null;

/** Previous and next documented entry in the same catalogue. Gaps in numbering are fine. */
export function getNeighbors(entry) {
  const list = [...getEntries(entry.seriesId)].sort((a, b) => a.number - b.number);
  const i = list.findIndex((e) => e.id === entry.id);
  return { previous: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
}

/** Newest entries first, interleaved across the main catalogues so no single one dominates. */
export function getRecentlyAdded(limit = 8) {
  const groups = SERIES_IDS.map((id) =>
    [...getEntries(id)].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || b.number - a.number));
  const out = [];
  for (let i = 0; out.length < limit && groups.some((g) => i < g.length); i += 1) {
    for (const g of groups) if (g[i] && out.length < limit) out.push(g[i]);
  }
  return out;
}

// ---------- characters, gadgets, languages, categories ----------
export const getCharacters = () => state.characters;
export const getCharacter = (id) => state.characters.find((c) => c.id === id) ?? null;
export const getGadgets = () => state.gadgets;
export const getGadget = (id) => state.gadgets.find((g) => g.id === id) ?? null;
export const getLanguages = () => state.languages;
export const getLanguage = (code) => state.languages.find((l) => l.code === code) ?? null;
export const languageName = (code) => getLanguage(code)?.name ?? code;
export const getCategories = () => state.categories;

const labelFrom = (list, id) => list.find((x) => x.id === id)?.label ?? id;
export const characterCategoryLabel = (id) => labelFrom(state.categories.characterCategories ?? [], id);
export const metadataStatusLabel = (id) => labelFrom(state.categories.metadataStatuses ?? [], id);
export const sourceStatusLabel = (id) => labelFrom(state.categories.sourceStatuses ?? [], id);
export const sourceTypeLabel = (id) => labelFrom(state.categories.sourceTypes ?? [], id);

export const PRESERVATION_STATUSES = [
  { id: 'extant', label: 'Survives' },
  { id: 'partial', label: 'Partially survives' },
  { id: 'lost', label: 'Lost' },
];
export const preservationLabel = (id) => labelFrom(PRESERVATION_STATUSES, id);

// ---------- relationships (derived from IDs in the records) ----------
function buildRelations() {
  if (state.relations) return state.relations;
  const byCharacter = new Map();
  const byGadget = new Map();
  const push = (map, key, entry) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  };
  for (const e of state.entries) {
    e.characters.forEach((id) => push(byCharacter, id, e));
    e.gadgets.forEach((id) => push(byGadget, id, e));
  }
  state.relations = { byCharacter, byGadget };
  return state.relations;
}

function split(entries) {
  const sorted = [...entries].sort((a, b) => a.number - b.number);
  return {
    all: sorted,
    movies: sorted.filter((e) => e.kind === 'movie'),
    episodes: sorted.filter((e) => e.kind === 'episode'),
    bySeries: (id) => sorted.filter((e) => e.seriesId === id),
  };
}

export const getEntriesForCharacter = (id) => split(buildRelations().byCharacter.get(id) ?? []);
export const getEntriesForGadget = (id) => split(buildRelations().byGadget.get(id) ?? []);

/** Which catalogues (and which movies) a character or gadget appears in. */
export function getAppearanceSummary(kind, id) {
  const { byCharacter, byGadget } = buildRelations();
  const entries = (kind === 'character' ? byCharacter : byGadget).get(id) ?? [];
  return {
    series: new Set(entries.map((e) => e.seriesId)),
    movies: new Set(entries.filter((e) => e.kind === 'movie').map((e) => e.id)),
  };
}

/** Gadgets that most often share an entry with this character. */
export function getGadgetsForCharacter(characterId, limit = 6) {
  const counts = new Map();
  for (const e of buildRelations().byCharacter.get(characterId) ?? []) {
    e.gadgets.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1));
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => getGadget(id)).filter(Boolean);
}

/** Gadgets that appear together with this one. */
export function getRelatedGadgets(gadgetId, limit = 4) {
  const counts = new Map();
  for (const e of buildRelations().byGadget.get(gadgetId) ?? []) {
    e.gadgets.filter((g) => g !== gadgetId).forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1));
  }
  return state.gadgets
    .filter((g) => g.id !== gadgetId)
    .map((g) => ({ g, score: counts.get(g.id) ?? 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.g);
}

/** Movies similar to this one by shared gadgets and characters. */
export function getRelatedMovies(movieEntry, limit = 4) {
  return getEntries('movies')
    .filter((m) => m.id !== movieEntry.id)
    .map((m) => ({
      m,
      score: m.gadgets.filter((g) => movieEntry.gadgets.includes(g)).length * 2 + m.characters.filter((c) => movieEntry.characters.includes(c)).length,
    }))
    .sort((a, b) => b.score - a.score || Math.abs(a.m.number - movieEntry.number) - Math.abs(b.m.number - movieEntry.number))
    .slice(0, limit)
    .map((x) => x.m);
}

// ---------- titles ----------
const titleText = (t) => (typeof t === 'string' ? t : t?.en || t?.ja || '');

/** The title to display: English first, Japanese as the fallback. Tolerates a plain-string title. */
export function displayTitle(entry) {
  return titleText(entry?.title) || 'Untitled entry';
}

/** The Japanese title as a secondary line, or null when there is nothing distinct to show. */
export function secondaryTitle(entry) {
  const t = entry?.title;
  if (!t || typeof t === 'string') return null;
  return t.en && t.ja ? t.ja : null;
}
