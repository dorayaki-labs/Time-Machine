import Icon from './Icon.jsx';

/**
 * Segmented control for switching between the segments of an episode. The
 * active segment is marked by a single pill ("thumb") that slides under the
 * labels — one GPU-cheap transform, so switching feels instantaneous — and
 * each tab shows the segment's actual name, with generic numbering as the
 * small eyebrow above it. Long names ellipsize instead of breaking the row;
 * every tab carries the full name in its title for hover/AT clarity.
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
            <Icon name="film" size={12} /> Segment {seg.segmentNumber ?? i + 1}
          </span>
          <span className="segment-nav__name">{names[i] ?? `Segment ${seg.segmentNumber ?? i + 1}`}</span>
        </button>
      ))}
    </nav>
  );
}
