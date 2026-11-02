import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

/** Screenshot gallery with a keyboard-friendly lightbox. Images without rights-cleared URLs are not listed. */
export default function Gallery({ screenshots = [], title }) {
  const [openIndex, setOpenIndex] = useState(null);
  const open = openIndex !== null && screenshots[openIndex];

  useEffect(() => {
    if (openIndex === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenIndex(null);
      if (e.key === 'ArrowRight') setOpenIndex((i) => (i === null ? null : (i + 1) % screenshots.length));
      if (e.key === 'ArrowLeft') setOpenIndex((i) => (i === null ? null : (i - 1 + screenshots.length) % screenshots.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIndex, screenshots.length]);

  if (!screenshots.length) return null;

  return (
    <section className="gallery" aria-label={`Screenshots of ${title}`}>
      <header className="detail-section__head">
        <h2>Screenshots</h2>
        <span className="muted">{screenshots.length}</span>
      </header>
      <div className="gallery__grid">
        {screenshots.map((shot, i) => (
          <button key={shot.url} type="button" className="gallery__thumb" onClick={() => setOpenIndex(i)} aria-label={`Open screenshot ${i + 1} of ${screenshots.length}`}>
            <img src={shot.url} alt={shot.alt || `Screenshot ${i + 1}`} loading="lazy" decoding="async" />
          </button>
        ))}
      </div>

      {open ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Screenshot viewer" onMouseDown={(e) => e.target === e.currentTarget && setOpenIndex(null)}>
          <button type="button" className="lightbox__close icon-btn" onClick={() => setOpenIndex(null)} aria-label="Close viewer"><Icon name="close" size={20} /></button>
          <button
            type="button"
            className="lightbox__nav lightbox__nav--prev icon-btn"
            onClick={() => setOpenIndex((i) => (i - 1 + screenshots.length) % screenshots.length)}
            aria-label="Previous screenshot"
          ><Icon name="chevronLeft" size={22} /></button>
          <figure className="lightbox__figure">
            <img src={open.url} alt={open.alt || `Screenshot ${openIndex + 1}`} />
            {open.alt ? <figcaption>{open.alt}</figcaption> : null}
          </figure>
          <button
            type="button"
            className="lightbox__nav lightbox__nav--next icon-btn"
            onClick={() => setOpenIndex((i) => (i + 1) % screenshots.length)}
            aria-label="Next screenshot"
          ><Icon name="chevronRight" size={22} /></button>
        </div>
      ) : null}
    </section>
  );
}
