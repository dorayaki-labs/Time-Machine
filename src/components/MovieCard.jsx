import MediaCard from './MediaCard.jsx';
import StatusIndicator from './StatusIndicator.jsx';
import { displayTitle, secondaryTitle } from '@/lib/catalog.js';
import { formatRelease } from '@/lib/dates.js';

export default function MovieCard({ entry, large = false, showType = false }) {
  return (
    <MediaCard
      to={entry.url}
      kind="movie"
      seed={entry.id}
      image={entry.image?.url ?? null}
      imageAlt={entry.image?.alt ?? ''}
      label={`No. ${entry.number}`}
      title={displayTitle(entry)}
      subtitle={secondaryTitle(entry)}
      badge={<span className="chip chip--mono">No. {entry.number}</span>}
      className={large ? 'media-card--large' : ''}
    >
      <p className="media-card__meta">
        {showType ? <>Movie<span className="sep" aria-hidden="true"> / </span></> : null}
        {formatRelease(entry.release)}
        {entry.durationMinutes ? <><span className="sep" aria-hidden="true"> / </span>{entry.durationMinutes} min</> : null}
      </p>
      <div className="media-card__row"><StatusIndicator kind="availability" value={entry.availability} compact /></div>
    </MediaCard>
  );
}
