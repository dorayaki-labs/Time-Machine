// A contributor's public profile (/{username}). Public data only, exactly
// what the public_profiles and public_log views serve: identity (avatar,
// display name, username, role, member since), contribution tallies, the
// activity calendar and their contribution history with statuses. Private
// things (review reasons, payloads, drafts) stay behind the sign-in.
//
// Route safety: React Router ranks static routes above this dynamic one, so
// /movies & co. always win; a curated reserved list below renders NotFound
// early so a username can never squat a known path (present or future).

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import Avatar from '@/components/Avatar.jsx';
import Icon from '@/components/Icon.jsx';
import RoleBadge from '@/components/RoleBadge.jsx';
import ContributionCalendar from '@/components/ContributionCalendar.jsx';
import ContributionModal, { submissionView } from '@/components/ContributionModal.jsx';
import NotFound from './NotFound.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { useAuth } from '@/hooks/useAuth.jsx';
import { fetchPublicProfile, fetchPublicContributions } from '@/lib/profiles.js';
import { tallyContributions, activityByDay } from '@/lib/profileStats.js';
import { fmtDate } from '@/lib/activity.js';
import { STATUS_LABELS } from '@/lib/stats.js';

// Route segments that must never resolve to a profile page. Everything here
// is either a live route or one on the roadmap; usernames live in their own
// namespace (Discord's), but this keeps the URL space unambiguous.
export const RESERVED_USERNAMES = new Set([
  'anime', 'movies', 'manga', 'characters', 'gadgets', 'historical',
  'search', 'about', 'credits', 'customize', 'contribute', 'stats', 'log',
  'play', 'settings', 'account', 'staff', 'owner', 'assets', 'api',
  'admin', 'login', 'logout', 'signin', 'signup', 'register', 'u', 'user',
  'public', 'static', 'archive', 'data', 'fonts', 'menu-images',
]);

function StatTile({ value, label, tone }) {
  return (
    <div className={`stat-card profile-stat${tone ? ` profile-stat--${tone}` : ''}`}>
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}

export default function PublicProfile() {
  const { username } = useParams();
  const { backendConfigured } = useAuth();
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = missing
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useDocumentTitle(profile ? `${profile.display_name} (@${profile.username}) · Contributor` : 'Contributor profile');

  useEffect(() => {
    let active = true;
    setProfile(undefined); setRows(null); setError(null); setSelected(null);
    if (!backendConfigured || !username || RESERVED_USERNAMES.has(username.toLowerCase())) {
      setProfile(null);
      return undefined;
    }
    fetchPublicProfile(username)
      .then((found) => {
        if (!active) return;
        setProfile(found);
        if (!found) return;
        return fetchPublicContributions(found.username)
          .then((history) => active && setRows(history ?? []))
          .catch((err) => active && setError(err.message));
      })
      .catch((err) => active && (setProfile(null), setError(err.message)));
    return () => { active = false; };
  }, [username, backendConfigured]);

  if (!backendConfigured) {
    return (
      <PageContainer>
        <div className="page-opening"><h1>Contributor profile</h1></div>
        <EmptyState icon="user" title="The contribution backend is not connected yet">
          <p>Contributor profiles appear automatically once the backend is configured.</p>
        </EmptyState>
      </PageContainer>
    );
  }

  if (profile === undefined) return <PageContainer><LoadingState label="Loading profile…" /></PageContainer>;

  if (!profile) {
    return (
      <NotFound
        title="No contributor by that name"
        message={username
          ? `@${username} has no public profile — either the username is unknown, or the account hasn't contributed yet.`
          : 'This profile could not be found.'}
      />
    );
  }

  const tally = tallyContributions(rows ?? []);
  const activity = activityByDay(rows ?? []);

  return (
    <PageContainer>
      <div className="profile-header">
        <Avatar name={profile.display_name} url={profile.avatar_url} size={72} />
        <div className="profile-header__main">
          <h1 className="profile-header__name">
            {profile.display_name}
            <RoleBadge role={profile.role} showMember />
          </h1>
          <p className="profile-header__handle mono">@{profile.username}</p>
          <p className="profile-header__meta muted">
            <Icon name="clock" size={13} /> Contributor since {fmtDate(profile.created_at)}
          </p>
        </div>
      </div>

      {error ? <p className="notice notice--warn">Part of the profile did not load ({error}).</p> : null}

      <div className="stats-grid profile-stats">
        <StatTile value={tally.submitted} label="contributions submitted" />
        <StatTile value={tally.accepted} label="accepted" tone="accepted" />
        <StatTile value={tally.pending} label="pending review" tone="pending" />
        <StatTile value={tally.declined} label="declined" tone="declined" />
      </div>

      <section className="detail-section" aria-labelledby="profile-activity-title">
        <header className="detail-section__head">
          <h2 id="profile-activity-title">Activity</h2>
          <span className="detail-section__aside muted small">contributions per day</span>
        </header>
        <ContributionCalendar activity={activity} />
      </section>

      <section className="detail-section" aria-labelledby="profile-history-title">
        <header className="detail-section__head">
          <h2 id="profile-history-title">Contributions</h2>
          <span className="detail-section__aside muted small">{rows === null ? '…' : `${rows.length} shown`}</span>
        </header>
        {rows === null ? <LoadingState label="Loading contributions…" /> : rows.length === 0 ? (
          <p className="muted">No contributions yet.</p>
        ) : (
          <ul className="log-list" style={{ listStyle: 'none' }}>
            {rows.map((row) => (
              <li key={row.number}>
                <button type="button" className="log-item log-item--clickable" onClick={() => setSelected(submissionView(row))}>
                  <span className="log-item__num">#{row.number}</span>
                  <span className="log-item__title">{row.title}</span>
                  <span className={`chip chip--${row.status}`}>{STATUS_LABELS[row.status]}</span>
                  <span className="log-item__meta">{fmtDate(row.submitted_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected ? (
        <ContributionModal
          row={{
            ...selected,
            contributor: { name: profile.display_name, avatar: profile.avatar_url },
          }}
          onClose={() => setSelected(null)}
        />
      ) : null}

      <p className="muted small profile-footer-note">
        Public profile — this is the same information the{' '}
        <Link to="/log">contribution log</Link> shows. Private details stay in{' '}
        <Link to="/account">your own profile</Link>.
      </p>
    </PageContainer>
  );
}
