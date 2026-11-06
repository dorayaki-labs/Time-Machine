// A small activity box on every archive detail page (episode, movie,
// character, gadget) listing the contributions and staff edits made to THIS
// page's record. Clicking it opens a fullscreen list of just this page's
// history. Public data only (the same views the contribution log uses), so
// it renders nothing when the backend is not configured.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import ContributionModal, { submissionView, editView } from './ContributionModal.jsx';
import { SUBMISSION_EVENT, EDIT_EVENT, fmtTime } from '@/lib/activity.js';
import { useAuth } from '@/hooks/useAuth.jsx';
import { supabase } from '@/lib/backend.js';

const PAGE_LIMIT = 60;

async function fetchPageActivity(entryId) {
  const [subs, edits] = await Promise.all([
    supabase.from('public_log')
      .select('number, title, type, entry_id, status, submitted_at, reviewed_at, contributor_name, contributor_avatar, reviewer_name, reviewer_avatar')
      .eq('entry_id', entryId)
      .order('submitted_at', { ascending: false })
      .limit(PAGE_LIMIT),
    supabase.from('public_edits')
      .select('id, action, entity_type, entity_id, commit_sha, created_at, editor_name, editor_avatar')
      .eq('entity_id', entryId)
      .order('created_at', { ascending: false })
      .limit(PAGE_LIMIT),
  ]);
  if (subs.error) throw new Error(subs.error.message);
  if (edits.error) throw new Error(edits.error.message);
  return [
    ...(subs.data ?? []).map((row) => ({ key: `c-${row.number}`, at: row.reviewed_at ?? row.submitted_at, row: submissionView(row) })),
    ...(edits.data ?? []).map((row) => ({ key: `e-${row.id}`, at: row.created_at, row: editView(row) })),
  ].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
}

function ActivityLine({ event, onClick }) {
  const view = event.row;
  const meta = view.kind === 'edit'
    ? (EDIT_EVENT[view.action?.replace(/\./g, '_')] ?? { label: 'edited the archive', icon: 'edit', tone: 'review' })
    : (SUBMISSION_EVENT[view.status] ?? SUBMISSION_EVENT.pending);
  return (
    <button type="button" className={`page-contributions__row page-contributions__row--${meta.tone}`} onClick={onClick}>
      <Icon name={meta.icon} size={14} />
      <span className="page-contributions__who">
        {view.contributor?.name ?? view.reviewer?.name ?? 'Someone'}{' '}
        <span className="page-contributions__verb">{meta.label}</span>
        {view.number ? <span className="mono"> #{view.number}</span> : null}
      </span>
      <span className="page-contributions__when">{fmtTime(event.at)}</span>
    </button>
  );
}

export default function PageContributions({ entryId }) {
  const { backendConfigured } = useAuth();
  const [events, setEvents] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!backendConfigured || !entryId) return undefined;
    let active = true;
    fetchPageActivity(entryId)
      .then((rows) => active && setEvents(rows))
      .catch(() => active && setFailed(true));
    return () => { active = false; };
  }, [backendConfigured, entryId]);

  if (!backendConfigured || failed || (events !== null && events.length === 0)) return null;

  if (events === null) {
    return (
      <div className="page-contributions" aria-busy="true">
        <p className="page-contributions__head muted small"><Icon name="clock" size={14} /> Loading page activity…</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-contributions">
        <button type="button" className="page-contributions__toggle" onClick={() => setOpen(true)}
          aria-haspopup="dialog" aria-expanded={open}>
          <Icon name="clock" size={15} />
          <span><strong>{events.length}</strong> {events.length === 1 ? 'contribution' : 'contributions'} on this page</span>
          <span className="page-contributions__latest">
            Latest: {events[0].row.contributor?.name ?? events[0].row.reviewer?.name ?? 'community'}
          </span>
          <Icon name="arrowRight" size={14} />
        </button>
        <div className="page-contributions__list">
          {events.slice(0, 3).map((event) => (
            <ActivityLine key={event.key} event={event} onClick={() => setOpen(true)} />
          ))}
        </div>
      </div>

      {open ? (
        <ContributionModal
          row={{ kind: 'page', title: `History of ${entryId}`, entryId }}
          onClose={() => setOpen(false)}
        >
          <p className="muted small" style={{ marginTop: 0 }}>
            Every contribution and staff edit recorded for <span className="mono">{entryId}</span>, newest first.
            Open an item to see who did what and when.
          </p>
          <ol className="activity-list">
            {events.map((event) => (
              <li key={event.key} className="activity-item">
                <Avatar
                  name={event.row.contributor?.name ?? event.row.reviewer?.name}
                  url={event.row.contributor?.avatar ?? event.row.reviewer?.avatar}
                  size={34}
                />
                <div className="activity-item__body">
                  <p className="activity-item__line">
                    <strong>{event.row.contributor?.name ?? event.row.reviewer?.name ?? 'A community member'}</strong>
                    <PageEventChip view={event.row} />
                    {event.row.number ? <span className="activity-item__title">#{event.row.number} · {event.row.title}</span> : null}
                  </p>
                  <p className="activity-item__meta">{fmtTime(event.at)}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="muted small">
            Want to add to this page? Use <strong>Edit this entry</strong> above, or the{' '}
            <Link to="/contribute">contribution forms</Link>.
          </p>
        </ContributionModal>
      ) : null}
    </>
  );
}

function PageEventChip({ view }) {
  const meta = view.kind === 'edit'
    ? (EDIT_EVENT[view.action?.replace(/\./g, '_')] ?? { label: 'edited the archive', icon: 'edit', tone: 'review' })
    : (SUBMISSION_EVENT[view.status] ?? SUBMISSION_EVENT.pending);
  return (
    <span className={`activity-chip activity-chip--${meta.tone}`}>
      <Icon name={meta.icon} size={12} /> {meta.label}
    </span>
  );
}
