import { Link } from 'react-router-dom';
import CatalogBrowser from '@/components/CatalogBrowser.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { getEntries, loadRecord, displayTitle, secondaryTitle } from '@/lib/catalog.js';
import { formatRelease, formatRuntime } from '@/lib/dates.js';
import useAsync from '@/hooks/useAsync.js';

function FeaturedMovie() {
  const entry = getEntries('movies')[0];
  const { data: record } = useAsync(() => (entry ? loadRecord(entry) : null), [entry?.id]);
  if (!entry) return null;
  return (
    <section className="featured" aria-labelledby="featured-title">
      <div className="featured__body">
        <p className="eyebrow">From the catalogue</p>
        <h2 id="featured-title">{displayTitle(entry)}</h2>
        {secondaryTitle(entry) ? <p className="featured__ja" lang="ja">{secondaryTitle(entry)}</p> : null}
        <p className="featured__meta">
          No. {entry.number}<span className="sep" aria-hidden="true"> / </span>{formatRelease(entry.release)}
          {record?.durationMinutes ? <><span className="sep" aria-hidden="true"> / </span>{formatRuntime(record.durationMinutes)}</> : null}
          {record?.director?.en ? <><span className="sep" aria-hidden="true"> / </span>Directed by {record.director.en}</> : null}
        </p>
        <p className="featured__summary">{record?.summary ?? 'No synopsis has been documented for this movie yet.'}</p>
        <div className="featured__actions">
          <Link to={entry.url} className="btn btn--primary">View record</Link>
        </div>
      </div>
    </section>
  );
}

export default function Movies() {
  useDocumentTitle('Movies');
  return <CatalogBrowser seriesId="movies" before={<FeaturedMovie />} />;
}
