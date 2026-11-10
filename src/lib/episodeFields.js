// Dynamic documentation accounting for episode pages (schema 4).
//
// Everything here is computed from the actual record: nothing is hardcoded,
// percentages and counts come straight from the JSON. Two levels are kept
// strictly apart — episode-level fields (broadcast metadata, sources,
// segments) and segment-level fields (the story of the selected segment) —
// so episode metadata is never counted as segment metadata.
//
// Kept free of catalog imports so the unit tests can run it against raw
// record files.

const hasText = (t) => (typeof t === 'string' ? Boolean(t.trim()) : Boolean(t?.en || t?.ja));

/**
 * Coarse documentation state of one segment, for the dot on segment cards:
 * full (most fields documented), partial (some), empty (none).
 */
export function segmentDocStatus(segment) {
  const fields = [
    hasText(segment?.title),
    Boolean(segment?.summary),
    Boolean(segment?.description),
    Boolean(segment?.image?.url),
    (segment?.screenshots?.length ?? 0) > 0,
    (segment?.characters?.length ?? 0) > 0,
    (segment?.gadgets?.length ?? 0) > 0,
    (segment?.voiceActors?.length ?? 0) > 0,
    Number.isFinite(segment?.durationMinutes),
  ];
  const done = fields.filter(Boolean).length;
  const level = done === 0 ? 'empty' : done >= Math.ceil(fields.length * 0.8) ? 'full' : 'partial';
  return { level, done, total: fields.length };
}

const field = (label, state, section) => ({ label, state, section });

/**
 * Full checklist for the archive completeness section: one group of
 * episode-level fields and one group of fields of the selected segment.
 * state: 'done' (green) | 'partial' (yellow) | 'missing' (grey).
 * `section` is the anchor id the chip scrolls to.
 */
export function episodeFieldChecklist(record, segment, segmentNumber, segmentCount) {
  const hasFullCoverageSource = (record?.sources ?? [])
    .some((s) => /^all\b/i.test(String(s?.notes ?? '')));
  const allSegmentsTitled = (record?.segments ?? []).every((s) => hasText(s.title));

  const episodeFields = [
    field('Broadcast date', record?.release?.date ? 'done' : 'missing', 'episode-top'),
    field('Original language', record?.originalLanguage ? 'done' : 'missing', 'episode-top'),
    field('Region', record?.release?.region ? 'done' : 'missing', 'episode-top'),
    field('Preservation', record?.preservation ? 'done' : 'missing', 'episode-top'),
    field('Viewing sources', (record?.sources ?? []).length > 0 ? 'done' : 'missing', 'sources'),
    field('Segments', allSegmentsTitled ? 'done' : 'missing', 'segments'),
  ];

  const titleState = hasText(segment?.title)
    ? (segment.title?.en && segment.title?.ja ? 'done' : 'partial')
    : 'missing';
  const segmentFields = [
    field('Title (EN)', segment?.title?.en ? 'done' : 'missing', 'episode-top'),
    field('Title (JA)', titleState, 'episode-top'),
    field('Summary', segment?.summary ? 'done' : 'missing', 'segment-info'),
    field('Synopsis', segment?.description ? 'done' : 'missing', 'segment-info'),
    field('Cover image', segment?.image?.url ? 'done' : 'missing', 'episode-top'),
    field('Screenshots', (segment?.screenshots?.length ?? 0) > 0 ? 'done' : 'missing', 'screenshots'),
    field('Characters', (segment?.characters?.length ?? 0) > 0 ? 'done' : 'missing', 'appearances'),
    field('Gadgets', (segment?.gadgets?.length ?? 0) > 0 ? 'done' : 'missing', 'appearances'),
    field('Voice actors', (segment?.voiceActors?.length ?? 0) > 0 ? 'done' : 'missing', 'voice-cast'),
    field('Duration', Number.isFinite(segment?.durationMinutes) ? 'done' : 'missing', 'segments'),
  ];

  const groups = [
    { id: 'episode', label: 'Episode', fields: episodeFields },
    { id: 'segment', label: `Segment ${segmentNumber}${segmentCount > 1 ? ` of ${segmentCount}` : ''}`, fields: segmentFields },
  ];
  const all = [...episodeFields, ...segmentFields];
  const done = all.filter((f) => f.state === 'done').length;
  return {
    groups,
    done,
    partial: all.filter((f) => f.state === 'partial').length,
    total: all.length,
    percent: all.length ? Math.round((done / all.length) * 100) : 0,
    hasFullCoverageSource,
  };
}
