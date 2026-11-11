import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '@/components/Icon.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { getEntry, displayTitle } from '@/lib/catalog.js';
import { handlerFor } from '@/handlers/index.js';
import { embedUrlOf } from '@/components/SourceList.jsx';

/**
 * The fullscreen player page (/play?e=<entryId>&s=<sourceIndex>). "Open in a
 * new tab" from a record's viewing sources lands here instead of handing the
 * raw embed URL to the browser: the archive keeps the visitor, the player
 * gets the whole viewport, and the back link returns to the record. Only
 * real embed sources are routed here — the link never exists for direct
 * media or plain outbound links, and the page re-checks everything before
 * rendering a frame, so a hand-edited URL cannot make it iframe an
 * arbitrary address that the archive itself did not submit.
 */
export default function Play() {
  useDocumentTitle('Player');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const entryId = params.get('e');
  const sourceIndex = Number.parseInt(params.get('s') ?? '0', 10);

  const entry = entryId ? getEntry(entryId) : null;
  // Same playable filter SourceList uses, so the index matches the picker.
  const playable = entry ? (entry.sources ?? []).filter((s) => handlerFor(s)) : [];
  const source = Number.isInteger(sourceIndex) ? playable[sourceIndex] : null;
  const url = embedUrlOf(source);
  const name = source?.label ?? handlerFor(source)?.label ?? 'Player';
  const backTo = entry?.url ?? '/';

  // Escape leaves the player, like closing a fullscreen app.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') navigate(backTo); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, backTo]);

  if (!entry || !source || !url) {
    return (
      <div className="play-page play-page--empty">
        <div className="play-empty">
          <span className="play-empty__icon"><Icon name="film" size={30} /></span>
          <h1>Nothing to play here</h1>
          <p className="muted">This player link is incomplete or its source is no longer available.</p>
          <Link className="btn btn--ghost btn--sm" to="/">Back to the archive</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="play-page">
      <header className="play-page__bar">
        <Link className="btn btn--ghost btn--sm play-page__back" to={backTo}>
          <Icon name="arrowLeft" size={15} /> Back to {displayTitle(entry)}
        </Link>
        <span className="play-page__title">
          <Icon name="film" size={14} /> {name}
        </span>
        <a className="btn btn--ghost btn--sm" href={url} target="_blank" rel="noopener noreferrer nofollow">
          <Icon name="external" size={13} /> Open at the provider
        </a>
      </header>
      <div className="play-page__stage">
        <iframe
          src={url}
          className="play-page__frame"
          title={`${displayTitle(entry)} — ${name}`}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      </div>
      <p className="play-page__hint muted small">
        An external player, shown as submitted — Time Machine hosts no video. If the frame stays
        blank, the provider blocks embedding: use “Open at the provider”.
      </p>
    </div>
  );
}
