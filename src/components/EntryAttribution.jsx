// Contribution attribution for an archive page: who originally documented
// the record, who last updated it, and who verified it. Sourced ONLY from
// the public activity views (public_log for contributions, public_edits for
// staff direct edits) — no fabricated historical authorship: a record with
// no recorded activity renders nothing.
//
// Rules (kept honest on purpose):
//   * "Originally documented by" — the earliest recorded act on the entry:
//     the first accepted contribution, or the earliest staff direct edit if
//     the record predates the contribution system.
//   * "Last updated by" — the most recent accepted contribution review or
//     staff direct edit.
//   * "Verified by" — the checker who reviewed the newest accepted
//     contribution (a direct edit carries no review; none is claimed).
//   * Names link to the contributor's public profile when they have one.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { fetchPublicLog, fetchPublicEdits } from '@/lib/stats.js';
import { attributionFor } from '@/lib/attribution.js';
import { fmtDate } from '@/lib/activity.js';

function AttributionPerson({ who, when, children }) {
  return (
    <span className="attribution__fact">
      {children}
      {' '}
      {who.username
        ? <Link className="attribution__who" to={`/${who.username}`}><Avatar name={who.name} url={who.avatar} size={18} /> {who.name}</Link>
        : <span className="attribution__who"><Avatar name={who.name} url={who.avatar} size={18} /> {who.name}</span>}
      {when ? <span className="attribution__when muted small"> · {fmtDate(when)}</span> : null}
    </span>
  );
}

// The public activity feeds are shared by every archive page that shows
// attribution. One module-level promise per session: the first page loads
// them, every other page reuses the rows — no refetch per page view. Public,
// immutable-ish data; exactly what the contribution log already serves.
let activityCache = null;
function loadPublicActivity() {
  if (!activityCache) {
    activityCache = Promise.allSettled([fetchPublicLog({ limit: 500 }), fetchPublicEdits({ limit: 300 })])
      .then(([subs, edits]) => {
        if (subs.status === 'rejected' && edits.status === 'rejected') throw new Error('activity unavailable');
        return {
          logRows: subs.status === 'fulfilled' ? subs.value ?? [] : [],
          editRows: edits.status === 'fulfilled' ? edits.value ?? [] : [],
        };
      })
      .catch(() => { activityCache = null; throw new Error('activity unavailable'); });
  }
  return activityCache;
}

/**
 * The attribution panel for one archive page. Fetches the public activity
 * once (the views are public — no sign-in needed), derives the facts and
 * renders nothing when the entry has no recorded history.
 */
export default function EntryAttribution({ entryId }) {
  const { backendConfigured } = useAuth();
  const [data, setData] = useState(null); // { logRows, editRows }
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!backendConfigured || !entryId) return undefined;
    loadPublicActivity()
      .then((rows) => active && setData(rows))
      .catch(() => active && setFailed(true));
    return () => { active = false; };
  }, [backendConfigured, entryId]);

  const facts = useMemo(
    () => (data ? attributionFor(entryId, data.logRows, data.editRows) : null),
    [data, entryId],
  );

  if (!backendConfigured || failed) return null;
  // Nothing recorded yet: no attribution is invented for legacy records.
  if (data === null || !facts) return null;

  return (
    <section className="attribution" aria-label="Record attribution">
      <span className="attribution__icon" aria-hidden="true"><Avatar name={facts.originally?.name ?? '?'} url={facts.originally?.avatar} size={22} /></span>
      <span className="attribution__facts">
        {facts.originally ? (
          <AttributionPerson who={facts.originally} when={facts.originallyAt}>Originally documented by</AttributionPerson>
        ) : null}
        {facts.lastBy && (!facts.originally || facts.lastBy.name !== facts.originally.name || facts.lastAt !== facts.originallyAt) ? (
          <AttributionPerson who={facts.lastBy} when={facts.lastAt}>Last updated by</AttributionPerson>
        ) : null}
        {facts.verifiedBy ? (
          <AttributionPerson who={facts.verifiedBy}>Verified by</AttributionPerson>
        ) : null}
      </span>
    </section>
  );
}
