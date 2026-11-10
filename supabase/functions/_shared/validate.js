// Server-side validation, mirroring the rules of scripts/validate-catalog.js
// so that anything committed through the backend also passes `npm run
// validate` locally. Every check is defensive: unknown shapes produce clear
// error messages instead of exceptions.
//
// Schema 4 (episodes): a broadcast episode is a container of one or more
// story segments. Schema 3 (movies, unchanged): one story per record.

export const EPISODE_SCHEMA_VERSION = 4;
export const MOVIE_SCHEMA_VERSION = 3;

export const SERIES = {
  'anime-1979': { kind: 'episode', dir: 'archive/anime-1979' },
  'anime-2005': { kind: 'episode', dir: 'archive/anime-2005' },
  'anime-1973': { kind: 'episode', dir: 'archive/historical/anime-1973' },
  movies: { kind: 'movie', dir: 'archive/movies', seriesId: 'movies' },
};

const EPISODE_ID = /^anime-(1979|2005|1973)-\d{4}$/;
const MOVIE_ID = /^movie-\d{4}$/;
const CHARACTER_ID = /^char-[a-z0-9-]{1,50}$/;
const GADGET_ID = /^gadget-[a-z0-9-]{1,50}$/;
const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

const problems = (errors) => ({ ok: errors.length === 0, errors });
const add = (errors, msg) => { errors.push(msg); };

function checkText(errors, value, label, { max = 5000, allowEmpty = true } = {}) {
  if (value === undefined || value === null) return allowEmpty ? null : (add(errors, `${label} is required.`), null);
  if (typeof value !== 'string') { add(errors, `${label} must be a string.`); return null; }
  if (!value.trim()) return allowEmpty ? null : (add(errors, `${label} is required.`), null);
  if (value.length > max) add(errors, `${label} is longer than ${max} characters.`);
  return value;
}

function checkTitle(errors, title, label = 'title') {
  if (typeof title === 'string') {
    if (!title.trim()) { add(errors, `${label} cannot be empty.`); return; }
    if (title.length > 300) add(errors, `${label} is longer than 300 characters.`);
    return;
  }
  if (!title || typeof title !== 'object' || Array.isArray(title)) {
    add(errors, `${label} must be a string or { en, ja }.`);
    return;
  }
  const en = title.en, ja = title.ja;
  if (en !== null && en !== undefined && typeof en !== 'string') add(errors, `${label}.en must be a string or null.`);
  if (ja !== null && ja !== undefined && typeof ja !== 'string') add(errors, `${label}.ja must be a string or null.`);
  if (!(typeof en === 'string' && en.trim()) && !(typeof ja === 'string' && ja.trim())) {
    add(errors, `${label} needs at least one language (en or ja).`);
  }
}

function checkSources(errors, sources, label = 'sources') {
  if (sources === undefined || sources === null) return;
  if (typeof sources === 'string' || !Array.isArray(sources)) {
    add(errors, `${label} must be an array of { type, data } entries.`);
    return;
  }
  sources.forEach((s, i) => {
    const at = `${label} ${i + 1}`;
    if (!s || typeof s !== 'object' || Array.isArray(s)) { add(errors, `${at}: each entry must be an object.`); return; }
    const data = typeof s.data === 'string' ? s.data.trim() : '';
    if (!data) add(errors, `${at}: "data" is required.`);
    else if (!/^(https?:\/\/|\/\/)/.test(data) && !data.startsWith('<')) {
      add(errors, `${at}: "data" must be an http(s) URL or an <iframe> snippet.`);
    } else if (/^https?:\/\//i.test(data) && isUnsafeUrl(data)) {
      add(errors, `${at}: that URL is not allowed.`);
    }
    if (s.type !== undefined && !['direct', 'embed', 'youtube'].includes(String(s.type).toLowerCase())) {
      add(errors, `${at}: unknown type "${s.type}" (use direct, embed or youtube).`);
    }
    for (const key of ['label', 'language', 'quality', 'notes']) {
      if (s[key] !== undefined && s[key] !== null && typeof s[key] !== 'string') {
        add(errors, `${at}: "${key}" must be a string.`);
      }
    }
    checkSubtitles(errors, s.subtitles, `${at}: subtitles`);
  });
}

function checkSubtitles(errors, subs, label) {
  if (subs === undefined || subs === null) return;
  if (typeof subs === 'string') {
    if (!['none', 'no', 'hard', 'soft'].includes(subs.trim().toLowerCase())) {
      add(errors, `${label} must be "none", "hard", "soft", true/false or { has, type, languages }.`);
    }
    return;
  }
  if (typeof subs === 'boolean') return;
  if (typeof subs !== 'object' || Array.isArray(subs)) {
    add(errors, `${label} must be "none", "hard", "soft", true/false or { has, type, languages }.`);
    return;
  }
  if (subs.has !== undefined && typeof subs.has !== 'boolean') add(errors, `${label}.has must be true or false.`);
  if (subs.type !== undefined && !['hard', 'soft', 'none', null].includes(subs.type)) {
    add(errors, `${label}.type must be "hard", "soft", "none" or null.`);
  }
  if (subs.languages !== undefined && !Array.isArray(subs.languages)) {
    add(errors, `${label}.languages must be an array of names.`);
  }
}

function checkImage(errors, image, label = 'image') {
  if (image === undefined || image === null) return;
  if (typeof image !== 'object' || Array.isArray(image)) { add(errors, `${label} must be { url, alt } or null.`); return; }
  if (image.url !== undefined && image.url !== null) {
    if (typeof image.url !== 'string') add(errors, `${label}.url must be a string or null.`);
    else if (image.url && isUnsafeUrl(image.url)) add(errors, `${label}.url is not an allowed URL.`);
  }
  if (image.alt !== undefined && image.alt !== null && typeof image.alt !== 'string') {
    add(errors, `${label}.alt must be a string or null.`);
  }
}

function checkIdList(errors, list, pattern, label) {
  if (list === undefined || list === null) return;
  if (!Array.isArray(list)) { add(errors, `${label} must be an array.`); return; }
  list.forEach((id) => {
    if (typeof id !== 'string' || !pattern.test(id)) add(errors, `${label} contains an invalid id: ${JSON.stringify(id)}`);
  });
}

/** Story-level fields belong on a segment, never on the episode record.
    `title` is the exception: it is the episode's broadcast name ("Episode 1")
    and lives on the episode, while segment titles stay the story names. */
const STORY_FIELDS = ['alternateTitles', 'summary', 'description', 'image',
  'screenshots', 'characters', 'gadgets', 'voiceActors', 'durationMinutes'];

function checkVoiceActors(errors, rows, label) {
  if (rows === undefined || rows === null) return;
  if (!Array.isArray(rows)) { add(errors, `${label} must be an array.`); return; }
  rows.forEach((v, i) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) { add(errors, `${label} ${i + 1} must be an object.`); return; }
    if (v.name !== undefined && v.name !== null) checkTitle(errors, v.name, `${label} ${i + 1} name`);
    for (const key of ['characterId', 'language', 'version']) {
      if (v[key] !== undefined && v[key] !== null && typeof v[key] !== 'string') {
        add(errors, `${label} ${i + 1}: "${key}" must be a string or null.`);
      }
    }
  });
}

/** Validates one story segment of an episode (schema 4). */
export function validateSegment(segment, episodeId, index, errors) {
  const at = `segment ${index + 1}`;
  if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
    add(errors, `${at} must be an object.`);
    return;
  }
  // Segment ids are stable identities (never renumbered on reorder);
  // segmentNumber is the display order and must match the array position.
  if (typeof segment.id !== 'string' || !(new RegExp(`^${episodeId}-\\d{2}$`)).test(segment.id)) {
    add(errors, `${at}: id "${segment.id}" must look like "${episodeId}-01".`);
  }
  if (segment.segmentNumber !== index + 1) add(errors, `${at}: segmentNumber must be ${index + 1}.`);
  checkTitle(errors, segment.title, `${at} title`);
  if (segment.alternateTitles !== undefined && segment.alternateTitles !== null && !Array.isArray(segment.alternateTitles)) {
    add(errors, `${at}: alternateTitles must be an array.`);
  }
  checkText(errors, segment.summary, `${at} summary`, { max: 8000 });
  checkText(errors, segment.description, `${at} description`, { max: 12000 });
  if (segment.durationMinutes !== undefined && segment.durationMinutes !== null
      && (!Number.isInteger(segment.durationMinutes) || segment.durationMinutes < 1)) {
    add(errors, `${at}: durationMinutes must be a positive integer (minutes) or null.`);
  }
  checkImage(errors, segment.image, `${at} image`);
  if (segment.screenshots !== undefined && segment.screenshots !== null) {
    if (!Array.isArray(segment.screenshots)) add(errors, `${at}: screenshots must be an array.`);
    else segment.screenshots.forEach((s, i) => checkImage(errors, s, `${at} screenshots ${i + 1}`));
  }
  checkIdList(errors, segment.characters, CHARACTER_ID, `${at} characters`);
  checkIdList(errors, segment.gadgets, GADGET_ID, `${at} gadgets`);
  checkVoiceActors(errors, segment.voiceActors, `${at} voice actors`);
}

/** Validates an episode or movie record (full replacement value). */
export function validateEntryRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return problems(['record must be a JSON object.']);
  if (!EPISODE_ID.test(record.id ?? '') && !MOVIE_ID.test(record.id ?? '')) add(errors, `id "${record.id}" is not a valid entry id.`);
  if (record.type !== 'episode' && record.type !== 'movie') add(errors, 'type must be "episode" or "movie".');
  if (!Number.isInteger(record.number) || record.number < 1) add(errors, 'number must be a positive integer.');

  const expectedSeries = record.type === 'movie' ? 'movies' : String(record.id ?? '').split('-').slice(0, 2).join('-');
  if (record.seriesId !== expectedSeries) add(errors, `seriesId must be "${expectedSeries}".`);
  if (!SERIES[record.seriesId]) add(errors, `unknown series "${record.seriesId}".`);

  if (record.type === 'episode') {
    if (record.schemaVersion !== EPISODE_SCHEMA_VERSION) add(errors, `episode schemaVersion must be ${EPISODE_SCHEMA_VERSION}.`);
    if (record.title !== undefined && record.title !== null) checkTitle(errors, record.title);
    if (record.alternateTitles !== undefined && record.alternateTitles !== null && !Array.isArray(record.alternateTitles)) {
      add(errors, 'alternateTitles must be an array.');
    }
    if (!Array.isArray(record.segments) || record.segments.length === 0) {
      add(errors, 'segments must be an array with at least one segment.');
    } else {
      const ids = new Set();
      record.segments.forEach((seg, i) => {
        if (seg && typeof seg === 'object' && !Array.isArray(seg) && ids.has(seg.id)) {
          add(errors, `duplicate segment id "${seg.id}".`);
        }
        ids.add(seg?.id);
        validateSegment(seg, record.id, i, errors);
      });
    }
    for (const f of STORY_FIELDS) {
      if (f in record) add(errors, `"${f}" belongs on a segment now — remove it from the episode record.`);
    }
  } else {
    if (record.schemaVersion !== MOVIE_SCHEMA_VERSION) add(errors, `movie schemaVersion must be ${MOVIE_SCHEMA_VERSION}.`);
    checkTitle(errors, record.title);
    if (record.alternateTitles !== undefined && record.alternateTitles !== null && !Array.isArray(record.alternateTitles)) {
      add(errors, 'alternateTitles must be an array.');
    }
    if (record.originalLanguage !== undefined && typeof record.originalLanguage !== 'string') {
      add(errors, 'originalLanguage must be a string.');
    }
    checkText(errors, record.summary, 'summary', { max: 8000 });
    checkImage(errors, record.image);
    if (record.screenshots !== undefined && record.screenshots !== null) {
      if (!Array.isArray(record.screenshots)) add(errors, 'screenshots must be an array.');
      else record.screenshots.forEach((s, i) => checkImage(errors, s, `screenshots ${i + 1}`));
    }
    checkIdList(errors, record.characters, CHARACTER_ID, 'characters');
    checkIdList(errors, record.gadgets, GADGET_ID, 'gadgets');
    if (record.durationMinutes !== undefined && record.durationMinutes !== null
        && (!Number.isInteger(record.durationMinutes) || record.durationMinutes < 1)) {
      add(errors, 'durationMinutes must be a positive integer (minutes).');
    }
    if (record.director !== undefined && record.director !== null) checkTitle(errors, record.director, 'director');
  }

  if (record.originalLanguage !== undefined && record.originalLanguage !== null && typeof record.originalLanguage !== 'string') {
    add(errors, 'originalLanguage must be a string.');
  }

  const release = record.release;
  if (release !== undefined && release !== null) {
    if (typeof release !== 'object' || Array.isArray(release)) add(errors, 'release must be { date, precision, region }.');
    else {
      if (release.date !== null && release.date !== undefined) {
        if (typeof release.date !== 'string' || !DATE.test(release.date)) add(errors, 'release.date must look like YYYY, YYYY-MM or YYYY-MM-DD.');
        else {
          const parts = release.date.split('-').map(Number);
          if (parts[1] !== undefined && (parts[1] < 1 || parts[1] > 12)) add(errors, 'release.date month is out of range.');
          if (parts[2] !== undefined && (parts[2] < 1 || parts[2] > 31)) add(errors, 'release.date day is out of range.');
        }
      }
      if (release.precision !== undefined && release.precision !== null && !['day', 'month', 'year'].includes(release.precision)) {
        add(errors, 'release.precision must be "day", "month" or "year".');
      }
    }
  }

  checkSources(errors, record.sources);
  return problems(errors);
}

/** Validates a character or gadget record. */
export function validateEntityRecord(record, entityType) {
  const errors = [];
  const kind = entityType === 'character' ? 'character' : 'gadget';
  if (!record || typeof record !== 'object' || Array.isArray(record)) return problems([`${kind} record must be a JSON object.`]);
  const pattern = entityType === 'character' ? CHARACTER_ID : GADGET_ID;
  if (typeof record.id !== 'string' || !pattern.test(record.id)) add(errors, `id must match ${pattern}.`);
  checkTitle(errors, record.name, 'name');
  if (record.aliases !== undefined && record.aliases !== null && !Array.isArray(record.aliases)) add(errors, 'aliases must be an array.');
  checkText(errors, record.description, 'description', { max: 8000 });
  checkImage(errors, record.image);
  if (entityType === 'character' && record.category !== undefined && record.category !== null && typeof record.category !== 'string') {
    add(errors, 'category must be a string.');
  }
  if (entityType === 'gadget') {
    checkText(errors, record.howItWorks, 'howItWorks', { max: 4000 });
  }
  if (record.firstAppearance !== undefined && record.firstAppearance !== null) {
    if (typeof record.firstAppearance !== 'object' || Array.isArray(record.firstAppearance)) add(errors, 'firstAppearance must be { entryId, note }.');
    else if (record.firstAppearance.entryId !== null && record.firstAppearance.entryId !== undefined
             && typeof record.firstAppearance.entryId !== 'string') add(errors, 'firstAppearance.entryId must be a string or null.');
  }
  return problems(errors);
}

/** Validates a whole data file (characters.json / gadgets.json). */
export function validateEntityFile(list, entityType) {
  if (!Array.isArray(list)) return { ok: false, errors: ['file must be a JSON array.'] };
  const ids = new Set();
  const errors = [];
  for (const record of list) {
    const res = validateEntityRecord(record, entityType);
    errors.push(...res.errors);
    if (ids.has(record?.id)) errors.push(`duplicate id "${record?.id}".`);
    ids.add(record?.id);
  }
  return problems(errors);
}

/** Blocks URLs that could smuggle credentials or non-http protocols. */
export function isUnsafeUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return true;
    if (u.username || u.password) return true;
    if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname)) return true;
    return false;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Contribution payload validation (the form answers, before any archive work)
// ---------------------------------------------------------------------------

const TEXT_LIMITS = { text: 300, textarea: 4000, url: 1000 };

/** Validates a submitted form payload against the field spec server-side. */
export function validateContributionPayload(spec, values) {
  const errors = {};
  if (!spec) return { ok: false, errors: { _form: 'Unknown contribution type.' } };
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return { ok: false, errors: { _form: 'Payload must be an object.' } };
  }
  for (const field of spec) {
    const raw = values[field.name];
    const v = typeof raw === 'string' ? raw.trim() : raw;
    if (v === undefined || v === null || v === '') {
      if (field.required) errors[field.name] = `${field.label} is required.`;
      continue;
    }
    const limit = TEXT_LIMITS[field.type] ?? 300;
    if (typeof v === 'string' && v.length > limit) errors[field.name] = `${field.label} is longer than ${limit} characters.`;
    if (field.type === 'number' && (!Number.isInteger(Number(v)) || Number(v) < (field.min ?? 0))) {
      errors[field.name] = `${field.label} must be a whole number of ${field.min ?? 0} or more.`;
    }
    if (field.type === 'select' && field.options && !field.options.some((o) => o.value === v)) {
      errors[field.name] = `${field.label} has an invalid value.`;
    }
    if (field.validate === 'date' && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(String(v))) {
      errors[field.name] = 'Use YYYY, YYYY-MM or YYYY-MM-DD.';
    }
    if (field.validate === 'url' && !/^https?:\/\/\S+$/i.test(String(v))) {
      errors[field.name] = 'Enter a full web address starting with http:// or https://.';
    }
    if (field.validate === 'urlList') {
      const lines = String(v).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const bad = lines.filter((s) => !/^https?:\/\/\S+$/i.test(s) || isUnsafeUrl(s));
      if (bad.length) errors[field.name] = 'Every line must be a full http(s) web address.';
      if (lines.length > 20) errors[field.name] = 'At most 20 links.';
    }
    if (field.validate === 'entryId' && !/^(anime-(1979|2005|1973)-\d{4}|movie-\d{4})$/.test(String(v))) {
      errors[field.name] = 'Entry IDs look like anime-2005-0012 or movie-0001.';
    }
    if (field.type === 'url' && typeof v === 'string' && v && isUnsafeUrl(v)) {
      errors[field.name] = 'That web address is not allowed.';
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}
