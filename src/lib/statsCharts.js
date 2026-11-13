// Pure computations behind the statistics page. No fetching, no React — the
// page feeds in the loaded catalogue (entries, characters, gadgets) and the
// public activity rows, and gets back chart-ready series. Everything here is
// unit-testable (scripts/test-profile-stats.mjs) and deliberately honest:
//
// DATA INTEGRITY RULES (do not "fix"):
//   * "Documented" = the entry exists in the archive (an index record with
//     a record file). The archive does not define an EXPECTED episode total,
//     so no percentage of "all episodes ever" is invented — progress is
//     completeness WITHIN the documented set.
//   * "Fully documented" = every metadataChecklist item done (the same rule
//     as the record status chips).
//   * Segments are never counted as episodes: every count below is per
//     ENTRY; a two-segment episode is one documented episode.
//   * Character/gadget appearances: one entry counts one character once,
//     even if the record lists it twice (dedup per entry). Missing refs are
//     not zero — they are absent from the ranking entirely.
//   * Community numbers come from public_log rows only; rows without the
//     field needed for a chart are skipped, never counted as zero.

/** Status tallies over a set of entries (see mergeEntry for `status`). */
export function archiveCategoryStats(entries) {
  const stats = { total: 0, episodes: 0, movies: 0, complete: 0, partial: 0, incomplete: 0, withSources: 0 };
  for (const entry of entries ?? []) {
    stats.total += 1;
    if (entry.kind === 'movie') stats.movies += 1; else stats.episodes += 1;
    if (entry.status === 'complete') stats.complete += 1;
    else if (entry.status === 'partial') stats.partial += 1;
    else stats.incomplete += 1;
    if (entry.availability === 'available') stats.withSources += 1;
  }
  return stats;
}

/** Entries grouped by broadcast year ({year, count}), oldest first. */
export function entriesByYear(entries) {
  const counts = new Map();
  for (const entry of entries ?? []) {
    const year = entry.release?.date ? Number(String(entry.release.date).slice(0, 4)) : null;
    if (!year || Number.isNaN(year)) continue; // unknown year is absent, not zero
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, count]) => ({ label: String(year), value: count }));
}

/** Histogram of segments per episode: one entry, one bucket. */
export function segmentsHistogram(entries) {
  const counts = new Map();
  for (const entry of entries ?? []) {
    if (entry.kind === 'movie') continue; // movies have no segments by shape
    const n = Array.isArray(entry.segments) ? entry.segments.length : null;
    if (!n || n < 1) continue; // unknown segment count is absent, not zero
    const bucket = Math.min(n, 4);
    const label = bucket === 4 ? '4+' : String(bucket);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return ['1', '2', '3', '4+']
    .filter((label) => counts.has(label))
    .map((label) => ({ label: `${label} segment${label === '1' ? '' : 's'}`, value: counts.get(label) }));
}

/** Histogram of distinct characters referenced per entry. */
export function characterLoadHistogram(entries) {
  const counts = new Map();
  for (const entry of entries ?? []) {
    const n = new Set(entry.characters ?? []).size;
    if (!n) continue; // no documented characters: absent, not zero
    const bucket = Math.min(n, 5);
    const label = bucket === 5 ? '5+' : String(bucket);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return ['1', '2', '3', '4', '5+']
    .filter((label) => counts.has(label))
    .map((label) => ({ label: `${label} character${label === '1' ? '' : 's'}`, value: counts.get(label) }));
}

/**
 * Appearance ranking over a set of entries. `records` is the catalog array
 * ([{ id, name }]), `refKey` the entry field that references them
 * ('characters' | 'gadgets') — passed in explicitly so this module stays
 * importable outside the browser. Returns every record that is referenced
 * at least once, most first; records never referenced are absent (a ranking
 * of absent items would read as "zero appearances confirmed", which the
 * archive does not claim).
 */
export function usageRanking(entries, records = [], refKey = 'characters') {
  const catalog = records;
  const kind = refKey;
  const counts = new Map();
  for (const entry of entries ?? []) {
    const refs = new Set(entry[refKey] ?? []);
    for (const id of refs) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return catalog
    .map((item) => ({
      id: item.id,
      name: item.name?.en ?? item.name?.ja ?? item.id,
      value: counts.get(item.id) ?? 0,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

/**
 * Most common character pairings: the top co-appearances across entries.
 * Each entry votes once per pair it references. `characters` is the catalog
 * array, passed in explicitly (see usageRanking).
 */
export function characterCombos(entries, characters = [], { limit = 6 } = {}) {
  const catalog = characters;
  const names = new Map(catalog.map((c) => [c.id, c.name?.en ?? c.name?.ja ?? c.id]));
  const counts = new Map();
  for (const entry of entries ?? []) {
    const refs = [...new Set(entry.characters ?? [])].sort();
    for (let i = 0; i < refs.length; i += 1) {
      for (let j = i + 1; j < refs.length; j += 1) {
        const key = `${refs[i]}+${refs[j]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => {
      const [a, b] = key.split('+');
      return { id: key, label: `${names.get(a) ?? a} + ${names.get(b) ?? b}`, value };
    });
}

/** Community tallies from public_log rows (public activity feed shape). */
export function communityStats(rows) {
  const byStatus = { submitted: 0, accepted: 0, pending: 0, declined: 0, deleted: 0 };
  const bySeries = new Map();
  const byContributor = new Map();
  for (const row of rows ?? []) {
    byStatus.submitted += 1;
    if (byStatus[row.status] !== undefined) byStatus[row.status] += 1;
    if (row.entry_series) bySeries.set(row.entry_series, (bySeries.get(row.entry_series) ?? 0) + 1);
    if (row.status === 'accepted' && row.contributor_username) {
      const agg = byContributor.get(row.contributor_username) ?? { username: row.contributor_username, name: row.contributor_name, value: 0 };
      agg.value += 1;
      byContributor.set(row.contributor_username, agg);
    }
  }
  return {
    byStatus,
    bySeries: [...bySeries.entries()].map(([series, count]) => ({ series, count })),
    topContributors: [...byContributor.values()].sort((a, b) => b.value - a.value).slice(0, 8),
  };
}

/** Submissions per month for the last `months` months, oldest first. */
export function monthlyActivity(rows, { months = 12, today = new Date() } = {}) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), value: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const row of rows ?? []) {
    const at = row?.submitted_at;
    if (!at) continue;
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const i = index.get(key);
    if (i !== undefined) buckets[i].value += 1;
  }
  return buckets;
}
