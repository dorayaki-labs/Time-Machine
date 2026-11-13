// My Profile (the signed-in user's own profile): Discord identity, role,
// member since, the public profile URL, prominent contribution statistics,
// the activity calendar and the private contribution history with review
// details, editing and withdrawing. Everything private stays behind the
// sign-in — the public counterpart lives at /{username}.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import Avatar from '@/components/Avatar.jsx';
import Icon from '@/components/Icon.jsx';
import RoleBadge from '@/components/RoleBadge.jsx';
import ContributionCalendar from '@/components/ContributionCalendar.jsx';
import ContributionModal, { submissionView } from '@/components/ContributionModal.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { fetchMyContributions, STATUS_LABELS } from '@/lib/stats.js';
import { tallyContributions, activityByDay } from '@/lib/profileStats.js';
import { reviewContribution } from '@/lib/staffApi.js';
import { fmtDate } from '@/lib/activity.js';

function StatTile({ value, label, tone }) {
  return (
    <div className={`stat-card profile-stat${tone ? ` profile-stat--${tone}` : ''}`}>
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}

function HistoryRow({ row, onChanged }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const pending = row.status === 'pending';

  const startEdit = () => {
    setJson(JSON.stringify(row.payload ?? {}, null, 2));
    setEditing(true);
    setMessage(null); setError(null);
  };

  const saveEdit = async () => {
    setBusy(true); setError(null);
    try {
      const payloadEdited = JSON.parse(json);
      await reviewContribution({ action: 'save-draft', contributionId: row.id, payloadEdited });
      setMessage('Saved. Your submission keeps its place in the review queue.');
      setEditing(false);
      onChanged?.();
    } catch (err) {
      setError(err.message.startsWith('Unexpected') || err instanceof SyntaxError
        ? `That is not valid JSON: ${err.message}` : err.message);
    } finally { setBusy(false); }
  };

  const withdraw = async () => {
    if (!window.confirm(`Withdraw contribution #${row.number}? It will be removed from the review queue.`)) return;
    setBusy(true); setError(null);
    try {
      await reviewContribution({ action: 'delete', contributionId: row.id, reason: 'Withdrawn by the author.' });
      setMessage('Withdrawn.');
      onChanged?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const view = submissionView({ ...row, submitted_at: row.created_at });

  return (
    <>
      <li className="log-item log-item--clickable" onClick={() => setOpen(true)} role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}>
        <span className="log-item__num">#{row.number}</span>
        <span className="log-item__title">{row.title}</span>
        <span className={`chip chip--${row.status}`}>{STATUS_LABELS[row.status]}</span>
        <span className="log-item__meta">submitted {fmtDate(row.created_at)}</span>
        {row.reviewed_at ? <span className="log-item__meta">reviewed {fmtDate(row.reviewed_at)}</span> : null}
        {row.commit_sha ? <span className="log-item__meta mono">{String(row.commit_sha).slice(0, 7)}</span> : null}
      </li>
      {open ? (
        <ContributionModal
          row={{ ...view, contributor: { name: 'You' } }}
          onClose={() => { setOpen(false); setEditing(false); setMessage(null); setError(null); }}
        >
          <div className="contribution-modal__actions">
            {pending && !editing ? (
              <div className="btn-row">
                <button type="button" className="btn btn--ghost" onClick={startEdit}>
                  <Icon name="edit" size={15} /> Edit this submission
                </button>
                <button type="button" className="btn btn--ghost btn--danger" disabled={busy} onClick={withdraw}>
                  <Icon name="trash" size={15} /> Withdraw
                </button>
              </div>
            ) : null}
            {editing ? (
              <div className="field">
                <label>Submission answers <span className="field__opt">(JSON — same shape you submitted)</span></label>
                <textarea rows={10} className="mono" value={json} spellCheck={false} onChange={(e) => setJson(e.target.value)} />
                <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn--primary" disabled={busy} onClick={saveEdit}>Save changes</button>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : null}
            {message ? <p className="notice" role="status">{message}</p> : null}
            {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
          </div>
        </ContributionModal>
      ) : null}
    </>
  );
}

export default function Account() {
  const { user, profile, ready, backendConfigured, signIn } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    if (!user) return;
    setError(null);
    fetchMyContributions()
      .then((data) => setRows(data))
      .catch((err) => setError(err.message));
  };

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
        <div className="page-opening"><h1>My profile</h1></div>
        <EmptyState icon="user" title="The contribution backend is not connected yet">
          <p>Account features appear automatically once the backend is configured.</p>
        </EmptyState>
      </PageContainer>
    );
  }

  if (!ready) return <PageContainer><LoadingState label="Loading your profile…" /></PageContainer>;

  if (!user) {
    return (
      <PageContainer>
        <div className="page-opening"><h1>My profile</h1></div>
        <EmptyState icon="user" title="Sign in to see your profile">
          <p>Sign in with Discord to build your contributor profile, submit contributions and follow their progress.</p>
          <button type="button" className="btn btn--primary" onClick={signIn}>Sign in with Discord</button>
        </EmptyState>
      </PageContainer>
    );
  }

  const tally = tallyContributions(rows ?? []);
  const activity = activityByDay(rows ?? []);
  const name = profile?.display_name ?? 'Member';
  const publicPath = profile?.username ? `/${profile.username}` : null;
  const publicUrl = publicPath ? `${window.location.origin}${publicPath}` : null;

  const copyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <PageContainer>
      <div className="page-opening">
        <p className="eyebrow">Account</p>
        <h1>My profile</h1>
        <p className="page-opening__cta">
          <Link to="/contribute" className="btn btn--primary btn--sm"><Icon name="plus" size={15} /> Contribute</Link>
        </p>
      </div>

      <div className="profile-header profile-header--own">
        <Avatar name={name} url={profile?.avatar_url} size={72} />
        <div className="profile-header__main">
          <h1 className="profile-header__name">
            {name}
            <RoleBadge role={profile?.role} showMember />
          </h1>
          <p className="profile-header__handle mono">
            {profile?.username ? `@${profile.username}` : <span className="muted">@username will appear after your next Discord sign-in</span>}
          </p>
          <p className="profile-header__meta muted">
            <Icon name="clock" size={13} /> Member since {fmtDate(profile?.created_at)}
            {profile?.role === 'owner' ? ' · owner of the archive' : ''}
          </p>
          {publicUrl ? (
            <div className="profile-header__url">
              <Link className="mono" to={publicPath}>{publicUrl}</Link>
              <button type="button" className={`btn btn--ghost btn--sm${copied ? ' is-copied' : ''}`} onClick={copyPublicUrl}>
                <Icon name={copied ? 'check' : 'copyLink'} size={14} /> {copied ? 'Copied!' : 'Copy link'}
              </button>
              <Link className="btn btn--ghost btn--sm" to={publicPath}>View public profile</Link>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="notice notice--warn">Your history could not be loaded right now ({error}).</p> : null}

      {/* Submitted = everything ever sent; accepted = what actually made it
          into the archive. The two are deliberately separate. */}
      <div className="stats-grid profile-stats">
        <StatTile value={tally.submitted} label="contributions submitted" />
        <StatTile value={tally.accepted} label="accepted" tone="accepted" />
        <StatTile value={tally.pending} label="pending review" tone="pending" />
        <StatTile value={tally.declined} label="declined" tone="declined" />
      </div>

      <section className="detail-section" aria-labelledby="my-activity-title">
        <header className="detail-section__head">
          <h2 id="my-activity-title">Activity</h2>
          <span className="detail-section__aside muted small">contributions per day</span>
        </header>
        <ContributionCalendar activity={activity} />
      </section>

      <section className="detail-section" aria-labelledby="my-history-title">
        <header className="detail-section__head">
          <h2 id="my-history-title">My contributions</h2>
          <span className="detail-section__aside muted small">private — only you see this list</span>
        </header>

        {rows === null && !error ? <LoadingState label="Loading your history…" /> : null}

        {rows !== null && rows.length === 0 ? (
          <EmptyState icon="archive" title="No contributions yet">
            <p>When you <Link to="/contribute">submit a contribution</Link>, it will appear here with its review status.</p>
          </EmptyState>
        ) : null}

        {rows !== null && rows.length > 0 ? (
          <ul className="log-list" style={{ listStyle: 'none' }}>
            {rows.map((row) => <HistoryRow key={row.id} row={row} onChanged={load} />)}
          </ul>
        ) : null}

        <p className="muted small">
          Review details — reasons, notes and your submitted answers — are visible to you and the reviewing staff only.
        </p>
      </section>
    </PageContainer>
  );
}
