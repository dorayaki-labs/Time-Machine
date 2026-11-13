// Attribution facts for an archive entry, derived purely from the public
// activity rows (public_log + public_edits shapes). No fetching, no React —
// the EntryAttribution component feeds it rows and renders what comes back.
//
// Honesty rules: nothing is fabricated — a record with no recorded activity
// gets null; "originally documented by" is the EARLIEST recorded act (first
// accepted contribution, or the earliest staff direct edit for records that
// predate the contribution system); "last updated by" is the most recent of
// those; "verified by" is the checker who reviewed the newest ACCEPTED
// contribution (a direct edit carries no review, so none is claimed).

/**
 * @param {string} entryId
 * @param {Array} logRows  public_log rows (entry_id, status, submitted_at,
 *                          reviewed_at, contributor_*, reviewer_*)
 * @param {Array} editRows public_edits rows (entity_id, action, created_at,
 *                          editor_*)
 * @returns {null|{
 *   originally: {name, avatar, username}|null,
 *   originallyAt: string|null,
 *   lastBy: {name, avatar, username}|null,
 *   lastAt: string|null,
 *   verifiedBy: {name, avatar}|null,
 * }}
 */
export function attributionFor(entryId, logRows = [], editRows = []) {
  const subs = (logRows ?? []).filter((r) => r.entry_id === entryId && r.status === 'accepted');
  const edits = (editRows ?? []).filter((e) => e.entity_id === entryId && e.action === 'archive.direct_edit');
  if (!subs.length && !edits.length) return null;

  const byOldest = (a, b) => String(a.at).localeCompare(String(b.at));
  const byNewest = (a, b) => String(b.at).localeCompare(String(a.at));
  const subEvent = (r) => ({ at: r.reviewed_at ?? r.submitted_at, row: r, kind: 'sub' });
  const editEvent = (e) => ({ at: e.created_at, row: e, kind: 'edit' });

  const events = [...subs.map(subEvent), ...edits.map(editEvent)].filter((e) => e.at);
  if (!events.length) return null;
  const first = [...events].sort(byOldest)[0];
  const last = events.sort(byNewest)[0];

  const person = (ev) => (ev.kind === 'sub'
    ? {
      name: ev.row.contributor_name,
      avatar: ev.row.contributor_avatar,
      username: ev.row.contributor_username,
    }
    : {
      name: ev.row.editor_name,
      avatar: ev.row.editor_avatar,
      username: ev.row.editor_username,
    });
  const newestAccepted = subs.map(subEvent).sort(byNewest)[0] ?? null;

  const sameAct = (a, b) => a && b
    && (a.name === b.name)
    && String(a.at ?? '') === String(b.at ?? '');

  return {
    originally: person(first),
    originallyAt: first.at,
    lastBy: sameAct(first, last) ? null : person(last),
    lastAt: sameAct(first, last) ? null : last.at,
    verifiedBy: newestAccepted?.row.reviewer_name
      ? { name: newestAccepted.row.reviewer_name, avatar: newestAccepted.row.reviewer_avatar }
      : null,
  };
}
