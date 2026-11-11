import { Link } from 'react-router-dom';
import MediaImage from './MediaImage.jsx';
import useCardGlow from '@/hooks/useCardGlow.js';

/** The base card. Episode, movie, character and gadget cards are thin wrappers around it.
 *  `media` optionally replaces the standard artwork (used by multi-segment covers).
 *  `badge` sits on the top-right corner of the art; `artBadge` on the top-left.
 *  `glow` opts the card into the pointer-follow light (episode cards); the
 *  hover motion itself is the standard slide-up lift. */
export default function MediaCard({ to, image, imageAlt, kind, seed, label, title, subtitle, children, footer, badge, artBadge, className = '', media = null, glow = false }) {
  // The glow ref is cheap either way (the hook's listeners only bind to the
  // element it is attached to), so it is always created and only attached
  // when the card opts in.
  const glowRef = useCardGlow();
  return (
    <article
      ref={glow ? glowRef : undefined}
      className={`media-card media-card--${kind}${glow ? ' media-card--glow' : ''} ${className}`}
    >
      <Link to={to} className="media-card__link" aria-label={title}>
        <div className="media-card__art">
          {media ?? <MediaImage src={image} alt={imageAlt ?? ''} kind={kind} seed={seed ?? title} label={label} />}
          {badge ? <span className="media-card__badge">{badge}</span> : null}
          {artBadge ? <span className="media-card__badge media-card__badge--left">{artBadge}</span> : null}
        </div>
        <div className="media-card__body">
          <h3 className="media-card__title">{title}</h3>
          {subtitle ? <p className="media-card__subtitle" lang="ja">{subtitle}</p> : null}
          {children}
        </div>
      </Link>
      {footer ? <div className="media-card__footer">{footer}</div> : null}
    </article>
  );
}
