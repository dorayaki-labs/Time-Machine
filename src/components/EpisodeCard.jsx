import MediaCard from './MediaCard.jsx';
import SegmentCover from './SegmentCover.jsx';
import StatusIndicator from './StatusIndicator.jsx';
import Icon from './Icon.jsx';
import { displayTitle, secondaryTitle, SERIES } from '@/lib/catalog.js';
import { formatRelease } from '@/lib/dates.js';

const pad = (n) => String(n).padStart(3, '0');

export default function EpisodeCard({ entry, showSeries = false, showPreservation = false }) {
  const segments = Array.isArray(entry.segments) ? entry.segments : [];
  // The hover animation only makes sense when at least two segments carry art.
  const coverMedia = segments.filter((s) => s.image?.url).length > 1
    ? <SegmentCover images={segments.map((s) => s.image)} seed={entry.id} label={`EP ${pad(entry.number)}`} />
    : null;
  const segmentCount = segments.length || 1;
  return (
    <MediaCard
      to={entry.url}
      kind="episode"
      seed={entry.id}
      image={entry.image?.url ?? null}
      imageAlt={entry.image?.alt ?? ''}
      label={`EP ${pad(entry.number)}`}
      title={displayTitle(entry)}
      subtitle={secondaryTitle(entry)}
      tilt
      badge={<span className="chip chip--mono">#{entry.number}</span>}
      artBadge={(
        <span className="chip chip--mono" title={`${segmentCount} ${segmentCount === 1 ? 'segment' : 'segments'} in this episode`}>
          <Icon name="film" size={12} /> {segmentCount}
        </span>
      )}
      media={coverMedia}
    >
      <p className="media-card__meta">
        {showSeries ? <>{SERIES[entry.seriesId].label}<span className="sep" aria-hidden="true"> / </span></> : null}
        {formatRelease(entry.release)}
      </p>
      <div className="media-card__row">
        <StatusIndicator kind="availability" value={entry.availability} compact />
        {showPreservation && entry.preservation ? <StatusIndicator kind="preservation" value={entry.preservation} compact /> : null}
      </div>
    </MediaCard>
  );
}
