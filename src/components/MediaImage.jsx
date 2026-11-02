import { useState } from 'react';

const PLACEHOLDERS = {
  episode: '/assets/placeholders/episode.svg',
  movie: '/assets/placeholders/movie.svg',
  character: '/assets/placeholders/character.svg',
  gadget: '/assets/placeholders/gadget.svg',
};

function hueFor(seed = '') {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return 185 + ((h >>> 0) % 85);
}

/**
 * Every card image goes through here. A record's own artwork is shown when it
 * has one; the themed placeholder appears only when the artwork is missing or
 * fails to load, so a broken-image icon never appears.
 */
export default function MediaImage({ src, alt = '', kind = 'episode', seed, label, className = '', priority = false }) {
  const [failed, setFailed] = useState(false);
  const showReal = Boolean(src) && !failed;
  return (
    <div className={`media media--${kind} ${className}`} style={{ '--hue': hueFor(seed ?? alt) }}>
      {showReal ? (
        <img className="media__img" src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
      ) : (
        <>
          <img className="media__placeholder" src={PLACEHOLDERS[kind] ?? PLACEHOLDERS.episode} alt="" loading="lazy" decoding="async" />
          {label ? <span className="media__label" aria-hidden="true">{label}</span> : null}
        </>
      )}
    </div>
  );
}
