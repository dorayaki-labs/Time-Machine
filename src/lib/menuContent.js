// Randomised homepage dressing: the hero illustration and the slogan both
// change per page load (per browser session, not per re-render). Vite cannot
// enumerate public/ at runtime, so the hero images come from the generated
// manifest (scripts/generate-menu-manifest.mjs — run by predev/prebuild).
// The import is relative with ?json so it resolves regardless of the build's
// base path (the directory name contains a space, which root-absolute
// specifiers do not survive).

import manifest from '../../public/menu images/manifest.json';

/** One random integer in [0, n), or 0 when n <= 0. */
const randomIndex = (n) => (n > 0 ? Math.floor(Math.random() * n) : 0);

/**
 * All hero images found in public/menu images/ at build time, as root-relative
 * paths. Empty when the directory has no images yet — the caller falls back
 * to the standing door artwork.
 */
export const MENU_IMAGES = (manifest?.images ?? [])
  .map((img) => `/${img.path}`);

/** A random hero image path, or null when the rotation is empty. */
export const randomMenuImage = () => MENU_IMAGES[randomIndex(MENU_IMAGES.length)] ?? null;

/**
 * The hero slogans — just the two plain, true ones. Written to read as one
 * line each at the sizes the hero uses. Add a line here and it joins the
 * rotation — nothing else to touch.
 */
export const SLOGANS = [
  'By the Community, for the community.',
  'Every movie, every gadget, every episode.',
];

/** A random slogan. */
export const randomSlogan = () => SLOGANS[randomIndex(SLOGANS.length)];
