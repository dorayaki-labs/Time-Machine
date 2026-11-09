import { releaseSortKey, releaseYear } from './dates.js';
import { getAppearanceSummary } from './catalog.js';

export const PAGE_SIZE = 24;

export const normalize = (value) =>
  String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

export const EPISODE_SORTS = [
  { value: 'number-asc', label: 'Episode number (low to high)' },
  { value: 'number-desc', label: 'Episode number (high to low)' },
  { value: 'date-asc', label: 'Release date (oldest first)' },
  { value: 'date-desc', label: 'Release date (newest first)' },
  { value: 'title', label: 'Title (A to Z)' },
];
export const MOVIE_SORTS = [
  { value: 'number-asc', label: 'Chronological (oldest first)' },
  { value: 'number-desc', label: 'Chronological (newest first)' },
  { value: 'title', label: 'Title (A to Z)' },
];

const titleOf = (e) => normalize(e.title?.en || e.title?.ja);

export function sortEntries(entries, sort = 'number-asc') {
  const list = [...entries];
  const byDate = (a, b) => releaseSortKey(a.release) - releaseSortKey(b.release);
  const fix = (n) => (Number.isFinite(n) ? n : 0);
  switch (sort) {
    case 'number-desc': return list.sort((a, b) => b.number - a.number);
    case 'date-asc': return list.sort((a, b) => fix(byDate(a, b)) || a.number - b.number);
    case 'date-desc':
      return list.sort((a, b) => {
        const ka = releaseSortKey(a.release);
        const kb = releaseSortKey(b.release);
        if (ka === kb) return b.number - a.number;
        if (!Number.isFinite(ka)) return 1;
        if (!Number.isFinite(kb)) return -1;
        return kb - ka;
      });
    case 'title': return list.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
    default: return list.sort((a, b) => a.number - b.number);
  }
}

function matchesText(entry, q) {
  if (!q) return true;
  // The haystack covers the display title plus every segment's titles and
  // synopses, so searching for one story inside a multi-segment broadcast
  // still finds the episode.
  const titleBits = typeof entry.title === 'string' ? [entry.title] : [entry.title?.en, entry.title?.ja];
  const hay = [
    ...titleBits,
    ...(entry.alternateTitles ?? []).map((t) => (typeof t === 'string' ? t : t?.title)),
    ...(entry.segments ?? []).flatMap((s) => [s.title?.en, s.title?.ja, s.summary, s.description]),
    String(entry.number),
  ]
    .map(normalize)
    .join(' | ');
  return hay.includes(normalize(q).replace(/^#/, ''));
}

/** Combine every catalogue filter. Empty values mean "no filter". */
export function filterEntries(entries, f = {}) {
  const min = f.numMin !== '' && f.numMin != null ? Number(f.numMin) : null;
  const max = f.numMax !== '' && f.numMax != null ? Number(f.numMax) : null;
  return entries.filter((e) => {
    if (!matchesText(e, f.q)) return false;
    if (min !== null && Number.isFinite(min) && e.number < min) return false;
    if (max !== null && Number.isFinite(max) && e.number > max) return false;
    if (f.year) {
      if (f.year === 'unknown') { if (releaseYear(e.release) !== null) return false; }
      else if (String(releaseYear(e.release)) !== String(f.year)) return false;
    }
    if (f.language && !e.languages.includes(f.language)) return false;
    if (f.availability && e.availability !== f.availability) return false;
    if (f.character && !e.characters.includes(f.character)) return false;
    if (f.preservation && e.preservation !== f.preservation) return false;
    return true;
  });
}

export function availableYears(entries) {
  const years = new Set();
  let hasUnknown = false;
  entries.forEach((e) => {
    const y = releaseYear(e.release);
    if (y === null) hasUnknown = true; else years.add(y);
  });
  return { years: [...years].sort((a, b) => a - b), hasUnknown };
}

export function availableLanguages(entries) {
  return [...new Set(entries.flatMap((e) => e.languages))].sort();
}

export function paginate(items, page, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, Number(page) || 1), pageCount);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount, total: items.length };
}

/** Filter characters or gadgets. `kind` selects which appearance index to read. */
export function filterPeople(list, kind, f = {}) {
  return list.filter((item) => {
    if (f.q) {
      const hay = [item.name?.en, item.name?.ja, ...(item.aliases ?? []), item.description].map(normalize).join(' | ');
      if (!hay.includes(normalize(f.q))) return false;
    }
    if (f.category && item.category !== f.category) return false;
    if (f.series || f.movie) {
      const a = getAppearanceSummary(kind, item.id);
      if (f.series && !a.series.has(f.series)) return false;
      if (f.movie && !a.movies.has(f.movie)) return false;
    }
    return true;
  });
}
