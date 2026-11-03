// The public contribution log: real activity from the backend, merged from
// two public views — submissions (with their outcome) and direct archive
// edits/deletions. Shows who did what, when, with avatars; review reasons
// and payloads stay private to the people involved.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import Icon from '@/components/Icon.jsx';
import Avatar from '@/components/Avatar.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { fetchPublicLog, fetchPublicEdits } from '@/lib/stats.js';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';

const entryPath = (entryId) => {
  if (!entryId) return null;
  if (entryId.startsWith('movie-')) return `/movies/${entryId}`;
  if (entryId.startsWith('anime-1973-')) return `/historical/1973/${entryId}`;
  if (entryId.startsWith('anime-1979-')) return `/anime/1979/${entryId}`;
  if (entryId.startsWith('anime-2005-')) return `/anime/2005/${entryId}`;
  if (entryId.startsWith('char-')) return `/characters/${entryId}`;
  if (entryId.startsWith('gadget-')) return `/gadgets/${entryId}`;
  return null;
};

const SUBMISSION_EVENT = {
  pending: { label: 'submitted', icon: 'plus', tone: 'pending' },
  accepted: { label: 'approved', icon: 'check', tone: 'ok' },
  declined: { label: 'declined', icon: 'close', tone: 'bad' },
  deleted: { label: 'removed', icon: 'trash', tone: 'muted' },
};

const EDIT_EVENT = {
  archive_direct_edit: { label: 'edited the archive', icon: 'edit', tone: 'review' },
  archive_entry_deleted: { label: 'deleted an archive entry', icon: 'trash', tone: 'bad' },
  archive_sync_recovered: { label: 'recovered a failed archive sync', icon: 'check', tone: 'ok' },
};

const fmtTime = (iso) => (iso
  ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : '—');

export default function ContributionLog() {
  useDocumentTitle('Contribution log');
  const { backendConfigured } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let active = true;
    if (!backendConfigured) return undefined;
    Promise.all([fetchPublicLog({ limit: 80 }), fetchPublicEdits({ limit: 80 })])
      .then(([submissions, edits]) => {
        if (!active) return;
        const events = [
          ...(submissions ?? []).map((row) => ({
            key: `c-${row.number}`,
            kind: 'submission',
            at: row.reviewed_at ?? row.submitted_at,
            submission: row,
          })),
          ...(edits ?? []).map((row) => ({
            key: `e-${row.id}`,
            kind: 'edit',
            at: row.created_at,
            edit: row,
          })),
        ].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
        setRows(events);
      })
      .catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [backendConfigured]);

  const visible = useMemo(() => (rows ?? []).filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'edits') return row.kind === 'edit';
    if (filter === 'approved') return row.kind === 'submission' && row.submission.status === 'accepted';
    return row.kind === 'submission';
  }), [rows, filter]);

  return (
    <PageContainer>
      <div className="page-opening">
        <p className="eyebrow">Community project</p>
        <h1>Contribution log</h1>
        <p className="page-opening__lead">
          Everything the community does to the archive, newest first: new submissions, review
          decisions, and direct edits by the staff. Review notes and submission details stay
          private to the people involved.
        </p>
      </div>

      {!backendConfigured ? (
        <EmptyState icon="archive" title="The contribution backend is not connected yet">
          <p>Contributions will appear here once the backend is configured.</p>
        </EmptyState>
      ) : error ? (
        <p className="notice notice--warn">
          The log could not be loaded right now ({error}). If this mentions a missing table or
          view, the 0002_public_activity.sql migration still needs to be run in the Supabase
          SQL editor.
        </p>
      ) : rows === null ? (
        <LoadingState label="Loading the contribution log…" />
      ) : rows.length === 0 ? (
        <EmptyState icon="archive" title="No activity yet">
          <p>Be the first: <Link to="/contribute">suggest a contribution</Link>.</p>
        </EmptyState>
      ) : (
        <>
          <div className="panel-tabs" role="tablist" aria-label="Filter activity">
            {[['all', 'All activity'], ['submissions', 'Submissions'], ['approved', 'Approved'], ['edits', 'Staff edits']].map(([id, label]) => (
              <button key={id} type="button" className={filter === id ? 'is-active' : ''}
                onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
          <ol className="activity-list">
            {visible.map((row) => {
              if (row.kind === 'edit') {
                const meta = EDIT_EVENT[row.edit.action?.replace(/\./g, '_')] ?? { label: row.edit.action, icon: 'edit', tone: 'review' };
                return (
                  <li key={row.key} className={`activity-item activity-item--${meta.tone}`}>
                    <Avatar name={row.edit.editor_name} url={row.edit.editor_avatar} size={34} />
                    <div className="activity-item__body">
                      <p className="activity-item__line">
                        <strong>{row.edit.editor_name ?? 'A staff member'}</strong>
                        <span className={`activity-chip activity-chip--${meta.tone}`}>
                          <Icon name={meta.icon} size={12} /> {meta.label}
                        </span>
                      </p>
                      <p className="activity-item__meta">
                        <span className="mono">{row.edit.entity_type} {row.edit.entity_id}</span>
                        {' · '}{fmtTime(row.at)}
                        {row.edit.commit_sha ? <> · commit <span className="mono">{String(row.edit.commit_sha).slice(0, 7)}</span></> : null}
                      </p>
                    </div>
                  </li>
                );
              }
              const sub = row.submission;
              const meta = SUBMISSION_EVENT[sub.status] ?? SUBMISSION_EVENT.pending;
              const path = entryPath(sub.entry_id);
              return (
                <li key={row.key} className={`activity-item activity-item--${meta.tone}`}>
                  <Avatar name={sub.contributor_name} url={sub.contributor_avatar} size={34} />
                  <div className="activity-item__body">
                    <p className="activity-item__line">
                      <strong>{sub.contributor_name ?? 'A community member'}</strong>
                      <span className={`activity-chip activity-chip--${meta.tone}`}>
                        <Icon name={meta.icon} size={12} /> {meta.label}
                      </span>
                      <span className="activity-item__title">#{sub.number} · {sub.title}</span>
                    </p>
                    <p className="activity-item__meta">
                      {path
                        ? <Link className="mono" to={path}>{sub.entry_id} →</Link>
                        : sub.entry_id ? <span className="mono">{sub.entry_id}</span>
                          : <span>{sub.type}</span>}
                      {' · '}{fmtTime(row.at)}
                      {sub.status === 'accepted' && sub.reviewer_name
                        ? <> · approved by {sub.reviewer_name}</> : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </PageContainer>
  );
}
