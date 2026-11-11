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
 * The hero slogans. Written to read as one line each at the sizes the hero
 * uses; the first is the classic line, the rest riff on archiving, memory,
 * community and preservation — the site's identity, not marketing copy.
 * Add a line here and it joins the rotation — nothing else to touch.
 */
export const SLOGANS = [
  'Every episode. Every movie. Every gadget.',
  'Every story kept safe, one record at a time.',
  'A time capsule for every adventure.',
  'The details survive because someone wrote them down.',
  'Half a century of stories, looked after by the people who love them.',
  'Preserved, translated and cross-checked by the community.',
  'Nothing from yesterday gets lost on our watch.',
  'An archive is a promise to the future.',
  'From 1969 to forever, one page at a time.',
  'Nostalgia, carefully filed.',
];

/** A random slogan. */
export const randomSlogan = () => SLOGANS[randomIndex(SLOGANS.length)];
