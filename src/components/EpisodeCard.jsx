import MediaCard from './MediaCard.jsx';
import StatusIndicator from './StatusIndicator.jsx';
import { displayTitle, secondaryTitle, SERIES } from '@/lib/catalog.js';
import { formatRelease } from '@/lib/dates.js';

const pad = (n) => String(n).padStart(3, '0');

export default function EpisodeCard({ entry, showSeries = false, showPreservation = false }) {
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
      badge={<span className="chip chip--mono">#{entry.number}</span>}
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
