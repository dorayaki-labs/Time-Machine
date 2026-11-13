import Icon from './Icon.jsx';

/**
 * Segmented control for switching between the segments of an episode. The
 * active segment is marked by a single pill ("thumb") that slides under the
 * labels — one GPU-cheap transform, so switching feels instantaneous. Each
 * tab is labelled by its SEGMENT's own name under a "Segment N" eyebrow.
 *
 * Alignment: the buttons carry NO width of their own — the grid's equal 1fr
 * tracks size them, so every tab is exactly as wide as its slice of the nav
 * and its centred content sits in the true centre of that slice. (An inline
 * percentage width on the buttons used to resolve against the TRACK, which
 * shrank each button to a left-hugging sliver and made the labels read
 * off-centre.) The thumb is positioned against the NAV, where percentage
 * sizing is correct.
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
