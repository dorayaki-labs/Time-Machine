// Private account page: profile, contribution statistics and the signed-in
// user's own contribution history with review details. Only the owner of the
// session can see anything here (RLS enforces the same rule on the server).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { fetchMyContributions, tallyStatuses, STATUS_LABELS } from '@/lib/stats.js';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function HistoryRow({ row }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <li className="log-item" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)} role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setOpen((o) => !o)}>
        <span className="log-item__num">#{row.number}</span>
        <span className="log-item__title">{row.title}</span>
        <span className={`chip chip--${row.status}`}>{STATUS_LABELS[row.status]}</span>
        <span className="log-item__meta">submitted {fmtDate(row.created_at)}</span>
        {row.reviewed_at ? <span className="log-item__meta">reviewed {fmtDate(row.reviewed_at)}</span> : null}
        {row.commit_sha ? <span className="log-item__meta mono">{String(row.commit_sha).slice(0, 7)}</span> : null}
      </li>
      {open ? (
        <li className="submission" style={{ marginTop: '-0.4rem' }}>
          <dl className="submission__fields">
            <div className="row"><dt>Type</dt><dd>{row.type}</dd></div>
            <div className="row"><dt>Entry</dt><dd>{row.entry_id ?? '—'}</dd></div>
            <div className="row"><dt>Submitted</dt><dd>{fmtTime(row.created_at)}</dd></div>
            <div className="row"><dt>Status</dt><dd>{STATUS_LABELS[row.status]}</dd></div>
            {row.reviewed_at ? <div className="row"><dt>Reviewed</dt><dd>{fmtTime(row.reviewed_at)}</dd></div> : null}
            {row.review_reason ? <div className="row"><dt>Reviewer note</dt><dd>{row.review_reason}</dd></div> : null}
            {row.commit_sha ? (
              <div className="row"><dt>Archive commit</dt><dd className="mono">{String(row.commit_sha).slice(0, 7)}</dd></div>
            ) : null}
          </dl>
        </li>
      ) : null}
    </>
  );
}

export default function Account() {
  const { user, profile, ready, backendConfigured, signIn } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!user) return undefined;
    fetchMyContributions()
      .then((data) => active && setRows(data))
      .catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [user]);

  if (!backendConfigured) {
    return (
      <PageContainer>
        <div className="page-opening"><h1>My contributions</h1></div>
        <EmptyState icon="user" title="The contribution backend is not connected yet">
          <p>Account features appear automatically once the backend is configured.</p>
        </EmptyState>
      </PageContainer>
    );
  }

  if (!ready) return <PageContainer><LoadingState label="Loading your account…" /></PageContainer>;

  if (!user) {
    return (
      <PageContainer>
        <div className="page-opening"><h1>My contributions</h1></div>
        <EmptyState icon="user" title="Sign in to see your contributions">
          <p>Sign in with Discord to submit contributions and follow their progress.</p>
          <button type="button" className="btn btn--primary" onClick={signIn}>Sign in with Discord</button>
        </EmptyState>
      </PageContainer>
    );
  }

  const tally = tallyStatuses(rows ?? []);
  const name = profile?.display_name ?? 'Member';

  return (
    <PageContainer>
      <div className="page-opening">
        <p className="eyebrow">Account</p>
        <h1>My contributions</h1>
        <p className="page-opening__lead">
          Signed in as <strong>{name}</strong>
          {profile?.role && profile.role !== 'member' ? <> · <span className="role-badge">{profile.role}</span></> : null}.
          Every submission you make and its review outcome is kept here for you; nobody else can see this page.
        </p>
      </div>

      {error ? <p className="notice notice--warn">Your history could not be loaded right now ({error}).</p> : null}

      <div className="stats-grid">
        <div className="stat-card"><span className="stat-card__value">{(rows ?? []).length}</span><span className="stat-card__label">total contributions</span></div>
        <div className="stat-card"><span className="stat-card__value">{tally.accepted}</span><span className="stat-card__label">accepted</span></div>
        <div className="stat-card"><span className="stat-card__value">{tally.pending}</span><span className="stat-card__label">pending review</span></div>
        <div className="stat-card"><span className="stat-card__value">{tally.declined}</span><span className="stat-card__label">declined</span></div>
      </div>

      {rows === null && !error ? <LoadingState label="Loading your history…" /> : null}

      {rows !== null && rows.length === 0 ? (
        <EmptyState icon="archive" title="No contributions yet">
          <p>When you <Link to="/contribute">submit a contribution</Link>, it will appear here with its review status.</p>
        </EmptyState>
      ) : null}

      {rows !== null && rows.length > 0 ? (
        <ul className="log-list" style={{ listStyle: 'none' }}>
          {rows.map((row) => <HistoryRow key={row.id} row={row} />)}
        </ul>
      ) : null}
    </PageContainer>
  );
}
