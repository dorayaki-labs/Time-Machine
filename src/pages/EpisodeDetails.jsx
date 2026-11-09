import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import StatusIndicator from '@/components/StatusIndicator.jsx';
import MediaImage from '@/components/MediaImage.jsx';
import SourceList from '@/components/SourceList.jsx';
import Gallery from '@/components/Gallery.jsx';
import MetadataSection, { FactList } from '@/components/MetadataSection.jsx';
import Collapsible from '@/components/Collapsible.jsx';
import SegmentNav from '@/components/SegmentNav.jsx';
import EntryActions from '@/components/EntryActions.jsx';
import PageContributions from '@/components/PageContributions.jsx';
import { CharactersSection, GadgetsSection, VoiceActorsSection, Completeness, PrevNext } from '@/components/EntrySections.jsx';
import NotFound from './NotFound.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import useAsync from '@/hooks/useAsync.js';
import { getEntry, loadRecord, getNeighbors, displayTitle, secondaryTitle, segmentTitle, SERIES, languageName, preservationLabel } from '@/lib/catalog.js';
import { formatRelease } from '@/lib/dates.js';
import { metadataChecklist } from '@/lib/statistics.js';

const pad = (n) => String(n).padStart(3, '0');

export default function EpisodeDetails({ seriesId }) {
  const { id } = useParams();
  const entry = getEntry(id);
  const valid = Boolean(entry) && entry.seriesId === seriesId;
  const { data: record, loading, error } = useAsync(() => (valid ? loadRecord(entry) : null), [id, seriesId]);
  const [params, setParams] = useSearchParams();
  const series = SERIES[seriesId];
  const segments = valid && Array.isArray(record?.segments) ? record.segments : [];

  // Selected segment: the first by default, or the one a search result asked
  // for (?segment=N). Switching updates the URL silently — never a reload.
  const requested = Math.min(Math.max(1, Number(params.get('segment')) || 1), Math.max(1, segments.length));
  const [selected, setSelected] = useState(requested);
  useEffect(() => { setSelected(requested); }, [requested, id]);
  const current = Math.max(0, selected - 1);
  const segment = segments[current] ?? null;

  const selectSegment = (n) => {
    setSelected(n);
    const next = new URLSearchParams(params);
    if (n > 1) next.set('segment', String(n)); else next.delete('segment');
    setParams(next, { replace: true });
  };

  // Arriving from a segment search result scrolls the segment area into view.
  useEffect(() => {
    if (requested > 1) document.getElementById('segment-content')?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const multi = valid && segments.length > 1;
  useDocumentTitle(valid
    ? `${multi && segment ? segmentTitle(entry, current) : displayTitle(entry)} · Episode ${record?.number ?? '?'} · ${series.label}`
    : 'Episode not found');

  if (!valid) return <NotFound title="Episode not found" message="That episode is not in the archive yet. It may not have been documented, or the link may be wrong." />;
  if (loading) return <PageContainer><LoadingState label="Loading episode…" /></PageContainer>;
  if (error || !record) return <NotFound title="This record could not be loaded" message="The episode is listed in the catalogue, but its record file is missing or damaged." />;

  const { previous, next } = getNeighbors(entry);
  const secondary = secondaryTitle(entry);
  const display = segment ?? {
    title: record.title, summary: record.summary, description: record.description,
    image: record.image, screenshots: record.screenshots, characters: record.characters,
    gadgets: record.gadgets, voiceActors: record.voiceActors,
  };
  const segmentNames = segments.map((seg, i) => segmentTitle(entry, i));

  return (
    <PageContainer className="detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Archive</Link><span aria-hidden="true">/</span>
        <Link to={series.basePath}>{series.label}</Link><span aria-hidden="true">/</span>
        <span aria-current="page">Episode {record.number}</span>
      </nav>

      {/* Hero: a large poster on the left, the active story on the right. The
          active segment's name leads; the combined broadcast title stays
          available as secondary information. */}
      <header className="episode-hero">
        <div className="episode-hero__media">
          <MediaImage kind="episode" seed={segment?.id ?? record.id} src={display.image?.url ?? null} alt={display.image?.alt ?? ''}
            label={`EP ${pad(record.number)}`} priority />
        </div>
        <div className="episode-hero__body">
          <p className="eyebrow">
            {series.label} · Episode {record.number}
            {multi ? <span className="chip chip--mono episode-hero__count">{segments.length} segments</span> : null}
          </p>
          <h1 className="episode-hero__title">{multi && segment ? segmentTitle(entry, current) : displayTitle(entry)}</h1>
          {multi ? (
            <p className="episode-hero__combined muted">{displayTitle(entry)}</p>
          ) : (secondary ? <p className="detail-head__ja" lang="ja">{secondary}</p> : null)}
          <div className="status-pair">
            <StatusIndicator kind="metadata" value={record.status} />
            <StatusIndicator kind="availability" value={entry.availability} />
            {record.preservation ? <StatusIndicator kind="preservation" value={record.preservation} /> : null}
          </div>
          <FactList items={[
            { label: 'Series', value: <Link to={series.basePath}>{series.label}</Link> },
            { label: 'Episode number', value: <span className="mono">{record.number}</span> },
            ...(multi ? [{ label: 'Segment', value: <span className="mono">{current + 1} of {segments.length}</span> }] : []),
            { label: 'Broadcast date', value: record.release?.date ? <>{formatRelease(record.release)}{record.release.precision && record.release.precision !== 'day' ? <span className="muted"> ({record.release.precision} only)</span> : null}</> : null },
            { label: 'Original language', value: languageName(record.originalLanguage ?? 'ja') },
            { label: 'Region', value: record.release?.region },
            { label: 'Preservation', value: record.preservation ? preservationLabel(record.preservation) : null },
            { label: 'Record ID', value: <span className="mono">{segment?.id ?? record.id}</span> },
          ]} />
          <Completeness checklist={metadataChecklist(record)} />
        </div>
      </header>

      {multi ? (
        <SegmentNav segments={segments} names={segmentNames} current={current} onSelect={(i) => selectSegment(i + 1)} />
      ) : null}

      <EntryActions entry={entry} />
      <PageContributions entryId={entry.id} />

      {/* Summary and Synopsis are separate, independently collapsible sections. */}
      <Collapsible title="Summary" meta={multi && segment ? `Segment ${segment.segmentNumber ?? current + 1}` : undefined}>
        {display.summary
          ? <p className="prose">{display.summary}</p>
          : <p className="muted">No summary has been documented for this {multi ? 'segment' : 'episode'} yet.</p>}
      </Collapsible>
      <Collapsible title="Synopsis" defaultOpen={Boolean(display.description)}>
        {display.description
          ? <p className="prose prose--secondary">{display.description}</p>
          : <p className="muted">No longer description has been documented for this {multi ? 'segment' : 'episode'} yet.</p>}
      </Collapsible>

      <Gallery screenshots={display.screenshots ?? []} title={multi && segment ? segmentTitle(entry, current) : displayTitle(entry)} />

      <SourceList sources={record.sources ?? []} noun="episode" />

      <CharactersSection ids={display.characters ?? []} />
      <GadgetsSection ids={display.gadgets ?? []} />
      <VoiceActorsSection voiceActors={display.voiceActors ?? []} />
      <PrevNext previous={previous} next={next} label="episode" />
    </PageContainer>
  );
}
