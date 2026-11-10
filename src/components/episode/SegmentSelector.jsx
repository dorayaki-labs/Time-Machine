// SECTION 03 — Segment navigation. One compact card per segment of the
// broadcast episode: number, real title, duration and a documentation-status
// dot. The selected card is highlighted. Evenly sized on desktop,
// horizontally scrollable on small screens.

import Icon from '../Icon.jsx';
import { segmentTitle } from '@/lib/catalog.js';
import { segmentDocStatus } from '@/lib/episodeFields.js';

export default function SegmentSelector({ entry, segments, current, onSelect }) {
  return (
    <section className="detail-section ev-section" id="segments" aria-labelledby="segments-title">
      <header className="detail-section__head">
        <h2 className="ev-section-title" id="segments-title">Segments</h2>
        <span className="muted">{segments.length}</span>
      </header>
      <div className="ev-segments" role="tablist" aria-label="Segments of this episode">
        {segments.map((seg, i) => {
          const doc = segmentDocStatus(seg);
          return (
            <button
              key={seg.id}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-current={i === current ? 'true' : undefined}
              className={`ev-seg-card${i === current ? ' is-active' : ''}`}
              onClick={() => onSelect(i + 1)}
            >
              <span className="ev-seg-card__top mono">
                <span>Segment {String(seg.segmentNumber ?? i + 1).padStart(2, '0')}</span>
                {Number.isFinite(seg.durationMinutes) ? (
                  <span className="ev-seg-card__duration">{seg.durationMinutes} min</span>
                ) : null}
              </span>
              <span className="ev-seg-card__title">{segmentTitle(entry, i)}</span>
              <span className="ev-seg-card__doc">
                <span className={`ev-seg-card__dot ev-seg-card__dot--${doc.level}`} aria-hidden="true" />
                {doc.level === 'full' ? 'Fully documented'
                  : doc.level === 'partial' ? `${doc.done} of ${doc.total} fields`
                    : 'Not documented'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
