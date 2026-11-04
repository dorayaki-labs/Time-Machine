import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

/**
 * Screenshot carousel: one big frame with prev/next controls and a filmstrip
 * of thumbnails underneath. Keyboard users get arrows and a counter; clicking
 * the frame opens the lightbox for full-size viewing. Images are lazy-loaded,
 * and reduced-motion users get no slide transition (global CSS handles that).
 */
export default function Gallery({ screenshots = [], title }) {
  const usable = screenshots.filter((s) => s && (s.url || s.data));
  const count = usable.length;
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  const step = (dir) => setActive((i) => (i + dir + count) % count);

  useEffect(() => {
    if (!count) return undefined;
    const onKey = (e) => {
      if (lightbox !== null) {
        if (e.key === 'Escape') setLightbox(null);
        if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? null : (i + 1) % count));
        if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? null : (i - 1 + count) % count));
        return;
      }
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // no dependency array on purpose: count/lightbox stay current

  if (!count) return null;
  const current = usable[Math.min(active, count - 1)];
  const src = current.url || current.data;

  return (
    <section className="gallery" aria-label={`Screenshots of ${title}`}>
      <header className="detail-section__head">
        <h2>Screenshots</h2>
        <span className="muted">{count}</span>
      </header>

      <div className="carousel" role="group" aria-roledescription="carousel" aria-label="Screenshots">
        <button type="button" className="carousel__nav carousel__nav--prev icon-btn" onClick={() => step(-1)} aria-label="Previous screenshot" disabled={count === 1}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <button type="button" className="carousel__frame" onClick={() => setLightbox(Math.min(active, count - 1))} aria-label={`Open screenshot ${active + 1} of ${count}`}>
          <img src={src} alt={current.alt || `Screenshot ${active + 1} of ${count}`} loading={active === 0 ? 'eager' : 'lazy'} decoding="async" />
          <span className="carousel__counter" aria-hidden="true">{active + 1} / {count}</span>
        </button>
        <button type="button" className="carousel__nav carousel__nav--next icon-btn" onClick={() => step(1)} aria-label="Next screenshot" disabled={count === 1}>
          <Icon name="chevronRight" size={22} />
        </button>
      </div>

      {count > 1 ? (
        <div className="carousel__strip" role="tablist" aria-label="Choose a screenshot">
          {usable.map((s, i) => (
            <button key={`${s.url || s.data}-${i}`} type="button" role="tab" aria-selected={i === active}
              className={`carousel__thumb${i === active ? ' is-active' : ''}`}
              onClick={() => setActive(i)} aria-label={`Screenshot ${i + 1}`}>
              <img src={s.url || s.data} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      ) : null}

      {lightbox !== null && usable[lightbox] ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Screenshot viewer" onMouseDown={(e) => e.target === e.currentTarget && setLightbox(null)}>
          <button type="button" className="lightbox__close icon-btn" onClick={() => setLightbox(null)} aria-label="Close viewer"><Icon name="close" size={20} /></button>
          <button type="button" className="lightbox__nav lightbox__nav--prev icon-btn"
            onClick={() => setLightbox((i) => (i - 1 + count) % count)} aria-label="Previous screenshot"><Icon name="chevronLeft" size={22} /></button>
          <figure className="lightbox__figure">
            <img src={usable[lightbox].url || usable[lightbox].data} alt={usable[lightbox].alt || `Screenshot ${lightbox + 1}`} />
            {usable[lightbox].alt ? <figcaption>{usable[lightbox].alt}</figcaption> : null}
          </figure>
          <button type="button" className="lightbox__nav lightbox__nav--next icon-btn"
            onClick={() => setLightbox((i) => (i + 1) % count)} aria-label="Next screenshot"><Icon name="chevronRight" size={22} /></button>
        </div>
      ) : null}
    </section>
  );
}
