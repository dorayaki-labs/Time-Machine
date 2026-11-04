// Server-side mirror of the contribution form definitions
// (src/lib/contributionForms.js). The server is the authority: a payload that
// does not match this spec is rejected no matter what the browser validated.
// Keep the two files in sync when a form changes.
//
// Only the validation-relevant attributes are listed: { name, kind, required,
// validate, min, options } — labels and help text stay in the frontend.

const urlList = (name = 'references') => ({ name, kind: 'textarea', validate: 'urlList' });

export const FORM_SPECS = {
  'missing-entry': [
    { name: 'version', kind: 'select', required: true, options: ['anime-1979', 'anime-2005', 'anime-1973', 'movie'] },
    { name: 'number', kind: 'number', required: true, min: 1 },
    { name: 'title', kind: 'text', required: true },
    { name: 'alternateTitle', kind: 'text' },
    { name: 'releaseDate', kind: 'text', validate: 'date' },
    { name: 'description', kind: 'textarea' },
    urlList(),
    { name: 'notes', kind: 'textarea' },
  ],
  'metadata-correction': [
    { name: 'entryId', kind: 'text', required: true, validate: 'entryId' },
    { name: 'field', kind: 'text', required: true },
    { name: 'existing', kind: 'textarea', required: true },
    { name: 'proposed', kind: 'textarea', required: true },
    { name: 'references', kind: 'textarea', required: true, validate: 'urlList' },
  ],
  character: [
    { name: 'characterId', kind: 'text' },
    { name: 'nameEn', kind: 'text', required: true },
    { name: 'nameJa', kind: 'text' },
    { name: 'aliases', kind: 'text' },
    { name: 'description', kind: 'textarea', required: true },
    urlList(),
  ],
  gadget: [
    { name: 'gadgetId', kind: 'text' },
    { name: 'nameEn', kind: 'text', required: true },
    { name: 'nameJa', kind: 'text' },
    { name: 'description', kind: 'textarea', required: true },
    { name: 'howItWorks', kind: 'textarea' },
    { name: 'firstAppearance', kind: 'text' },
    urlList(),
  ],
  images: [
    { name: 'entryId', kind: 'text', required: true, validate: 'entryId' },
    { name: 'kind', kind: 'select', required: true, options: ['image', 'screenshot'] },
    { name: 'urls', kind: 'textarea', required: true, validate: 'urlList' },
    { name: 'alts', kind: 'textarea', required: true },
    { name: 'rights', kind: 'select', required: true, options: ['own-work', 'licensed'] },
    urlList('references'),
  ],
  source: [
    { name: 'entryId', kind: 'text', required: true, validate: 'entryId' },
    { name: 'sourceType', kind: 'select', required: true, options: ['direct', 'embed', 'youtube'] },
    { name: 'data', kind: 'textarea', required: true },
    { name: 'label', kind: 'text' },
    { name: 'language', kind: 'text' },
    { name: 'subtitles', kind: 'select', options: ['none', 'hard', 'soft'] },
    { name: 'subLanguages', kind: 'text' },
    { name: 'quality', kind: 'text' },
    { name: 'info', kind: 'textarea' },
  ],
  'broken-source': [
    { name: 'entryId', kind: 'text', required: true, validate: 'entryId' },
    { name: 'sourceId', kind: 'text' },
    { name: 'problem', kind: 'select', required: true, options: ['wont-play', 'removed', 'wrong-content', 'region', 'other'] },
    { name: 'details', kind: 'textarea', required: true },
  ],
};

export const DEFAULT_LIMITS = {
  submission_cooldown_minutes: 10,
  max_pending_per_user: 5,
  max_submissions_per_day: 20,
  duplicate_window_minutes: 60,
};

export async function loadConfig(db) {
  const stored = await db.configAll();
  const cfg = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(DEFAULT_LIMITS)) {
    const value = stored?.[key];
    if (value !== undefined && value !== null && Number.isFinite(Number(value))) cfg[key] = Number(value);
  }
  return cfg;
}
