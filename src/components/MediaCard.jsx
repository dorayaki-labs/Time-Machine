import { Link } from 'react-router-dom';
import MediaImage from './MediaImage.jsx';

/** The base card. Episode, movie, character and gadget cards are thin wrappers around it. */
export default function MediaCard({ to, image, imageAlt, kind, seed, label, title, subtitle, children, footer, badge, className = '' }) {
  return (
    <article className={`media-card media-card--${kind} ${className}`}>
      <Link to={to} className="media-card__link" aria-label={title}>
        <div className="media-card__art">
          <MediaImage src={image} alt={imageAlt ?? ''} kind={kind} seed={seed ?? title} label={label} />
          {badge ? <span className="media-card__badge">{badge}</span> : null}
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
