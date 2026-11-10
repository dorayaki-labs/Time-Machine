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
import { CharactersSection, GadgetsSection, VoiceActorsSection, Completeness, PrevNext } from '@/components/EntrySections.jsx';
import Icon from '@/components/Icon.jsx';
import NotFound from './NotFound.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import useAsync from '@/hooks/useAsync.js';
import { getEntry, loadRecord, getNeighbors, displayTitle, secondaryTitle, segmentTitle, SERIES, languageName, preservationLabel } from '@/lib/catalog.js';
import { formatRelease } from '@/lib/dates.js';
import { metadataChecklist } from '@/lib/statistics.js';

const pad = (n) => String(n).padStart(3, '0');

/**
 * The episode page — the classic layout. Segments are switched with the
 * numbered tabs under the heading; below the sources a Recent-contributions
 * style timeline lists every segment of the broadcast, and clicking one opens
 * a stripped-down segment menu (?menu=segment): thumbnail, summary, synopsis
 * — no sources, characters, gadgets or voice actors.
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
    setSelected(n);
    const next = new URLSearchParams(params);
    if (n > 1) next.set('segment', String(n)); else next.delete('segment');
    setParams(next, { replace: true });
  };

  // The segment menu is a separate screen opened from the Segments timeline
  // (?segment=N&menu=segment). Pushed, so the browser's back button and the
  // "Back to episode" button both return to the full episode page.
  const menuOpen = params.get('menu') === 'segment' && Boolean(segment);
  const openSegmentMenu = (n) => {
    const next = new URLSearchParams(params);
    next.set('segment', String(n));
    next.set('menu', 'segment');
    setParams(next);
  };
  const backToEpisode = () => {
    const next = new URLSearchParams(params);
    next.delete('menu');
    setParams(next);
  };

  // Arriving from a segment search result scrolls the segment area into view.
  useEffect(() => {
    if (requested > 1) document.getElementById('segment-content')?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const multi = valid && segments.length > 1;
  useDocumentTitle(valid
    ? (menuOpen
      ? `Segment ${current + 1}: ${segmentTitle(entry, current)} · ${series.label}`
      : `${displayTitle(entry)}${multi && segment ? ` · ${segmentTitle(entry, current)}` : ''} · ${series.label}`)
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

  // ---------------------------------------------------------------- segment menu
  if (menuOpen) {
    return (
      <PageContainer className="detail">
        <div className="ev-actions segment-menu__top">
          <button type="button" className="btn btn--ghost btn--sm" onClick={backToEpisode}>
            <Icon name="arrowLeft" size={15} /> Back to episode
          </button>
        </div>

        <div className="segment-menu__media">
          <MediaImage
            kind="episode"
            seed={segment.id}
            src={segment.image?.url ?? null}
            alt={segment.image?.alt ?? ''}
            label={`EP ${pad(record.number)}`}
            priority
          />
        </div>

        <header className="detail-head">
          <p className="eyebrow">
            <span>Segment {segment.segmentNumber ?? current + 1} of {segments.length}</span>
            {Number.isFinite(segment.durationMinutes) ? <span className="chip chip--mono">{segment.durationMinutes} min</span> : null}
          </p>
          <h1>{segmentTitle(entry, current)}</h1>
          {segment.title?.ja && segment.title?.en && segment.title.ja !== segment.title.en
            ? <p className="detail-head__ja" lang="ja">{segment.title.ja}</p>
            : null}
        </header>

        <MetadataSection id="segment-summary" title="Summary">
          {segment.summary
            ? <p className="prose">{segment.summary}</p>
            : <p className="ev-missing"><Icon name="alert" size={13} /> Summary not documented.</p>}
        </MetadataSection>

        <MetadataSection id="segment-synopsis" title="Full synopsis">
          {segment.description
            ? <p className="prose prose--secondary">{segment.description}</p>
            : <p className="ev-missing"><Icon name="alert" size={13} /> Full synopsis not documented.</p>}
        </MetadataSection>
      </PageContainer>
    );
  }

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
        <nav className="segment-tabs" aria-label="Segments of this episode" id="segment-content">
          {segments.map((seg, i) => (
            <button key={seg.id} type="button"
              className={`segment-tabs__tab${i === current ? ' is-active' : ''}`}
              aria-current={i === current ? 'true' : undefined}
              title={segmentTitle(entry, i)}
              onClick={() => selectSegment(i + 1)}>
              Segment {seg.segmentNumber ?? i + 1}
            </button>
          ))}
        </nav>
      ) : null}

      <EntryActions entry={entry} />
      <PageContributions entryId={entry.id} />

      <div className="detail-columns">
        <div className="detail-columns__media">
          <MediaImage kind="episode" seed={segment?.id ?? record.id} src={display.image?.url ?? null} alt={display.image?.alt ?? ''}
            label={`EP ${pad(record.number)}`} priority />
        </div>
        <MetadataSection id="info" title="Episode information" className="detail-columns__info">
          <FactList items={[
            { label: 'Series', value: <Link to={series.basePath}>{series.label}</Link> },
            { label: 'Episode name', value: record.title ? (record.title.en ?? record.title.ja ?? null) : null },
            { label: 'Episode number', value: <span className="mono">{record.number}</span> },
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

      <MetadataSection id="synopsis" title="Synopsis">
        {display.summary ? <p className="prose">{display.summary}</p> : <p className="muted">No synopsis has been documented for this {multi ? 'segment' : 'episode'} yet.</p>}
        {display.description ? <p className="prose prose--secondary">{display.description}</p> : null}
      </MetadataSection>

      <SourceList sources={record.sources ?? []} noun="episode" />

      {/* Every segment of the broadcast, in the style of the recent
          contributions timeline. Opening one shows its stripped-down menu. */}
      <section className="detail-section" id="segments" aria-labelledby="segments-title">
        <header className="detail-section__head">
          <h2 className="ev-section-title" id="segments-title">
            <Icon name="clock" size={14} className="ev-section-title__icon" /> Segments
          </h2>
          <span className="detail-section__aside">{segments.length}</span>
        </header>
        <ol className="ev-timeline ev-timeline--segments">
          {segments.map((seg, i) => (
            <li key={seg.id} className="ev-timeline__item ev-timeline__item--segment">
              <span className="ev-timeline__dot" aria-hidden="true" />
              <button type="button" className="ev-timeline__link" onClick={() => openSegmentMenu(i + 1)}
                aria-label={`Open the menu for segment ${i + 1}: ${segmentTitle(entry, i)}`}>
                <span className="ev-timeline__body">
                  <span className="ev-timeline__line"><strong>{segmentTitle(entry, i)}</strong></span>
                  <span className="ev-timeline__meta muted small">
                    Segment {seg.segmentNumber ?? i + 1}{Number.isFinite(seg.durationMinutes) ? ` · ${seg.durationMinutes} min` : ''}
                  </span>
                </span>
                <Icon name="arrowRight" size={13} className="ev-timeline__go" />
              </button>
            </li>
          ))}
        </ol>
      </section>

      <CharactersSection ids={display.characters ?? []} />
      <GadgetsSection ids={display.gadgets ?? []} />
      <VoiceActorsSection voiceActors={display.voiceActors ?? []} />
      <PrevNext previous={previous} next={next} label="episode" />
    </PageContainer>
  );
}
