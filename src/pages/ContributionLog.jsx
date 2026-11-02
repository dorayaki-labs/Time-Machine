// The public contribution log: accepted contributions only, with the
// contributor's display name, acceptance date and a link to the archive
// entry when one applies. Declined and deleted submissions are never shown.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { fetchPublicLog } from '@/lib/stats.js';

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

export default function ContributionLog() {
  const { backendConfigured } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!backendConfigured) return undefined;
    fetchPublicLog({ limit: 60 })
      .then((data) => active && setRows(data))
      .catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [backendConfigured]);

  return (
    <PageContainer>
      <div className="page-opening">
        <p className="eyebrow">Community project</p>
        <h1>Contribution log</h1>
        <p className="page-opening__lead">
          Every accepted contribution, newest first. This is the public record of what the community
          published to the archive — declined and withdrawn submissions stay private to the submitter's
          own history.
        </p>
      </div>

      {!backendConfigured ? (
        <EmptyState icon="archive" title="The contribution backend is not connected yet">
          <p>Contributions will appear here once the backend is configured.</p>
        </EmptyState>
      ) : error ? (
        <p className="notice notice--warn">The log could not be loaded right now ({error}).</p>
      ) : rows === null ? (
        <LoadingState label="Loading the contribution log…" />
      ) : rows.length === 0 ? (
        <EmptyState icon="archive" title="No accepted contributions yet">
          <p>Be the first: <Link to="/contribute">suggest a contribution</Link>.</p>
        </EmptyState>
      ) : (
        <ul className="log-list">
          {rows.map((row) => {
            const path = entryPath(row.entry_id);
            const date = row.accepted_at ? new Date(row.accepted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
            return (
              <li key={row.number} className="log-item">
                <span className="log-item__num">#{row.number}</span>
                <span className="log-item__title">{row.title}</span>
                <span className="log-item__meta">by {row.contributor_name}</span>
                <span className="log-item__meta">accepted {date}</span>
                {path
                  ? <Link className="log-item__meta" to={path}>{row.entry_id} →</Link>
                  : row.entry_id ? <span className="log-item__meta">{row.entry_id}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
