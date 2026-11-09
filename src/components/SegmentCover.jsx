import { useEffect, useRef, useState } from 'react';
import MediaImage from './MediaImage.jsx';

/**
 * Cover artwork for a multi-segment episode card. Default state shows only
 * the first segment image; hovering slowly slides horizontally through every
 * segment that actually has artwork, and leaving the card eases back to the
 * first image. One timer runs ONLY while a card is hovered, images beyond the
 * first load lazily, and the whole effect is disabled for reduced-motion
 * users.
 */
export default function SegmentCover({ images, seed, label }) {
  const usable = (images ?? []).filter((img) => img?.url);
  const [hover, setHover] = useState(false);
  const [index, setIndex] = useState(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  useEffect(() => {
    if (!hover || usable.length < 2 || reduced.current) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % usable.length), 3200);
    return () => clearInterval(timer);
  }, [hover, usable.length]);

  if (usable.length === 0) return <MediaImage kind="episode" seed={seed} src={null} alt="" label={label} priority />;
  if (usable.length === 1) return <MediaImage kind="episode" seed={seed} src={usable[0].url} alt={usable[0].alt ?? ''} priority />;

  return (
    <div
      className={`media media--episode segment-cover${reduced.current ? ' segment-cover--static' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setIndex(0); }}
    >
      <div className="segment-cover__strip" style={{ transform: `translateX(-${index * 100}%)` }}>
        {usable.map((img, i) => (
          <img
            key={img.url}
            className="segment-cover__img"
            src={img.url}
            alt={i === index ? (img.alt ?? '') : ''}
            aria-hidden={i !== index}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        ))}
      </div>
      {label ? <span className="media__label mono" aria-hidden="true">{label}</span> : null}
      <span className="segment-cover__dots" aria-hidden="true">
        {usable.map((_, i) => <span key={i} className={i === index ? 'is-active' : ''} />)}
      </span>
    </div>
  );
}
