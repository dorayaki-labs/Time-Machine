// The public contribution log: real activity from the backend, merged from
// two public views — submissions (with their outcome) and direct archive
// edits/deletions. Shows who did what, when, with avatars; review reasons
// and payloads stay private to the people involved. Every row is pressable
// and opens a large detail view of that event.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import Icon from '@/components/Icon.jsx';
import Avatar from '@/components/Avatar.jsx';
import ContributionModal, { submissionView, editView } from '@/components/ContributionModal.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { fetchPublicLog, fetchPublicEdits } from '@/lib/stats.js';
import { SUBMISSION_EVENT, EDIT_EVENT, fmtTime } from '@/lib/activity.js';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';

export default function ContributionLog() {
  useDocumentTitle('Contribution log');
  const { backendConfigured } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    if (!backendConfigured) return undefined;
    // The two feeds are fetched independently: if one endpoint hiccups, the
    // other still renders instead of taking the whole page down with it.
    Promise.allSettled([fetchPublicLog({ limit: 80 }), fetchPublicEdits({ limit: 80 })])
      .then(([submissions, edits]) => {
        if (!active) return;
        const failed = [submissions, edits].filter((r) => r.status === 'rejected');
        if (failed.length === 2) {
          setError(String(failed[1].reason?.message ?? failed[0].reason?.message ?? 'network error'));
          return;
        }
        const events = [
          ...(submissions.status === 'fulfilled' ? submissions.value ?? [] : []).map((row) => ({
            key: `c-${row.number}`,
            kind: 'submission',
            at: row.reviewed_at ?? row.submitted_at,
            submission: row,
          })),
          ...(edits.status === 'fulfilled' ? edits.value ?? [] : []).map((row) => ({
            key: `e-${row.id}`,
            kind: 'edit',
            at: row.created_at,
            edit: row,
          })),
        ].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
        setRows(events);
        setError(failed.length ? `Part of the log did not load (${failed[0].reason?.message ?? 'network error'}).` : null);
      });
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
          Every change to the archive, newest first — submissions, review decisions, staff edits.
          Open any entry for the details; review notes stay between the people involved.
        </p>
      </div>

      {!backendConfigured ? (
        <EmptyState icon="archive" title="The contribution backend is not connected yet">
          <p>Contributions will appear here once the backend is configured.</p>
        </EmptyState>
      ) : error && rows === null ? (
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
          {error ? <p className="notice notice--warn" role="status">{error} What did load is shown below.</p> : null}
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
                  <li key={row.key}>
                    <button type="button" className={`activity-item activity-item--${meta.tone} activity-item--clickable`}
                      onClick={() => setSelected(editView(row.edit))}>
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
                    </button>
                  </li>
                );
              }
              const sub = row.submission;
              const meta = SUBMISSION_EVENT[sub.status] ?? SUBMISSION_EVENT.pending;
              return (
                <li key={row.key}>
                  <button type="button" className={`activity-item activity-item--${meta.tone} activity-item--clickable`}
                    onClick={() => setSelected(submissionView(sub))}>
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
                        {sub.entry_id ? <span className="mono">{sub.entry_id}</span> : <span>{sub.type}</span>}
                        {' · '}{fmtTime(row.at)}
                        {sub.status === 'accepted' && sub.reviewer_name
                          ? <> · accepted by {sub.reviewer_name}</> : null}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {selected ? <ContributionModal row={selected} onClose={() => setSelected(null)} /> : null}
    </PageContainer>
  );
}
