// Declarative contribution form definitions. The form component renders and validates from these,
// so a real API can later accept exactly the same payload shape.
import { getLanguages } from './catalog.js';
import { parseDate } from './dates.js';

const langOptions = () => getLanguages().map((l) => ({ value: l.code, label: `${l.name} (${l.native})` }));
const urlList = (label = 'Reference URLs') => ({ name: 'references', label, type: 'textarea', rows: 3, validate: 'urlList', help: 'One link per line, e.g. https://example.com/page — leave empty if you have none.' });

export const CONTRIBUTION_CATEGORIES = [
  {
    id: 'missing-entry',
    label: 'Missing episode or movie',
    summary: 'Add an episode or film that is not in the archive yet.',
    fields: () => [
      { name: 'version', label: 'Anime version', type: 'select', required: true, options: [
        { value: 'anime-1979', label: 'Anime (1979)' }, { value: 'anime-2005', label: 'Anime (2005)' }, { value: 'anime-1973', label: 'Anime (1973, historical)' }, { value: 'movie', label: 'Movie' }] },
      { name: 'number', label: 'Episode or movie number', type: 'number', required: true, min: 1 },
      { name: 'title', label: 'Episode title', type: 'text', required: true },
      { name: 'alternateTitle', label: 'Alternative title', type: 'text' },
      { name: 'releaseDate', label: 'Release date', type: 'text', placeholder: 'YYYY, YYYY-MM or YYYY-MM-DD', validate: 'date' },
      { name: 'description', label: 'Description', type: 'textarea', rows: 4 },
      urlList(),
      { name: 'notes', label: 'Additional notes', type: 'textarea', rows: 3 },
    ],
  },
  {
    id: 'metadata-correction',
    label: 'Metadata correction',
    summary: 'Fix a title, date, or other detail that looks wrong.',
    fields: () => [
      { name: 'entryId', label: 'Entry ID', type: 'text', required: true, placeholder: 'e.g. anime-2005-0012', validate: 'entryId' },
      { name: 'field', label: 'Field being corrected', type: 'text', required: true, placeholder: 'e.g. release.date' },
      { name: 'existing', label: 'Existing information', type: 'textarea', rows: 2, required: true },
      { name: 'proposed', label: 'Proposed information', type: 'textarea', rows: 2, required: true },
      { ...urlList('Supporting references'), required: true },
    ],
  },
  {
    id: 'character',
    label: 'Character information',
    summary: 'Add or improve a character record.',
    fields: () => [
      { name: 'characterId', label: 'Character ID (if it exists)', type: 'text', placeholder: 'e.g. char-nobita' },
      { name: 'nameEn', label: 'English name', type: 'text', required: true },
      { name: 'nameJa', label: 'Japanese name', type: 'text' },
      { name: 'aliases', label: 'Aliases', type: 'text', help: 'Separate with commas.' },
      { name: 'description', label: 'Description', type: 'textarea', rows: 4, required: true },
      urlList(),
    ],
  },
  {
    id: 'gadget',
    label: 'Gadget information',
    summary: 'Add or improve a gadget record.',
    fields: () => [
      { name: 'gadgetId', label: 'Gadget ID (if it exists)', type: 'text', placeholder: 'e.g. gadget-anywhere-door' },
      { name: 'nameEn', label: 'English name', type: 'text', required: true },
      { name: 'nameJa', label: 'Japanese name', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea', rows: 3, required: true },
      { name: 'howItWorks', label: 'How it works', type: 'textarea', rows: 3 },
      { name: 'firstAppearance', label: 'First known appearance', type: 'text', placeholder: 'Entry ID or a short note' },
      urlList(),
    ],
  },
  {
    id: 'images',
    label: 'Images and screenshots',
    summary: 'Submit a main image or screenshots for an episode or movie.',
    fields: () => [
      { name: 'entryId', label: 'Episode or movie ID', type: 'text', required: true, placeholder: 'e.g. anime-1979-0001', validate: 'entryId' },
      { name: 'kind', label: 'What are you submitting?', type: 'select', required: true, options: [
        { value: 'image', label: 'Main image' }, { value: 'screenshot', label: 'Screenshot(s)' }] },
      { name: 'urls', label: 'Image URLs', type: 'textarea', rows: 3, required: true, validate: 'urlList', help: 'One link per line. Screenshots in order.' },
      { name: 'alts', label: 'Alt text', type: 'textarea', rows: 3, required: true, help: 'One line per image, describing what it shows. Read the rights note below.' },
      { name: 'rights', label: 'Rights confirmation', type: 'select', required: true, options: [
        { value: 'own-work', label: 'I made this and can share it' }, { value: 'licensed', label: 'Shared under a licence that allows this' }] },
      urlList('Where the images come from'),
    ],
  },
  {
    id: 'source',
    label: 'Viewing source submission',
    summary: 'Suggest a place to watch an episode or movie — a direct video file or an embed.',
    fields: () => [
      { name: 'entryId', label: 'Episode or movie ID', type: 'text', required: true, placeholder: 'e.g. movie-0001', validate: 'entryId' },
      { name: 'sourceType', label: 'Source type', type: 'select', required: true, options: [
        { value: 'direct', label: 'Direct video — the file itself, e.g. site.com/videos/video.mp4' },
        { value: 'embed', label: 'Embed — an iframe URL or the full iframe code' }] },
      { name: 'data', label: 'The video URL or iframe code', type: 'textarea', rows: 3, required: true,
        help: 'For direct: the media file URL. For embed: the embed URL or the whole <iframe …> snippet.' },
      { name: 'label', label: 'Source name', type: 'text', placeholder: 'e.g. Blu-ray rip, TV broadcast' },
      { name: 'language', label: 'Audio language', type: 'text', placeholder: 'e.g. Japanese' },
      { name: 'subtitles', label: 'Subtitles', type: 'select', options: [
        { value: 'none', label: 'None' },
        { value: 'hard', label: 'Yes — hard sub (burned into the video)' },
        { value: 'soft', label: 'Yes — soft sub (toggleable track)' }] },
      { name: 'subLanguages', label: 'Subtitle languages', type: 'text', placeholder: 'e.g. English, Spanish' },
      { name: 'quality', label: 'Quality', type: 'text', placeholder: 'e.g. 1080p, DVD rip' },
      { name: 'info', label: 'Additional information', type: 'textarea', rows: 3 },
    ],
  },
  {
    id: 'broken-source',
    label: 'Broken source report',
    summary: 'Tell us when a listed source no longer works.',
    fields: () => [
      { name: 'entryId', label: 'Episode or movie ID', type: 'text', required: true, validate: 'entryId' },
      { name: 'sourceId', label: 'Which source?', type: 'text', placeholder: 'e.g. the embed on movie-0001, or source 1 of 2' },
      { name: 'problem', label: 'What went wrong?', type: 'select', required: true, options: [
        { value: 'wont-play', label: 'It will not play' }, { value: 'removed', label: 'The video was removed' },
        { value: 'wrong-content', label: 'It is the wrong episode or movie' }, { value: 'region', label: 'It is blocked in my region' },
        { value: 'other', label: 'Something else' }] },
      { name: 'details', label: 'Details', type: 'textarea', rows: 4, required: true },
    ],
  },
];

const isUrl = (v) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };

/** Accepts bare domains (example.com/page) by adding the https:// scheme;
 *  leaves full URLs, empty lines and <iframe> snippets untouched. */
export const normalizeUrl = (line) => {
  const s = String(line ?? '').trim();
  if (!s || /^(https?:\/\/|<)/i.test(s)) return s;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s) ? `https://${s}` : s;
};

const urlLines = (v) => String(v ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

/** Returns an object of { fieldName: message } for every problem found. */
export function validateForm(fields, values, { entryExists } = {}) {
  const errors = {};
  for (const f of fields) {
    const raw = values[f.name];
    const v = typeof raw === 'string' ? raw.trim() : raw;
    if (f.required && (v === undefined || v === null || v === '')) { errors[f.name] = `${f.label} is required.`; continue; }
    if (v === undefined || v === null || v === '') continue;
    if (f.type === 'number' && (!Number.isInteger(Number(v)) || Number(v) < (f.min ?? 0))) errors[f.name] = `${f.label} must be a whole number of ${f.min ?? 0} or more.`;
    if (f.validate === 'date' && !parseDate(v)) errors[f.name] = 'Use the format YYYY, YYYY-MM or YYYY-MM-DD (for example 2005-04-15).';
    if (f.validate === 'url' && !isUrl(normalizeUrl(v))) errors[f.name] = 'Enter a full web address starting with http:// or https://. For offline sources such as a book, leave this empty and name the source in the notes instead.';
    if (f.validate === 'urlList') {
      const bad = urlLines(v).filter((s) => !isUrl(normalizeUrl(s)));
      if (bad.length) errors[f.name] = `These do not look like web addresses: ${bad.slice(0, 2).join(', ')}${bad.length > 2 ? '…' : ''}`;
    }
    if (f.validate === 'entryId') {
      if (!/^(anime-(1979|2005|1973)-\d{4}|movie-\d{4})$/.test(v)) errors[f.name] = 'Entry IDs look like anime-2005-0012 or movie-0001.';
      else if (entryExists && !entryExists(v)) errors[f.name] = 'This ID is not in the archive yet. Check the ID on the entry page.';
    }
  }
  return errors;
}
