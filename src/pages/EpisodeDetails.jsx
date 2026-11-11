import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import StatusIndicator from '@/components/StatusIndicator.jsx';
import MediaImage from '@/components/MediaImage.jsx';
import SourceList from '@/components/SourceList.jsx';
import Gallery from '@/components/Gallery.jsx';
import MetadataSection, { FactList } from '@/components/MetadataSection.jsx';
import EntryActions from '@/components/EntryActions.jsx';
import PageContributions from '@/components/PageContributions.jsx';
import SegmentNav from '@/components/SegmentNav.jsx';
import { CharactersSection, GadgetsSection, VoiceActorsSection, Completeness, PrevNext } from '@/components/EntrySections.jsx';
import NotFound from './NotFound.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import useAsync from '@/hooks/useAsync.js';
import { getEntry, loadRecord, getNeighbors, displayTitle, secondaryTitle, segmentTitle, SERIES, languageName, preservationLabel } from '@/lib/catalog.js';
import { formatRelease } from '@/lib/dates.js';
import { metadataChecklist } from '@/lib/statistics.js';

const pad = (n) => String(n).padStart(3, '0');

/**
 * The episode page. The record leads: artwork and episode information come
 * first, editing and contribution controls sit after the content. SegmentNav
 * under the heading is the single segment switcher — each tab carries its
 * segment's own name. Summary and full synopsis each sit in their own boxed
 * panel.
 */
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
    setSelected(n + 1);
    const next = new URLSearchParams(params);
    if (n > 0) next.set('segment', String(n + 1)); else next.delete('segment');
    setParams(next, { replace: true });
  };

  // Arriving from a segment search result scrolls the segment area into view.
  useEffect(() => {
    if (requested > 1) document.getElementById('segment-content')?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const multi = valid && segments.length > 1;
  useDocumentTitle(valid
    ? `${displayTitle(entry)}${multi && segment ? ` · ${segmentTitle(entry, current)}` : ''} · ${series.label}`
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

  // --------------------------------------------------------------- episode page
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

      {multi ? (
        // One tab per segment, labelled by the segment's own name (the
        // "Segment N" eyebrow sits above it). The tabs are the single
        // segment switcher on the page.
        <SegmentNav
          segments={segments}
          names={segments.map((_s, i) => segmentTitle(entry, i))}
          current={current}
          onSelect={selectSegment}
        />
      ) : null}

      {/* The record first: artwork + information. The artwork frame
          stretches to the info column's height (fill mode) — no dead space
          under the image. */}
      <div className="detail-columns detail-columns--record">
        <div className="detail-columns__media">
          <MediaImage kind="episode" seed={segment?.id ?? record.id} src={display.image?.url ?? null} alt={display.image?.alt ?? ''}
            label={`EP ${pad(record.number)}`} priority fill />
        </div>
        <MetadataSection id="info" title="Episode information" className="detail-columns__info">
          <FactList items={[
            { label: 'Series', value: <Link to={series.basePath}>{series.label}</Link> },
            { label: 'Episode name', value: record.title ? (record.title.en ?? record.title.ja ?? null) : null },
            { label: 'Episode number', value: <span className="mono">#{record.number}</span> },
            ...(multi ? [{ label: 'Segment', value: <span className="mono">{current + 1} of {segments.length}</span> }] : []),
            { label: 'Broadcast date', value: record.release?.date ? <>{formatRelease(record.release)}{record.release.precision && record.release.precision !== 'day' ? <span className="muted"> ({record.release.precision} only)</span> : null}</> : null },
            { label: 'Original language', value: languageName(record.originalLanguage ?? 'ja') },
            { label: 'Region', value: record.release?.region },
            { label: 'Preservation', value: record.preservation ? preservationLabel(record.preservation) : null },
            { label: 'Record ID', value: <span className="mono">{segment?.id ?? record.id}</span> },
          ]} />
          <Completeness checklist={metadataChecklist(record)} />
        </MetadataSection>
      </div>

      {multi && segment ? (
        <header className="segment-heading">
          <p className="eyebrow">Segment {segment.segmentNumber ?? current + 1}</p>
          <h2>{segmentTitle(entry, current)}</h2>
          {segment.durationMinutes ? <p className="muted small mono">{segment.durationMinutes} min</p> : null}
        </header>
      ) : null}

      <Gallery screenshots={display.screenshots ?? []} title={segmentTitle(entry, current)} />

      {/* Summary and full synopsis each in their own boxed panel. */}
      <MetadataSection id="summary" title="Summary" className="detail-section--boxed">
        {display.summary
          ? <p className="prose">{display.summary}</p>
          : <p className="muted">No summary has been documented for this {multi ? 'segment' : 'episode'} yet.</p>}
      </MetadataSection>

      <MetadataSection id="synopsis" title="Full synopsis" className="detail-section--boxed">
        {display.description
          ? <p className="prose prose--secondary">{display.description}</p>
          : <p className="muted">No full synopsis has been documented for this {multi ? 'segment' : 'episode'} yet.</p>}
      </MetadataSection>

      <SourceList sources={record.sources ?? []} noun="episode" entryId={record.id} />

      <CharactersSection ids={display.characters ?? []} />
      <GadgetsSection ids={display.gadgets ?? []} />
      <VoiceActorsSection voiceActors={display.voiceActors ?? []} />
      <PrevNext previous={previous} next={next} label="episode" />

      {/* Editing and contribution controls: after the record, where they
          support it rather than lead it. */}
      <div className="detail-controls">
        <EntryActions entry={entry} />
        <PageContributions entryId={entry.id} />
      </div>
    </PageContainer>
  );
}
