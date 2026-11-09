// Modular global search. Builds one lightweight document per searchable thing and scores matches.
import {
  getAllEntries, getCharacters, getGadgets, SERIES, displayTitle, entrySearchTerms, isMultiSegment,
} from './catalog.js';
import { normalize } from './filters.js';

let docs = null;

function buildDocs() {
  if (docs) return docs;
  const list = [];
  for (const e of getAllEntries()) {
    const isMovie = e.kind === 'movie';
    list.push({
      key: e.id,
      group: isMovie ? 'movies' : 'episodes',
      title: displayTitle(e),
      subtitle: `${isMovie ? 'Movie' : SERIES[e.seriesId].label} · ${isMovie ? 'No.' : 'Episode'} ${e.number}`,
      url: e.url,
      number: e.number,
      numberLabel: isMovie ? 'movie' : 'ep',
      // Segment titles/synopses are indexed on the episode too, so browsing
      // "which episode was that story in?" works from the episode results.
      terms: [...entrySearchTerms(e), e.id].filter(Boolean).map(normalize),
    });
    // Individual segments of multi-segment broadcasts are independently
    // discoverable: the result opens the parent episode with that segment
    // pre-selected. Single-segment episodes need no separate document —
    // their episode entry already carries the story.
    if (!isMovie && isMultiSegment(e)) {
      e.segments.forEach((seg, i) => {
        list.push({
          key: seg.id,
          group: 'segments',
          title: (typeof seg.title === 'string' ? seg.title : seg.title?.en || seg.title?.ja) || `Segment ${i + 1}`,
          subtitle: `Segment ${i + 1} · Episode ${e.number} · ${SERIES[e.seriesId].label}`,
          url: `${e.url}?segment=${i + 1}`,
          number: e.number,
          terms: [
            typeof seg.title === 'string' ? seg.title : seg.title?.en, seg.title?.ja,
            ...seg.alternateTitles.map((t) => (typeof t === 'string' ? t : t?.title)),
            seg.summary, seg.description, e.id,
          ].filter(Boolean).map(normalize),
        });
      });
    }
  }
  for (const c of getCharacters()) {
    list.push({
      key: c.id, group: 'characters', title: c.name.en, subtitle: c.name.ja ?? 'Character', url: `/characters/${c.id}`,
      terms: [c.name.en, c.name.ja, ...(c.aliases ?? [])].filter(Boolean).map(normalize),
    });
  }
  for (const g of getGadgets()) {
    list.push({
      key: g.id, group: 'gadgets', title: g.name.en, subtitle: g.name.ja ?? 'Gadget', url: `/gadgets/${g.id}`,
      terms: [g.name.en, g.name.ja, ...(g.aliases ?? [])].filter(Boolean).map(normalize),
    });
  }
  docs = list;
  return list;
}

export const GROUPS = [
  { id: 'episodes', label: 'Episodes' },
  { id: 'segments', label: 'Episode segments' },
  { id: 'movies', label: 'Movies' },
  { id: 'characters', label: 'Characters' },
  { id: 'gadgets', label: 'Gadgets' },
];

function scoreDoc(doc, q, numberQuery) {
  let best = 0;
  for (const t of doc.terms) {
    if (t === q) best = Math.max(best, 100);
    else if (t.startsWith(q)) best = Math.max(best, 80);
    else if (t.split(/[\s:·-]+/).some((w) => w.startsWith(q))) best = Math.max(best, 60);
    else if (t.includes(q)) best = Math.max(best, 40);
  }
  if (numberQuery && doc.number === numberQuery.number && (!numberQuery.kind || numberQuery.kind === doc.numberLabel)) {
    best = Math.max(best, 90);
  }
  return best;
}

/** "12", "#12", "ep 12", "episode 12", "movie 3" → { number, kind } */
function parseNumberQuery(q) {
  const m = q.match(/^(?:(ep|episode|movie|film|no)\.?\s*)?#?(\d{1,5})$/);
  if (!m) return null;
  const kind = m[1] ? (['movie', 'film'].includes(m[1]) ? 'movie' : m[1] === 'no' ? null : 'ep') : null;
  return { number: Number(m[2]), kind };
}

/** Returns { total, groups: [{ id, label, items }] } with at most `perGroup` items per group. */
export function search(query, { perGroup = 5 } = {}) {
  const q = normalize(query).replace(/^#(?=\d)/, '#');
  if (!q) return { total: 0, groups: [] };
  const numberQuery = parseNumberQuery(q);
  const textQ = numberQuery ? q.replace(/^#/, '') : q;
  const scored = buildDocs()
    .map((d) => ({ d, s: scoreDoc(d, textQ, numberQuery) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.d.number ?? 0) - (b.d.number ?? 0));
  // Groups are ordered by their best match, so the strongest result is always listed (and selected) first.
  const groups = GROUPS.map((g, order) => {
    const hits = scored.filter((x) => x.d.group === g.id);
    return { ...g, order, top: hits[0]?.s ?? 0, items: hits.slice(0, perGroup).map((x) => x.d), count: hits.length };
  })
    .filter((g) => g.count > 0)
    .sort((a, b) => b.top - a.top || a.order - b.order);
  return { total: scored.length, groups };
}
