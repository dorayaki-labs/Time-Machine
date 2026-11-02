// Source normalization. Editors write viewing sources as entries of the form
//   { "type": "direct", "data": "https://example.com/video.mp4",
//     "label": "Blu-ray rip", "language": "Japanese",
//     "subtitles": { "has": true, "type": "soft", "languages": ["English"] },
//     "quality": "1080p", "notes": "…" }
// and this module makes the app tolerant of everything short of that: a bare
// string, a legacy {url} object, a missing or unknown type, shorthand subtitle
// forms ("none", true, "hard"). Nothing here can throw — a malformed sources
// field must never take a page down with it.

const MEDIA_EXT = /\.(mp4|webm|ogv|ogg|m3u8|mpd)(\?|#|$)/i;
const URLISH = /^(https?:)?\/\//i;

export const PLAYABLE_TYPES = ['direct', 'embed'];

/** Adds https:// to "www.example.com/x.mp4" style values so a player can use them. */
export function coerceUrl(value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (URLISH.test(v) || v.startsWith('<')) return v;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(v)) return `https://${v}`;
  return v;
}

function guessType(data) {
  return MEDIA_EXT.test(data) ? 'direct' : 'embed';
}

const text = (v) => {
  const s = String(v ?? '').trim();
  return s || null;
};

/**
 * Subtitles accept several shapes and always normalize to
 * { has, type, languages }: false/"no"/"none" → none; true → yes, unknown kind;
 * "hard"/"soft" → yes with that kind; the object form keeps its fields.
 */
function normalizeSubtitles(raw) {
  if (raw === undefined || raw === null || raw === false) return { has: false, type: null, languages: [] };
  if (raw === true) return { has: true, type: null, languages: [] };
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (!s || s === 'no' || s === 'none' || s === 'false') return { has: false, type: null, languages: [] };
    const type = s.includes('hard') ? 'hard' : s.includes('soft') ? 'soft' : null;
    return { has: true, type, languages: [] };
  }
  if (typeof raw === 'object') {
    const has = raw.has !== undefined ? Boolean(raw.has) : String(raw.type ?? '') !== 'none';
    const type = raw.type === 'hard' || raw.type === 'soft' ? raw.type : null;
    const languages = (Array.isArray(raw.languages) ? raw.languages : raw.languages ? [raw.languages] : [])
      .map((l) => String(l).trim()).filter(Boolean);
    return { has, type, languages };
  }
  return { has: false, type: null, languages: [] };
}

/** Normalizes any sources value into an array of detailed { type, data, … } entries. */
export function normalizeSources(raw) {
  const list = raw === undefined || raw === null
    ? []
    : typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of list) {
    let type = null;
    let data = '';
    let details = {};
    if (typeof item === 'string') {
      data = item;
    } else if (item && typeof item === 'object') {
      type = String(item.type ?? '').toLowerCase();
      data = typeof item.data === 'string' ? item.data : String(item.url ?? '');
      details = item;
    }
    data = coerceUrl(data);
    if (!data) continue;
    if (type !== 'direct' && type !== 'embed') type = guessType(data);
    out.push({
      type,
      data,
      label: text(details.label),
      language: text(details.language),
      subtitles: normalizeSubtitles(details.subtitles),
      quality: text(details.quality),
      notes: text(details.notes),
    });
  }
  return out;
}

/** availability label for a record: playable entries count, plain links do not. */
export function availabilityFor(sources) {
  if (!sources.length) return 'no-source';
  return sources.some((s) => PLAYABLE_TYPES.includes(s.type)) ? 'available' : 'unverified';
}

/** Short human summary of a source's details, used on picker cards and link rows. */
export function describeSource(source) {
  const bits = [];
  if (source.language) bits.push(source.language);
  if (source.subtitles?.has) {
    const kind = source.subtitles.type ? `${source.subtitles.type}sub` : 'subtitles';
    const langs = source.subtitles.languages.length ? ` (${source.subtitles.languages.join(', ')})` : '';
    bits.push(`${kind}${langs}`);
  } else if (source.language) {
    bits.push('no subtitles');
  }
  if (source.quality) bits.push(source.quality);
  return bits;
}
