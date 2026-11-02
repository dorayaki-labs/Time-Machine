import { useState } from 'react';
import { Link } from 'react-router-dom';
import MetadataSection from './MetadataSection.jsx';
import MovieCard from './MovieCard.jsx';
import StatusIndicator from './StatusIndicator.jsx';
import { SERIES, displayTitle } from '@/lib/catalog.js';
import { formatRelease } from '@/lib/dates.js';

const LIMIT = 8;

function EpisodeRows({ entries, filterQuery }) {
  const [all, setAll] = useState(false);
  const shown = all ? entries : entries.slice(0, LIMIT);
  const series = SERIES[entries[0].seriesId];
  return (
    <div className="appearance-group">
      <div className="appearance-group__head">
        <h3>{series.label} <span className="muted">{entries.length}</span></h3>
        <Link to={`${series.basePath}?${filterQuery}`} className="text-link">View in catalogue</Link>
      </div>
      <ul className="entry-rows">
        {shown.map((e) => (
          <li key={e.id}>
            <Link to={e.url} className="entry-row">
              <span className="entry-row__num mono">#{e.number}</span>
              <span className="entry-row__title">{displayTitle(e)}</span>
              <span className="entry-row__date muted">{formatRelease(e.release, '—')}</span>
              <StatusIndicator kind="availability" value={e.availability} compact />
            </Link>
          </li>
        ))}
      </ul>
      {entries.length > LIMIT ? (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${entries.length}`}
        </button>
      ) : null}
    </div>
  );
}

/** `appearances` comes from getEntriesForCharacter / getEntriesForGadget, so nothing is hardcoded. */
export default function AppearanceLists({ appearances, filterKey, id }) {
  const filterQuery = `${filterKey}=${encodeURIComponent(id)}`;
  const groups = ['anime-1979', 'anime-2005', 'anime-1973'].map((s) => appearances.bySeries(s)).filter((g) => g.length);
  return (
    <>
      <MetadataSection id="episodes" title="Episodes" aside={<span className="muted">{appearances.episodes.length}</span>}>
        {groups.length ? groups.map((g) => <EpisodeRows key={g[0].seriesId} entries={g} filterQuery={filterQuery} />) : <p className="muted">No documented episodes feature this entry yet.</p>}
      </MetadataSection>
      <MetadataSection id="movies" title="Movies" aside={<span className="muted">{appearances.movies.length}</span>}>
        {appearances.movies.length ? (
          <div className="grid grid--movies grid--compact-movies">{appearances.movies.map((m) => <MovieCard key={m.id} entry={m} />)}</div>
        ) : <p className="muted">No documented movies feature this entry yet.</p>}
      </MetadataSection>
    </>
  );
}
