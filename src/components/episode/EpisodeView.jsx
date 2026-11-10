// The redesigned episode page (V2). Ten sections in a fixed hierarchy:
//
//   01 Episode header          (episode-level identity + active segment cover/title)
//   02 Archive completeness    (computed from the record, two levels)
//   03 Segment selector        (cards, per-segment documentation dot)
//   04 Archive actions         (permission-aware, reused from EntryActions)
//   05 Recent contributions    (vertical timeline, latest three)
//   06 About this segment      (summary + full synopsis)
//   07 Screenshots             (centered carousel)
//   08 Viewing sources         (list first, player expands per source)
//   09 Appearances             (characters + gadgets of the segment)
//   10 Voice cast              (character → actor table)
//
// Segment-specific sections (06, 07, 09, 10) remount on a segment switch so
// their state resets and the content fades in; the player (08) is
// episode-level and is never interrupted by switching. The URL carries
// ?segment=N silently — no reload, no scroll jump.

import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import PageContainer from '../PageContainer.jsx';
import LoadingState from '../LoadingState.jsx';
import Icon from '../Icon.jsx';
import EntryActions from '../EntryActions.jsx';
import PageContributions from '../PageContributions.jsx';
import CharacterCard from '../CharacterCard.jsx';
import GadgetCard from '../GadgetCard.jsx';
import { PrevNext, VoiceActorsSection } from '../EntrySections.jsx';
import EpisodeHeader from './EpisodeHeader.jsx';
import ArchiveCompleteness from './ArchiveCompleteness.jsx';
import SegmentSelector from './SegmentSelector.jsx';
import ScreenshotCarousel from './ScreenshotCarousel.jsx';
import SourceSection from './SourceSection.jsx';
import NotFound from '../../pages/NotFound.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import useAsync from '@/hooks/useAsync.js';
import { getEntry, loadRecord, getNeighbors, displayTitle, segmentTitle, SERIES, getCharacter, getGadget } from '@/lib/catalog.js';

const SYNOPSIS_CLAMP = 1400;

function AboutSegment({ entry, segment, segmentIndex, multi }) {
  const [expanded, setExpanded] = useState(false);
  const description = segment?.description ?? null;
  const long = Boolean(description && description.length > SYNOPSIS_CLAMP);
  useEffect(() => { setExpanded(false); }, [segment?.id]);

  return (
    <section className="detail-section ev-section" id="segment-info" aria-labelledby="segment-info-title">
      <header className="detail-section__head">
        <h2 className="ev-section-title" id="segment-info-title">About this segment</h2>
        {multi ? <span className="muted">{segmentTitle(entry, segmentIndex)}</span> : null}
      </header>

      {segment?.title?.ja && multi ? (
        <p className="detail-head__ja small" lang="ja">{segment.title.ja}</p>
      ) : null}
      {segment?.alternateTitles?.length ? (
        <p className="ev-alt-titles muted small">
          Also known as: {segment.alternateTitles.map((t) => (typeof t === 'string' ? t : t?.en || t?.ja)).filter(Boolean).join(' · ')}
        </p>
      ) : null}

      <div className="ev-about">
        <h3 className="ev-subhead">Summary</h3>
        {segment?.summary
          ? <p className="prose ev-about__summary">{segment.summary}</p>
          : <p className="ev-missing"><Icon name="alert" size={13} /> Summary not documented.</p>}

        <h3 className="ev-subhead">Full synopsis</h3>
        {description ? (
          <div className={`prose prose--secondary ev-about__synopsis${long && !expanded ? ' is-clamped' : ''}`}>
            <p>{description}</p>
          </div>
        ) : (
          <p className="ev-missing"><Icon name="alert" size={13} /> Full synopsis not documented.</p>
        )}
        {long ? (
          <button type="button" className="btn btn--ghost btn--sm ev-about__more" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? 'Show less' : 'Read the full synopsis'}
            <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={13} />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Appearances({ characters = [], gadgets = [] }) {
  const chars = characters.map(getCharacter).filter(Boolean);
  const gads = gadgets.map(getGadget).filter(Boolean);
  return (
    <section className="detail-section ev-section" id="appearances" aria-labelledby="appearances-title">
      <header className="detail-section__head">
        <h2 className="ev-section-title" id="appearances-title">Appearances</h2>
      </header>

      <h3 className="ev-subhead">Characters <span className="muted">{chars.length}</span></h3>
      {chars.length ? (
        <div className="grid grid--compact">{chars.map((c) => <CharacterCard key={c.id} character={c} compact />)}</div>
      ) : (
        <p className="ev-missing"><Icon name="user" size={13} /> No characters have been documented for this segment.</p>
      )}

      <h3 className="ev-subhead ev-subhead--gap">Gadgets <span className="muted">{gads.length}</span></h3>
      {gads.length ? (
        <div className="grid grid--compact">{gads.map((g) => <GadgetCard key={g.id} gadget={g} compact />)}</div>
      ) : (
        <p className="ev-missing"><Icon name="gadget" size={13} /> No gadgets have been documented for this segment.</p>
      )}
    </section>
  );
}

export default function EpisodeView({ seriesId }) {
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
    if (requested > 1) document.getElementById('segments')?.scrollIntoView({ block: 'start' });
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
  const legacyHref = (() => {
    const next = new URLSearchParams(params);
    next.set('legacyEpisodeView', 'true');
    const qs = next.toString();
    return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  })();

  return (
    <PageContainer className="detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Archive</Link><span aria-hidden="true">/</span>
        <Link to={series.basePath}>{series.label}</Link><span aria-hidden="true">/</span>
        <span aria-current="page">Episode {record.number}</span>
      </nav>

      {/* 01 — episode header */}
      <EpisodeHeader record={record} series={series} segment={segment} segmentIndex={current} multi={multi} entry={entry} />

      {/* 02 — archive completeness, computed from the record */}
      <ArchiveCompleteness record={record} segment={segment} segmentIndex={current} entry={entry} />

      {/* 03 — segment selector */}
      {multi ? <SegmentSelector entry={entry} segments={segments} current={current} onSelect={selectSegment} /> : null}

      {/* 04 — archive actions (role-aware, server-enforced rules unchanged) */}
      <div className="ev-actions" id="actions">
        <EntryActions entry={entry} />
        <Link className="btn btn--ghost btn--sm ev-actions__classic" to={legacyHref} title="The previous episode page layout">
          <Icon name="clock" size={14} /> Classic view
        </Link>
      </div>

      {/* 05 — recent contributions, vertical timeline */}
      <PageContributions entryId={entry.id} variant="timeline" />

      {/* 06 — about this segment (remounts on segment switch) */}
      <div className="ev-anim" key={`info-${segment?.id ?? record.id}`}>
        <AboutSegment entry={entry} segment={segment} segmentIndex={current} multi={multi} />
      </div>

      {/* 07 — screenshots (remounts on segment switch) */}
      <div className="ev-anim" key={`shots-${segment?.id ?? record.id}`}>
        <ScreenshotCarousel screenshots={segment?.screenshots ?? []} title={multi ? segmentTitle(entry, current) : displayTitle(entry)} />
      </div>

      {/* 08 — viewing sources: episode-level, never interrupted by switching */}
      <SourceSection sources={record.sources ?? []} noun="episode" />

      {/* 09 — appearances (remounts on segment switch) */}
      <div className="ev-anim" key={`appear-${segment?.id ?? record.id}`}>
        <Appearances characters={segment?.characters ?? []} gadgets={segment?.gadgets ?? []} />
      </div>

      {/* 10 — voice cast (remounts on segment switch) */}
      <div className="ev-anim" key={`cast-${segment?.id ?? record.id}`}>
        <VoiceActorsSection voiceActors={segment?.voiceActors ?? []} title="Voice cast" id="voice-cast" />
      </div>

      <PrevNext previous={previous} next={next} label="episode" />
    </PageContainer>
  );
}
