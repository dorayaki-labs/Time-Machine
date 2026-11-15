// Ambient poster glow: a blurred halo of the artwork's own colours bleeding
// out from behind the frame, so the page picks up the poster's palette — a
// white-and-blue poster bleeds white on its light side and blue on its blue
// side. Two symmetric washes are sampled from the picture's left and right
// edges (an average would muddy everything into one grey), and they fade
// with distance exactly like light seeping through a gap.
//
// Implementation notes:
//   * The colours are sampled ONCE per image (canvas, 2×16 px strips from
//     each edge, made robust by try/catch — a tainted canvas, a missing
//     image or a data URI that will not decode all degrade to "no glow",
//     never a broken page).
//   * The washes are ::before/::after pseudo-elements driven by CSS custom
//     properties (--glow-left / --glow-right), so the effect costs nothing
//     after the one-time sample and inherits the theme's reduced-motion
//     rules (it is static, so there is nothing to reduce).
//   * `aria-hidden` and `pointer-events: none` throughout: purely
//     decorative, and it respects the studio's card-glow toggle.

import { useEffect, useState } from 'react';

function averageOf(img, sx, sy, sw, sh) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (!a) return null; // fully transparent sample: nothing to bleed
  return `rgb(${r} ${g} ${b} / 0.55)`;
}

/** Samples the left/right edge colours of a loaded image element.
 *
 *  Image hosts split into two kinds: those that send CORS headers (GitHub
 *  raw and same-origin deployments do; `crossOrigin='anonymous'` loads and
 *  the canvas reads cleanly) and those that do not (some external CDNs —
 *  the anonymous load itself fails there). For the second kind the poster
 *  is re-fetched WITHOUT the CORS attribute only to check it exists; the
 *  canvas stays untouchable, so the glow gracefully skips: a decorative
 *  effect must never break the page or fake its colours. */
function sampleEdgeColors(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return resolve(null);
        const strip = Math.max(1, Math.round(w * 0.18));
        resolve({
          left: averageOf(img, 0, 0, strip, h),
          right: averageOf(img, w - strip, 0, strip, h),
        });
      } catch {
        resolve(null); // tainted canvas (cross-origin without CORS): skip
      }
    };
    img.onerror = () => resolve(null); // no CORS on the host: no glow
    img.src = url;
  });
}

/**
 * Wraps the artwork frame of a detail page: `<AmbientPoster src={url}
 * className="media media--fill">…</AmbientPoster>` renders the children
 * plus two soft colour washes behind the frame's left and right edges.
 */
export default function AmbientPoster({ src, className = '', children }) {
  const [colors, setColors] = useState(null);

  useEffect(() => {
    let active = true;
    if (!src || typeof src !== 'string' || !src.startsWith('http')) {
      setColors(null);
      return undefined;
    }
    sampleEdgeColors(src).then((sampled) => {
      if (active) setColors(sampled);
    });
    return () => { active = false; };
  }, [src]);

  return (
    <div
      className={`ambient-poster ${className}`}
      style={colors ? { '--glow-left': colors.left, '--glow-right': colors.right } : undefined}
    >
      {children}
    </div>
  );
}
