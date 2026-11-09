// Per-record metadata helpers. Kept free of catalog imports so both the data
// layer and the UI (and the validator's expectations) can use them.

/**
 * Which fields of a full record are filled in. Drives both the completeness
 * indicator on detail pages and the automatic status, so they can never drift
 * apart. Works on merged catalogue entries: for schema-4 episodes the story
 * fields live on segments, and the entry carries the unions plus derived
 * cover/synopsis fallbacks (see catalog.js mergeEntry).
 */
export function metadataChecklist(record) {
  if (!record) return [];
  const isEpisode = record.type === 'episode';
  const segments = Array.isArray(record.segments) && record.segments.length ? record.segments : null;
  const segProp = (pick) => (segments ? segments.some(pick) : undefined);
  const title = segments
    ? { en: segments.some((s) => s.title?.en), ja: segments.some((s) => s.title?.ja) }
    : record.title;
  return [
    { label: 'English title', done: Boolean(typeof title === 'string' ? title : title?.en) },
    { label: 'Japanese title', done: Boolean(typeof title === 'string' ? title : title?.ja) },
    { label: 'Release date', done: Boolean(record.release?.date) },
    { label: 'Summary', done: segments ? segProp((s) => s.summary || s.description) : Boolean(record.summary) },
    { label: 'Main image', done: Boolean(record.image?.url) },
    { label: 'Characters', done: (record.characters?.length ?? 0) > 0 },
    { label: 'Gadgets', done: (record.gadgets?.length ?? 0) > 0 },
    { label: 'Voice actors', done: (record.voiceActors?.length ?? 0) > 0 },
    !isEpisode && { label: 'Runtime', done: Number.isFinite(record.durationMinutes) },
    { label: 'Screenshots', done: (record.screenshots?.length ?? 0) > 0 },
  ].filter(Boolean);
}

/**
 * The metadata status is computed, never stored: every field documented is
 * "complete", none at all is "metadata-incomplete", anything between is
 * "partial". The ids match data/categories.json metadataStatuses.
 */
export function computeStatus(record) {
  const checklist = metadataChecklist(record);
  if (!checklist.length) return 'metadata-incomplete';
  const done = checklist.filter((c) => c.done).length;
  if (done === checklist.length) return 'complete';
  if (done === 0) return 'metadata-incomplete';
  return 'partial';
}
