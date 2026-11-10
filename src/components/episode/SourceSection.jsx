// SECTION 08 — Viewing sources. A clean list first: one row per source with
// provider, type, quality, audio language, subtitles, and — when the note
// describes coverage ("All 3 Segments") — a highlighted coverage chip, shown
// exactly as the record states it. Nothing plays until Watch is clicked; the
// player then expands underneath that one source (one at a time), reusing the
// existing embed/direct handlers unchanged.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { embedUrlOf } from '../SourceList.jsx';
import { handlerFor } from '@/handlers/index.js';
import { languageName } from '@/lib/catalog.js';

const openEmbedWindow = (url) => { if (url) window.open(url, '_blank', 'noopener,noreferrer'); };

function SourceMeta({ source }) {
  const bits = [];
  if (source.language) bits.push(`${languageName(source.language)} audio`);
  if (source.subtitles?.has) {
    const kind = source.subtitles.type ? `${source.subtitles.type[0].toUpperCase()}${source.subtitles.type.slice(1)} subtitles` : 'Subtitles available';
    bits.push(source.subtitles.languages?.length ? `${kind}: ${source.subtitles.languages.join(', ')}` : kind);
  } else if (source.language || source.subtitles) {
    bits.push('No subtitles');
  }
  if (!bits.length) return null;
  return <p className="source-row__meta">{bits.join(' · ')}</p>;
}

function CoverageNote({ notes }) {
  if (!notes) return null;
  // Coverage is only ever stated by the note in the record — no invented
  // fields. A note that begins with "all" is shown as a coverage chip.
  return /^all\b/i.test(notes)
    ? <span className="chip chip--mono ev-coverage"><Icon name="check" size={11} /> {notes}</span>
    : <span className="source-row__note muted">{notes}</span>;
}

function SourceRow({ source, index, active, onToggle }) {
  const handler = handlerFor(source);
  const name = source.label ?? handler.label;
  const externalUrl = embedUrlOf(source);
  return (
    <article className={`source-row${active ? ' is-active' : ''}`}>
      <div className="source-row__head">
        <div className="source-row__id">
          <span className="source-row__provider">{name}</span>
          <span className="chip source-row__type">{source.type === 'direct' ? 'Direct' : 'Embed'}</span>
          <CoverageNote notes={source.notes} />
        </div>
        <div className="source-row__side">
          {source.quality ? <span className="chip chip--mono">{source.quality}</span> : null}
          {externalUrl ? (
            <button type="button" className="icon-btn source-row__external" title="Open this embed in a new window"
              aria-label={`Open ${name} in a new window`} onClick={() => openEmbedWindow(externalUrl)}>
              <Icon name="external" size={13} />
            </button>
          ) : null}
          <button type="button" className={`btn btn--ghost btn--sm${active ? ' is-active' : ''}`} onClick={onToggle}
            aria-expanded={active}>
            <Icon name={active ? 'close' : 'play'} size={13} /> {active ? 'Close player' : 'Watch'}
          </button>
        </div>
      </div>
      <SourceMeta source={source} />
      {active ? (
        <div className="source-row__player">
          <p className="source-stage__bar">
            <Icon name="play" size={13} />
            <span>Playing <strong>{name}</strong></span>
            {externalUrl ? (
              <button type="button" className="source-stage__external" onClick={() => openEmbedWindow(externalUrl)}>
                <Icon name="external" size={13} /> Open in new window
              </button>
            ) : null}
            <button type="button" className="source-stage__stop" onClick={onToggle}>Close</button>
          </p>
          <handler.Player data={source.data} />
          {source.type === 'embed' ? (
            <p className="source-stage__note muted small">
              An external player, shown as submitted. Some providers block being embedded —
              if the frame stays blank or refuses to load, open it in a new window instead.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function SourceSection({ sources = [], noun = 'episode' }) {
  const [active, setActive] = useState(null);
  const playable = sources.filter((s) => handlerFor(s));
  const links = sources.filter((s) => !handlerFor(s));

  useEffect(() => { setActive(null); }, [sources]);

  return (
    <section className="detail-section ev-section" id="sources" aria-labelledby="sources-title">
      <header className="detail-section__head">
        <h2 className="ev-section-title" id="sources-title">Viewing sources</h2>
        {playable.length ? <span className="muted">{playable.length}</span> : null}
      </header>

      {playable.length === 0 && links.length === 0 ? (
        <div className="no-source ev-no-source">
          <span className="no-source__icon"><Icon name="film" size={22} /></span>
          <p className="no-source__title">No viewing sources have been submitted for this {noun}.</p>
          <Link className="btn btn--ghost btn--sm" to="/contribute?category=source">Suggest a source</Link>
        </div>
      ) : (
        <div className="ev-sources">
          {playable.length ? (
            <>
              {playable.length > 1 ? (
                <p className="ev-sources__hint muted small">Nothing is playing — choose a source and press Watch.</p>
              ) : null}
              <div className="ev-sources__list">
                {playable.map((s, i) => (
                  <SourceRow key={`${s.type}-${i}`} source={s} index={i}
                    active={active === i}
                    onToggle={() => setActive(active === i ? null : i)} />
                ))}
              </div>
              <p className="source-viewer__note muted">
                Sources are shown as submitted. Time Machine hosts no video itself.
              </p>
            </>
          ) : null}
          {links.length ? (
            <ul className="source-list source-list--extra">
              {links.map((s, i) => (
                <li key={i} className="source-item">
                  <a className="source-item__link" href={s.data} target="_blank" rel="noopener noreferrer nofollow">
                    <span className="source-item__provider">{s.label ?? 'External page'}</span>
                    <Icon name="external" size={15} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
