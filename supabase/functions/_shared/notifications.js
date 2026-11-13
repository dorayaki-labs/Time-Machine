// In-app notifications (the notifications table, migration 0004). Written by
// trusted backend operations ONLY — the review workflow (and anything else
// that changes a contribution's status) — never by the browser.
//
// Dedup is structural: each row carries dedup_key =
// `contribution.<id>.<type>` with a UNIQUE constraint, and the insert is an
// upsert that ignores duplicate keys. A retry of the same status transition
// (double-click, reconcile rerun, network retry) therefore can never create
// a second notification for the same event.

/** One contribution-status notification for its contributor.
 *  `contribution` is a contributions row; `type` is the status the user is
 *  being told about ('accepted' | 'declined' | 'deleted'). */
export async function notifyContributionStatus(db, contribution, type) {
  if (!contribution?.contributor_id) return;
  const number = contribution.number ?? null;
  const quoted = contribution.title ? `“${contribution.title}”` : 'this contribution';
  const suffix = number ? ` (#${number})` : '';
  const message = type === 'accepted'
    ? `Your contribution ${quoted}${suffix} has been accepted and is now part of the archive.`
    : type === 'declined'
      ? `Your contribution ${quoted}${suffix} was declined. You can review the details in your profile.`
      : `Your contribution ${quoted}${suffix} was deleted.`;

  // upsert + ignoreDuplicates keeps this idempotent against the unique
  // dedup_key (see migration 0004); errors are swallowed on purpose — a
  // failed notification must never fail the moderation action itself.
  const { error } = await db.insertUserNotification({
    user_id: contribution.contributor_id,
    type,
    contribution_number: number,
    title: contribution.title ?? 'Contribution',
    entry_id: contribution.entry_id ?? null,
    entry_series: contribution.entry_series ?? null,
    message,
    dedup_key: `contribution.${contribution.id}.${type}`,
  });
  if (error) console.warn('notifications: insert skipped:', error.message);
}
