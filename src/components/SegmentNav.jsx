import Icon from './Icon.jsx';

/**
 * Segmented control for switching between the segments of an episode. The
 * active segment is marked by a single pill ("thumb") that slides under the
 * labels — one GPU-cheap transform, so switching feels instantaneous. Each
 * tab is labelled by its SEGMENT's own name under a "Segment N" eyebrow,
 * centred; long labels wrap to two lines at most and the full name rides
 * along as the tab's tooltip.
 */
export default function SegmentNav({ segments = [], names = [], current = 0, onSelect }) {
  const count = Math.max(1, segments.length);
  return (
    <nav className="segment-nav" aria-label="Segments of this episode" id="segment-content">
      <span
        className="segment-nav__thumb"
        aria-hidden="true"
        style={{ width: `${100 / count}%`, transform: `translateX(${current * 100}%)` }}
      />
      {segments.map((seg, i) => (
        <button
          key={seg.id ?? i}
          type="button"
          className={`segment-nav__tab${i === current ? ' is-active' : ''}`}
          aria-current={i === current ? 'true' : undefined}
          title={names[i] ?? `Segment ${seg.segmentNumber ?? i + 1}`}
          style={{ width: `${100 / count}%` }}
          onClick={() => onSelect(i)}
        >
          <span className="segment-nav__num">
            <Icon name="film" size={13} /> Segment {seg.segmentNumber ?? i + 1}
          </span>
          <span className="segment-nav__name">{names[i] ?? `Segment ${seg.segmentNumber ?? i + 1}`}</span>
        </button>
      ))}
    </nav>
  );
}
