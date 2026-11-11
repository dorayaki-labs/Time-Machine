import { useState } from 'react';
import Placeholder from './Placeholder.jsx';

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
  // The `image` field has been stored both as a plain URL string and as
  // { url, alt } (and Gallery shots can carry a data URI). Normalise here so
  // a caller can pass the whole field through without picking it apart —
  // passing the object straight through used to render src="[object Object]"
  // and silently fall back to the placeholder on detail pages.
  const url = typeof src === 'string' ? src : src?.url ?? src?.data ?? null;
  const altText = alt || (src && typeof src === 'object' ? src.alt : '') || '';
  const showReal = Boolean(url) && !failed;
  return (
    <div className={`media media--${kind} ${className}`} style={{ '--hue': hueFor(seed ?? altText) }}>
      {showReal ? (
        <img className="media__img" src={url} alt={altText} loading={priority ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
      ) : (
        <Placeholder kind={kind} label={label} />
      )}
    </div>
  );
}
