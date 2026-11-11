import { useEffect, useRef } from 'react';

/**
 * Card pointer glow: a soft light follows the cursor across the card. Written
 * for the episode cards; any card can opt in with `useCardGlow()` and a
 * `media-card--glow` class. Purely decorative — the hover motion itself stays
 * the plain slide-up lift.
 *
 * Performance rules (the site must stay smooth on old hardware):
 *  - zero React state: the position is written to CSS custom properties
 *    (--spot-x/--spot-y) on the element itself, so a pointer move never
 *    re-renders the component;
 *  - writes are coalesced through one requestAnimationFrame — at most one
 *    style write per frame no matter how fast the pointer moves;
 *  - the listeners live on the card element (no global handlers) and are
 *    removed on leave/unmount;
 *  - pointer: coarse devices (touch) and reduced-motion users get no glow —
 *    the effect is decorative only. The studio's "Card pointer glow" toggle
 *    hides it via [data-card-glow='off'] regardless.
 */
export default function useCardGlow() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const fine = window.matchMedia?.('(pointer: fine)').matches;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return undefined;

    let frame = null;
    const apply = (x, y) => {
      frame = null;
      const rect = el.getBoundingClientRect();
      const px = (x - rect.left) / rect.width;   // 0..1 across the card
      const py = (y - rect.top) / rect.height;   // 0..1 down the card
      el.style.setProperty('--spot-x', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--spot-y', `${(py * 100).toFixed(1)}%`);
    };

    const onMove = (e) => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => apply(e.clientX, e.clientY));
    };
    const onLeave = () => {
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      el.style.removeProperty('--spot-x');
      el.style.removeProperty('--spot-y');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return ref;
}
