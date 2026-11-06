// Shared vocabulary for contribution activity lists: the public log, the
// homepage feed and the per-page contribution boxes all label, time and link
// events the same way, so the maps and formatters live here once.

export const SUBMISSION_EVENT = {
  pending: { label: 'submitted', icon: 'plus', tone: 'pending' },
  accepted: { label: 'approved', icon: 'check', tone: 'ok' },
  declined: { label: 'declined', icon: 'close', tone: 'bad' },
  deleted: { label: 'removed', icon: 'trash', tone: 'muted' },
};

export const EDIT_EVENT = {
  archive_direct_edit: { label: 'edited the archive', icon: 'edit', tone: 'review' },
  archive_entry_deleted: { label: 'deleted an archive entry', icon: 'trash', tone: 'bad' },
  archive_sync_recovered: { label: 'recovered a failed archive sync', icon: 'check', tone: 'ok' },
};

export const fmtTime = (iso) => (iso
  ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : '—');

/** Detail-page route for an entry / character / gadget id, or null. */
export const entryPath = (entryId) => {
  if (!entryId) return null;
  if (entryId.startsWith('movie-')) return `/movies/${entryId}`;
  if (entryId.startsWith('anime-1973-')) return `/historical/1973/${entryId}`;
  if (entryId.startsWith('anime-1979-')) return `/anime/1979/${entryId}`;
  if (entryId.startsWith('anime-2005-')) return `/anime/2005/${entryId}`;
  if (entryId.startsWith('char-')) return `/characters/${entryId}`;
  if (entryId.startsWith('gadget-')) return `/gadgets/${entryId}`;
  return null;
};

/** Human label for a contribution type id. */
export const contributionTypeLabel = (type) => ({
  'archive-edit': 'Direct record edit',
  'missing-entry': 'Missing episode or movie',
  'metadata-correction': 'Metadata correction',
  'character': 'Character information',
  'gadget': 'Gadget information',
  'images': 'Images and screenshots',
  'source': 'Viewing source',
  'broken-source': 'Broken source report',
}[type] ?? type);
