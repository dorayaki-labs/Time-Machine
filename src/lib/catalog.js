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
const ARCHIVE_REPO = import.meta.env.VITE_ARCHIVE_REPO || 'dorayaki-labs/time-machine';
const ARCHIVE_BRANCH = import.meta.env.VITE_ARCHIVE_BRANCH || 'main';
const SHA_CACHE_KEY = 'tm-archive-head';
// Short on purpose: the HEAD lookup is one tiny unauthenticated API request,
// and this window is how long a visitor can look at a stale archive after a
// commit before a reload / tab focus refreshes it.
const SHA_CACHE_TTL = 45_000;

let resolvedSha = null;

async function archiveHeadSha({ force = false } = {}) {
  if (!force) {
    const cached = sessionStorage.getItem(SHA_CACHE_KEY);
    if (cached) {
      try {
        const { sha, ts } = JSON.parse(cached);
        if (sha && Date.now() - ts < SHA_CACHE_TTL) return sha;
      } catch { /* re-resolve */ }
    }
  }
  const res = await fetch(`https://api.github.com/repos/${ARCHIVE_REPO}/commits/${ARCHIVE_BRANCH}`, {
    headers: { accept: 'application/vnd.github+json' },
    // Never let the HTTP cache answer the freshness question for us.
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const sha = (await res.json())?.sha;
  if (!sha) throw new Error('GitHub API returned no sha');
  resolvedSha = sha;
  sessionStorage.setItem(SHA_CACHE_KEY, JSON.stringify({ sha, ts: Date.now() }));
  return sha;
}

/**
 * Re-resolves the repository HEAD and reports whether the archive moved
 * since the data currently on screen was loaded. Callers reload when true.
 * Cheap (one API request, no file traffic) and failure-safe.
 */
export async function refreshArchiveIfStale() {
  if (import.meta.env.DEV || !state.loaded) return false;
  const previous = resolvedSha;
  try {
    const fresh = await archiveHeadSha({ force: true });
    return Boolean(previous && fresh !== previous);
  } catch {
    return false;
  }
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
let reloadPromise = null;

/** Public URL for a commit in the archive repository (for log links). */
export const commitUrl = (sha) => (sha
  ? `https://github.com/${ARCHIVE_REPO}/commit/${String(sha).slice(0, 40)}` : null);

/**
 * Normalizes the segments of an episode entry (schema 4). Legacy schema-3
 * episode records carried the single story directly on the record — those are
 * synthesized into one segment so the whole app can rely on the same shape.
 * Movies have no segments (they are single stories) and return undefined.
 */
function normalizeSegments(entry) {
  if (entry.kind !== 'episode') return undefined;
  const raw = Array.isArray(entry.segments) && entry.segments.length ? entry.segments : [{
    title: entry.title, alternateTitles: entry.alternateTitles, summary: entry.summary,
    description: entry.description, image: entry.image, screenshots: entry.screenshots,
    characters: entry.characters, gadgets: entry.gadgets, voiceActors: entry.voiceActors,
    durationMinutes: entry.durationMinutes,
  }];
  const segments = raw.map((s, i) => {
    const image = s?.image && typeof s?.image === 'object'
      ? s.image
      : typeof s?.image === 'string' ? { url: s.image, alt: null } : { url: null, alt: null };
    return {
      id: typeof s?.id === 'string' && s.id ? s.id : `${entry.id}-${String(i + 1).padStart(2, '0')}`,
      segmentNumber: Number.isInteger(s?.segmentNumber) ? s.segmentNumber : i + 1,
      title: s?.title && typeof s?.title === 'object' ? s.title
        : typeof s?.title === 'string' ? { en: s.title, ja: null } : { en: '', ja: null },
      alternateTitles: Array.isArray(s?.alternateTitles) ? s.alternateTitles : [],
      summary: typeof s?.summary === 'string' ? s.summary : null,
      description: typeof s?.description === 'string' ? s.description : null,
      image,
      screenshots: Array.isArray(s?.screenshots)
        ? s.screenshots.filter((shot) => shot && typeof shot === 'object' && (shot.url || shot.data))
        : [],
      characters: Array.isArray(s?.characters) ? s.characters : [],
      gadgets: Array.isArray(s?.gadgets) ? s.gadgets : [],
      voiceActors: Array.isArray(s?.voiceActors) ? s.voiceActors : [],
      durationMinutes: Number.isInteger(s?.durationMinutes) ? s.durationMinutes : null,
    };
  });
  // Story fields live on the segments; the merged entry carries the unions so
  // filters, relations and statistics keep working without segment plumbing.
  entry.characters = [...new Set(segments.flatMap((s) => s.characters))];
  entry.gadgets = [...new Set(segments.flatMap((s) => s.gadgets))];
  entry.voiceActors = segments.flatMap((s) => s.voiceActors);
  entry.screenshots = segments.flatMap((s) => s.screenshots);
  entry.alternateTitles = [...new Set(segments.flatMap((s) => s.alternateTitles))];
  // Episode cover and synopsis fallback: the first segment that has one.
  entry.image = segments.find((s) => s.image?.url)?.image ?? segments[0]?.image ?? { url: null, alt: null };
  entry.summary = segments.find((s) => s.summary)?.summary ?? null;
  entry.segmentCount = segments.length;
  return segments;
}

/**
 * Merges a record file over its roster entry. The record wins on every field
 * it defines; the roster only supplies identity (id, number, path) and the
 * routing the UI needs. Derived fields (normalized segments, sources,
 * availability, status) are computed here so no component ever sees raw
 * editor input.
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
  entry.voiceActors = Array.isArray(entry.voiceActors) ? entry.voiceActors : [];
  entry.languages = Array.isArray(entry.languages) ? entry.languages : [];
  entry.alternateTitles = Array.isArray(entry.alternateTitles) ? entry.alternateTitles : [];
  entry.image = entry.image && typeof entry.image === 'object'
    ? entry.image
    : typeof entry.image === 'string' ? { url: entry.image, alt: null } : { url: null, alt: null };
  entry.screenshots = Array.isArray(entry.screenshots)
    ? entry.screenshots.filter((shot) => shot && typeof shot === 'object' && (shot.url || shot.data))
    : [];
  entry.segments = normalizeSegments(entry);
  entry.sources = normalizeSources(entry.sources);
  entry.availability = availabilityFor(entry.sources);
  entry.status = computeStatus(entry);
  return entry;
}

/**
 * Characters and gadgets come from array files that have historically stored
 * `image` both as a plain URL string and as { url, alt }. Normalise to the
 * object form here so every card and detail page can rely on image.url —
 * the shape mismatch is why some list pages showed no artwork.
 */
function normalizePerson(person) {
  if (!person || typeof person !== 'object') return person;
  let image = { url: null, alt: null };
  if (typeof person.image === 'string') image = { url: person.image, alt: person.name?.en ?? null };
  else if (person.image && typeof person.image === 'object') image = { url: person.image.url ?? null, alt: person.image.alt ?? null };
  return { ...person, image };
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

  // Raw record files, exactly as stored in the repository. Editors commit
  // against THESE — merged entries carry derived fields (path, kind, forced
  // arrays, normalized sources) that never exist in the file, so using one
  // as an edit base fails the server's concurrency check.
  const rawEntries = new Map(Object.values(recordsBySeries).flatMap((recs) => Object.entries(recs)));

  const entries = [];
  const entriesById = new Map();
  const series = new Map();
  for (const [id, meta] of Object.entries(SERIES)) {
    const index = indexes[id];
    const records = recordsBySeries[id] ?? {};
    const seriesEntries = (index.entries ?? []).map((rosterEntry) => mergeEntry(rosterEntry, records[rosterEntry.id], id, meta));
    for (const entry of seriesEntries) entriesById.set(entry.id, entry);
    series.set(id, {
      ...meta,
      title: index.title ?? meta.label,
      description: index.description ?? '',
      entries: seriesEntries,
    });
    entries.push(...seriesEntries);
  }

  // Built completely off to the side and swapped in by applyState(), so a
  // reload never leaves a half-empty catalogue visible mid-render.
  return {
    loaded: true,
    entries,
    entriesById,
    series,
    rawEntries,
    characters: (characters ?? []).map(normalizePerson),
    gadgets: (gadgets ?? []).map(normalizePerson),
    languages: languages ?? [],
    categories: categories ?? {},
    relations: null,
  };
}

function applyState(next) {
  Object.assign(state, next);
}

/** Loads the catalogue once. Concurrent callers share the same request. */
export function loadCatalog() {
  if (!loadPromise) {
    loadPromise = buildState()
      .then((next) => { applyState(next); })
      .catch((error) => { loadPromise = null; throw error; });
  }
  return loadPromise;
}

/**
 * Rebuilds the catalogue from GitHub and swaps it in atomically (no
 * half-empty state mid-render). Called after a staff edit, and by the
 * focus-based freshness check when the repository HEAD moved.
 */
export function reloadCatalog() {
  if (!reloadPromise) {
    reloadPromise = buildState()
      .then((next) => { applyState(next); })
      .catch((error) => { reloadPromise = null; throw error; });
  }
  return reloadPromise;
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

/** True when the entry is a multi-segment broadcast episode. */
export const isMultiSegment = (entry) => Array.isArray(entry?.segments) && entry.segments.length > 1;

/**
 * The title to display: English first, Japanese as the fallback. A
 * multi-segment broadcast episode is titled by combining the names of ALL of
 * its segments (comma-separated) — read straight from the segment data, so
 * renaming a segment updates every listing automatically. Episodes whose
 * segments have no usable names fall back to the broadcast number, and
 * single-segment episodes behave exactly as before.
 */
export function displayTitle(entry) {
  if (isMultiSegment(entry)) {
    const names = (entry.segments ?? [])
      .map((seg) => titleText(seg.title))
      .filter(Boolean);
    if (names.length) return names.join(', ');
    return `Episode #${entry.number}`;
  }
  return titleText(entry?.title)
    || titleText(entry?.segments?.[0]?.title)
    || 'Untitled entry';
}

/** The Japanese title as a secondary line, or null when there is nothing distinct to show. */
export function secondaryTitle(entry) {
  if (isMultiSegment(entry)) return null;
  const t = entry?.title ?? entry?.segments?.[0]?.title;
  if (!t || typeof t === 'string') return null;
  return t.en && t.ja ? t.ja : null;
}

/**
 * All text a catalogue search should match for this entry: the display title
 * plus every segment's titles and synopses, so searching for one story inside
 * a multi-segment broadcast still finds the episode.
 */
export function entrySearchTerms(entry) {
  const titles = [titleText(entry?.title), ...entry?.alternateTitles ?? []];
  for (const seg of entry?.segments ?? []) {
    titles.push(titleText(seg.title), ...seg.alternateTitles ?? [], seg.summary ?? '', seg.description ?? '');
  }
  return titles;
}

/** The display title of one segment (falls back to a generic label). */
export function segmentTitle(entry, index) {
  const seg = entry?.segments?.[index];
  return (seg && titleText(seg.title)) || `Segment ${(seg?.segmentNumber ?? index + 1)}`;
}
