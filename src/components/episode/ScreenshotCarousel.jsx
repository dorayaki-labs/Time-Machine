// SECTION 07 — Screenshot carousel. A centered stage with prev/next controls,
// a counter, thumbnail navigation underneath and a lightbox for full-size
// viewing (keyboard: arrows navigate, Escape closes). Images are shown at
// their own aspect ratio inside a fixed stage — contain, never stretch.
// Works with any number of screenshots including one, and collapses into a
// compact empty state when none are documented.

import { useEffect, useState } from 'react';
import Icon from '../Icon.jsx';

export default function ScreenshotCarousel({ screenshots = [], title }) {
  const usable = (screenshots ?? []).filter((s) => s && (s.url || s.data));
  const count = usable.length;
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  // A different segment's screenshots arrived (the parent remounts us on
  // segment switches, but the same record can also be edited in place).
  useEffect(() => {
    setActive((i) => (i < count ? i : 0));
    setLightbox(null);
  }, [count]);

  const step = (dir) => setActive((i) => (count ? (i + dir + count) % count : 0));

  useEffect(() => {
    if (lightbox === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox((i) => (i + 1) % count);
      if (e.key === 'ArrowLeft') setLightbox((i) => (i - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, count]);

  const onStageKey = (e) => {
    if (lightbox !== null) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightbox(active); }
  };

  const safeActive = count ? Math.min(active, count - 1) : 0;

  return (
    <section className="detail-section ev-section" id="screenshots" aria-labelledby="screenshots-title">
      <header className="detail-section__head">
        <h2 className="ev-section-title" id="screenshots-title">Screenshots</h2>
        {count ? <span className="muted">{count}</span> : null}
      </header>

      {count === 0 ? (
        <p className="ev-missing">
          <Icon name="film" size={14} /> No screenshots have been documented for this segment yet.
        </p>
      ) : (
        <div className="shot-carousel" onKeyDown={onStageKey}>
          <div className="shot-carousel__row">
            {count > 1 ? (
              <button type="button" className="icon-btn shot-carousel__nav shot-carousel__nav--prev"
                onClick={() => step(-1)} aria-label="Previous screenshot">
                <Icon name="chevronLeft" size={20} />
              </button>
            ) : null}
            <figure className="shot-carousel__stage">
              <button type="button" className="shot-carousel__frame" onClick={() => setLightbox(safeActive)}
                aria-label={`Open screenshot ${safeActive + 1} of ${count} full size`}>
                <img
                  key={`${usable[safeActive].url ?? usable[safeActive].data}-${safeActive}`}
                  src={usable[safeActive].url || usable[safeActive].data}
                  alt={usable[safeActive].alt || `Screenshot ${safeActive + 1} of ${count}`}
                  loading={safeActive === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
                <span className="shot-carousel__counter mono" aria-hidden="true">{safeActive + 1} / {count}</span>
                <span className="shot-carousel__zoom mono" aria-hidden="true"><Icon name="search" size={12} /> Full size</span>
              </button>
            </figure>
            {count > 1 ? (
              <button type="button" className="icon-btn shot-carousel__nav shot-carousel__nav--next"
                onClick={() => step(1)} aria-label="Next screenshot">
                <Icon name="chevronRight" size={20} />
              </button>
            ) : null}
          </div>

          {count > 1 ? (
            <div className="shot-carousel__strip" role="tablist" aria-label="Choose a screenshot">
              {usable.map((s, i) => (
                <button key={`${s.url || s.data}-${i}`} type="button" role="tab"
                  aria-selected={i === safeActive} aria-label={`Screenshot ${i + 1}`}
                  className={`shot-carousel__thumb${i === safeActive ? ' is-active' : ''}`}
                  onClick={() => setActive(i)}>
                  <img src={s.url || s.data} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {lightbox !== null && usable[lightbox] ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Screenshot viewer"
          onMouseDown={(e) => e.target === e.currentTarget && setLightbox(null)}>
          <button type="button" className="lightbox__close icon-btn" onClick={() => setLightbox(null)} aria-label="Close viewer">
            <Icon name="close" size={20} />
          </button>
          <span className="lightbox__counter mono">{lightbox + 1} / {count}</span>
          <button type="button" className="lightbox__nav lightbox__nav--prev icon-btn"
            onClick={() => setLightbox((i) => (i - 1 + count) % count)} aria-label="Previous screenshot">
            <Icon name="chevronLeft" size={22} />
          </button>
          <figure className="lightbox__figure">
            <img src={usable[lightbox].url || usable[lightbox].data} alt={usable[lightbox].alt || `Screenshot ${lightbox + 1}`} />
            {usable[lightbox].alt ? <figcaption>{usable[lightbox].alt}</figcaption> : null}
          </figure>
          <button type="button" className="lightbox__nav lightbox__nav--next icon-btn"
            onClick={() => setLightbox((i) => (i + 1) % count)} aria-label="Next screenshot">
            <Icon name="chevronRight" size={22} />
          </button>
        </div>
      ) : null}
    </section>
  );
}
