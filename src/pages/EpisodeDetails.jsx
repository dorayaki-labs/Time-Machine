import { Link, useParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import StatusIndicator from '@/components/StatusIndicator.jsx';
import MediaImage from '@/components/MediaImage.jsx';
import SourceList from '@/components/SourceList.jsx';
import Gallery from '@/components/Gallery.jsx';
import MetadataSection, { FactList } from '@/components/MetadataSection.jsx';
import EntryActions from '@/components/EntryActions.jsx';
import { CharactersSection, GadgetsSection, VoiceActorsSection, Completeness, PrevNext } from '@/components/EntrySections.jsx';
import NotFound from './NotFound.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import useAsync from '@/hooks/useAsync.js';
import { getEntry, loadRecord, getNeighbors, displayTitle, secondaryTitle, SERIES, languageName, preservationLabel } from '@/lib/catalog.js';
import { formatRelease } from '@/lib/dates.js';
import { metadataChecklist } from '@/lib/statistics.js';

export default function EpisodeDetails({ seriesId }) {
  const { id } = useParams();
  const entry = getEntry(id);
  const valid = Boolean(entry) && entry.seriesId === seriesId;
  const { data: record, loading, error } = useAsync(() => (valid ? loadRecord(entry) : null), [id, seriesId]);
  useDocumentTitle(valid ? `${displayTitle(entry)} · ${SERIES[seriesId].label}` : 'Episode not found');

  if (!valid) return <NotFound title="Episode not found" message="That episode is not in the archive yet. It may not have been documented, or the link may be wrong." />;
  if (loading) return <PageContainer><LoadingState label="Loading episode…" /></PageContainer>;
  if (error || !record) return <NotFound title="This record could not be loaded" message="The episode is listed in the catalogue, but its record file is missing or damaged." />;

  const series = SERIES[seriesId];
  const { previous, next } = getNeighbors(entry);
  const secondary = secondaryTitle(entry);

  return (
    <PageContainer className="detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Archive</Link><span aria-hidden="true">/</span>
        <Link to={series.basePath}>{series.label}</Link><span aria-hidden="true">/</span>
        <span aria-current="page">Episode {record.number}</span>
      </nav>

      <header className="detail-head">
        <p className="eyebrow">{series.label} · Episode {record.number}</p>
        <h1>{displayTitle(entry)}</h1>
        {secondary ? <p className="detail-head__ja" lang="ja">{secondary}</p> : null}
        <div className="status-pair">
          <StatusIndicator kind="metadata" value={record.status} />
          <StatusIndicator kind="availability" value={entry.availability} />
          {record.preservation ? <StatusIndicator kind="preservation" value={record.preservation} /> : null}
        </div>
      </header>

      <EntryActions entry={entry} />

      <div className="detail-columns">
        <div className="detail-columns__media">
          <MediaImage kind="episode" seed={record.id} src={record.image?.url ?? null} alt={record.image?.alt ?? ''} label={`EP ${String(record.number).padStart(3, '0')}`} priority />
        </div>
        <MetadataSection id="info" title="Episode information" className="detail-columns__info">
          <FactList items={[
            { label: 'Series', value: <Link to={series.basePath}>{series.label}</Link> },
            { label: 'Episode number', value: <span className="mono">{record.number}</span> },
            { label: 'Broadcast date', value: record.release?.date ? <>{formatRelease(record.release)}{record.release.precision && record.release.precision !== 'day' ? <span className="muted"> ({record.release.precision} only)</span> : null}</> : null },
            { label: 'Original language', value: languageName(record.originalLanguage ?? 'ja') },
            { label: 'Region', value: record.release?.region },
            { label: 'Preservation', value: record.preservation ? preservationLabel(record.preservation) : null },
            { label: 'Record ID', value: <span className="mono">{record.id}</span> },
          ]} />
          <Completeness checklist={metadataChecklist(record)} />
        </MetadataSection>
      </div>

      <Gallery screenshots={record.screenshots ?? []} title={displayTitle(entry)} />

      <MetadataSection id="synopsis" title="Synopsis">
        {record.summary ? <p className="prose">{record.summary}</p> : <p className="muted">No synopsis has been documented for this episode yet.</p>}
      </MetadataSection>

      <SourceList sources={record.sources ?? []} noun="episode" />

      <CharactersSection ids={record.characters} />
      <GadgetsSection ids={record.gadgets} />
      <VoiceActorsSection voiceActors={record.voiceActors} />
      <PrevNext previous={previous} next={next} label="episode" />
    </PageContainer>
  );
}
