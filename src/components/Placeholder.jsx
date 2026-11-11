/**
 * The shared SVG placeholder family. One component draws every placeholder
 * kind (episode, segment, movie, character, gadget, book) so they all read as
 * siblings: the same construction lines, the same accent, the same
 * "intentionally blank" framing — a missing picture should look designed, not
 * broken.
 *
 * Everything is painted with theme tokens (currentColor + the --placeholder-*
 * variables in cards.css), so placeholders stay legible in every built-in,
 * custom and imported theme. No colour is hardcoded.
 */

const ART = {
  // A broadcast: a screen with play triangle, framed by broadcast rings.
  episode: (
    <>
      <circle cx="140" cy="78" r="66" className="ph-ring" />
      <circle cx="140" cy="78" r="46" className="ph-ring ph-ring--dashed" />
      <rect x="102" y="52" width="76" height="52" rx="9" className="ph-outline" />
      <path d="M128 66v24l20-12-20-12Z" className="ph-fill" />
    </>
  ),
  // A single story inside the broadcast: the same screen, one frame.
  segment: (
    <>
      <circle cx="140" cy="78" r="66" className="ph-ring" />
      <rect x="98" y="50" width="84" height="56" rx="9" className="ph-outline" />
      <path d="M132 66v24l20-12-20-12Z" className="ph-fill" />
      <path d="M98 74h84" className="ph-ring" />
    </>
  ),
  // A film poster: tall frame with the sprocket strip of a reel.
  movie: (
    <>
      <rect x="88" y="12" width="104" height="132" rx="10" className="ph-outline" />
      <path d="M88 34h104M88 122h104" className="ph-ring" />
      <circle cx="140" cy="78" r="26" className="ph-outline" />
      <path d="M133 65v26l22-13-22-13Z" className="ph-fill" />
      <path d="M96 22h4M108 22h4M120 22h4M132 22h4M144 22h4M156 22h4M168 22h4M180 22h4" className="ph-ring ph-ring--dashed" />
    </>
  ),
  // A person: head and shoulders in a portrait frame.
  character: (
    <>
      <circle cx="140" cy="78" r="66" className="ph-ring" />
      <circle cx="140" cy="62" r="24" className="ph-outline" />
      <path d="M94 128c8-30 24-44 46-44s38 14 46 44" className="ph-outline" />
    </>
  ),
  // A gadget: the bell-with-cross of Doraemon's pocket, radiating.
  gadget: (
    <>
      <circle cx="140" cy="78" r="66" className="ph-ring" />
      <circle cx="140" cy="78" r="42" className="ph-ring ph-ring--dashed" />
      <circle cx="140" cy="78" r="17" className="ph-outline" />
      <path d="M140 24v14M140 118v14M86 78h14M180 78h14M102 40l10 10M168 106l10 10M178 40l-10 10M112 106l-10 10" className="ph-outline" />
    </>
  ),
  // An open book: the coming-soon mark of the future manga section.
  book: (
    <>
      <path d="M140 44c-14-9-31-13-48-11v72c17-2 34 2 48 11 14-9 31-13 48-11V33c-17-2-34 2-48 11Z" className="ph-outline" />
      <path d="M140 44v72" className="ph-outline" />
      <path d="M104 50c10 0 20 2 28 7M104 64c10 0 20 2 28 7M104 78c10 0 20 2 28 7M148 57c8-5 18-7 28-7M148 71c8-5 18-7 28-7M148 85c8-5 18-7 28-7" className="ph-ring" />
    </>
  ),
};

/**
 * One placeholder illustration. `kind` picks the drawing; `label` (e.g.
 * "EP 001") prints in the corner like real artwork captions. Rendered inside
 * MediaImage whenever a record has no picture, and reused standalone on the
 * manga coming-soon page.
 */
export default function Placeholder({ kind = 'episode', label = null, className = '' }) {
  const art = ART[kind] ?? ART.episode;
  return (
    <div className={`media__ph ${className}`} role="img" aria-label={label ? `${label} — artwork not documented yet` : 'Artwork not documented yet'}>
      <svg viewBox="0 0 280 156" fill="none" aria-hidden="true" className="media__ph-art">
        {art}
      </svg>
      {label ? <span className="media__label" aria-hidden="true">{label}</span> : null}
    </div>
  );
}
