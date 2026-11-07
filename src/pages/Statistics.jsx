// Public statistics. Archive numbers come from the loaded catalogue;
// community numbers come live from the backend (public_stats view — no
// authentication required, nothing private). When the backend is not
// configured the archive numbers still show, with a note.

import { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getArchiveStats } from '@/lib/statistics.js';
import { getAllEntries } from '@/lib/catalog.js';
import { fetchPublicStats } from '@/lib/stats.js';

function StatCard({ value, label, hint }) {
  return (
    <div className="stat-card">
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
      {hint ? <span className="stat-card__label small" style={{ fontSize: '0.75rem' }}>{hint}</span> : null}
    </div>
  );
}

export default function Statistics() {
  const { backendConfigured } = useAuth();
  const [community, setCommunity] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!backendConfigured) return undefined;
    fetchPublicStats()
      .then((data) => active && setCommunity(data))
      .catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [backendConfigured]);

  const archive = getArchiveStats();
  const all = getAllEntries();
  const completeEpisodes = all.filter((e) => e.kind === 'episode' && e.status === 'complete').length;
  const completeMovies = all.filter((e) => e.kind === 'movie' && e.status === 'complete').length;
  const documentedMovies = all.filter((e) => e.kind === 'movie' && e.status !== 'metadata-incomplete').length;
  const totalEpisodes = archive.episodes;
  const totalMovies = archive.movies;

  return (
    <PageContainer>
      <div className="page-opening">
        <p className="eyebrow">Community project</p>
        <h1>Statistics</h1>
        <p className="page-opening__lead">
          How far the archive reaches, and what the community has been doing — computed live
          from the records.
        </p>
      </div>

      <h2 className="section-heading">Archive coverage</h2>
      <div className="stats-grid">
        <StatCard value={completeEpisodes} label="episodes completely documented" hint={`of ${totalEpisodes} episodes in the archive`} />
        <StatCard value={documentedMovies} label="movies documented" hint={`of ${totalMovies} movies listed`} />
        <StatCard value={archive.withSources} label="entries with a playable source" hint={`${archive.episodes + archive.movies} entries total`} />
        <StatCard value={archive.characters} label="character records" />
        <StatCard value={archive.gadgets} label="gadget records" />
      </div>
      <p className="muted small" style={{ maxWidth: '60ch' }}>
        “Completely documented” follows the archive's completeness checklist: English and Japanese titles,
        release date, summary, image, characters, gadgets and voice actors all filled in. Movies count as
        documented when their core metadata is complete.
      </p>

      <h2 className="section-heading">Community</h2>
      {!backendConfigured ? (
        <p className="notice">The contribution backend is not connected yet, so community statistics are
          unavailable. The archive itself is fully functional.</p>
      ) : error ? (
        <p className="notice notice--warn">Community statistics could not be loaded right now ({error}).
          The archive itself is unaffected.</p>
      ) : community === null ? (
        <LoadingState label="Loading community statistics…" />
      ) : (
        <>
          <div className="stats-grid">
            <StatCard value={community.contributions_submitted} label="contributions submitted" hint="all submissions, any status" />
            <StatCard value={community.contributions_accepted} label="contributions accepted" hint="published to the archive" />
            <StatCard value={community.contributions_declined} label="contributions declined" hint="declined submissions are kept in the submitter's private history" />
            <StatCard value={community.contributions_pending} label="pending review" hint="waiting for a checker" />
            <StatCard value={community.contributors} label="contributors" hint="accounts with at least one accepted contribution" />
          </div>
          <p className="muted small">Withdrawn and deleted submissions are left out of these counts.</p>
        </>
      )}
    </PageContainer>
  );
}
