import { Link, useParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import StatusIndicator from '@/components/StatusIndicator.jsx';
import MediaImage from '@/components/MediaImage.jsx';
import SourceList from '@/components/SourceList.jsx';
import Gallery from '@/components/Gallery.jsx';
import MovieCard from '@/components/MovieCard.jsx';
import MetadataSection, { FactList } from '@/components/MetadataSection.jsx';
import EntryActions from '@/components/EntryActions.jsx';
import { CharactersSection, GadgetsSection, VoiceActorsSection, Completeness, PrevNext } from '@/components/EntrySections.jsx';
import NotFound from './NotFound.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import useAsync from '@/hooks/useAsync.js';
import { getEntry, loadRecord, getNeighbors, getRelatedMovies, displayTitle, secondaryTitle } from '@/lib/catalog.js';
import { formatRelease, formatRuntime } from '@/lib/dates.js';
import { metadataChecklist } from '@/lib/statistics.js';

export default function MovieDetails() {
  const { id } = useParams();
  const entry = getEntry(id);
  const valid = Boolean(entry) && entry.kind === 'movie';
  const { data: record, loading, error } = useAsync(() => (valid ? loadRecord(entry) : null), [id]);
  useDocumentTitle(valid ? displayTitle(entry) : 'Movie not found');

  if (!valid) return <NotFound title="Movie not found" message="That movie is not in the archive yet, or the link is wrong." />;
  if (loading) return <PageContainer><LoadingState label="Loading movie…" /></PageContainer>;
  if (error || !record) return <NotFound title="This record could not be loaded" message="The movie is listed in the catalogue, but its record file is missing or damaged." />;

  const { previous, next } = getNeighbors(entry);
  const related = getRelatedMovies(entry, 4);
  const secondary = secondaryTitle(entry);

  return (
    <PageContainer className="detail detail--movie">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Archive</Link><span aria-hidden="true">/</span>
        <Link to="/movies">Movies</Link><span aria-hidden="true">/</span>
        <span aria-current="page">No. {record.number}</span>
      </nav>

      <section className="film-record" aria-label="Movie record">
        <div className="film-record__poster">
          <MediaImage kind="movie" seed={record.id} src={record.image?.url ?? null} alt={record.image?.alt ?? ''} label={`No. ${record.number}`} priority />
        </div>
        <div className="film-record__main">
          <p className="eyebrow">Movie No. {record.number} in release order</p>
          <h1>{displayTitle(entry)}</h1>
          {secondary ? <p className="detail-head__ja" lang="ja">{secondary}</p> : null}
          <div className="status-pair">
            <StatusIndicator kind="metadata" value={record.status} />
            <StatusIndicator kind="availability" value={entry.availability} />
          </div>
          <FactList items={[
            { label: 'Archive number', value: <span className="mono">{record.number}</span> },
            { label: 'Release date', value: record.release?.date ? formatRelease(record.release) : null },
            { label: 'Director', value: record.director?.en ? <>{record.director.en}{record.director.ja ? <span className="muted" lang="ja"> · {record.director.ja}</span> : null}</> : null },
            { label: 'Runtime', value: Number.isFinite(record.durationMinutes) ? formatRuntime(record.durationMinutes) : null },
            { label: 'Region', value: record.release?.region },
            { label: 'Record ID', value: <span className="mono">{record.id}</span> },
          ]} />
          <p className="film-record__note">The number is an archive sequence in order of release, not an official franchise identifier.</p>
        </div>
      </section>

      <EntryActions entry={entry} />

      <div className="detail-columns detail-columns--after-film">
        <MetadataSection id="synopsis" title="Synopsis">
          {record.summary ? <p className="prose">{record.summary}</p> : <p className="muted">No synopsis has been documented for this movie yet.</p>}
          <Completeness checklist={metadataChecklist(record)} />
        </MetadataSection>
        <div className="detail-columns__media detail-columns__media--film">
          <Gallery screenshots={record.screenshots ?? []} title={displayTitle(entry)} />
        </div>
      </div>

      <SourceList sources={record.sources ?? []} noun="movie" />

      <CharactersSection ids={record.characters} />
      <GadgetsSection ids={record.gadgets} />
      <VoiceActorsSection voiceActors={record.voiceActors} />

      {related.length ? (
        <MetadataSection id="related" title="Related movies">
          <div className="grid grid--movies grid--compact-movies">{related.map((m) => <MovieCard key={m.id} entry={m} />)}</div>
        </MetadataSection>
      ) : null}
      <PrevNext previous={previous} next={next} label="movie" />
    </PageContainer>
  );
}
