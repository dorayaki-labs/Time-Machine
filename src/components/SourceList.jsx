import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import MetadataSection from './MetadataSection.jsx';
import { handlerFor } from '@/handlers/index.js';

function SourceIcon({ type }) {
  return <Icon name={type === 'direct' ? 'play' : 'film'} size={16} />;
}

/** The small fact chips every source shows: language, subtitles, quality. */
function SourceChips({ source }) {
  const chips = [];
  if (source.language) chips.push(source.language);
  if (source.subtitles?.has) {
    const kind = source.subtitles.type ? `${source.subtitles.type[0].toUpperCase()}${source.subtitles.type.slice(1)} sub` : 'Subtitled';
    chips.push(kind + (source.subtitles.languages.length ? ` · ${source.subtitles.languages.join(', ')}` : ''));
  } else if (source.language || source.subtitles) {
    chips.push('No subtitles');
  }
  if (source.quality) chips.push(source.quality);
  if (!chips.length) return null;
  return (
    <p className="source-option__chips">
      {chips.map((chip, i) => <span key={i} className="chip">{chip}</span>)}
    </p>
  );
}

function SourceOption({ source, index, selected, onSelect }) {
  const handler = handlerFor(source);
  const name = source.label ?? handler.label;
  const externalUrl = embedUrlOf(source);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`source-option${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
    >
      <span className="source-option__head">
        <SourceIcon type={source.type} />
        <span className="source-option__name">{name}</span>
        <span className="mono source-option__num">#{index + 1}</span>
        {selected ? <span className="source-option__playing"><Icon name="play" size={13} /> Playing</span> : null}
        {externalUrl && !selected ? (
          <span
            className="source-option__open"
            title="Open this embed in a new window"
            role="button"
            tabIndex={0}
            aria-label={`Open ${name} in a new window`}
            onClick={(e) => { e.stopPropagation(); openEmbedWindow(externalUrl); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openEmbedWindow(externalUrl); } }}
          >
            <Icon name="external" size={13} />
          </span>
        ) : null}
      </span>
      <SourceChips source={source} />
      {source.notes ? <span className="source-option__notes">{source.notes}</span> : null}
    </button>
  );
}

function LinkRow({ source }) {
  return (
    <a className="source-item__link" href={source.data} target="_blank" rel="noopener noreferrer nofollow">
      <span className="source-item__provider">External page</span>
      <SourceChips source={source} />
      <Icon name="external" size={15} />
    </a>
  );
}

/**
 * The raw embed URL behind a source, when it is a real http(s) address —
 * either the URL itself, or the src of an iframe HTML snippet. Returns null
 * for anything unusable; the external-window option simply hides then.
 * We only ever OPEN the provider's own URL in a new tab — iframe and CSP
 * restrictions are the provider's, and this does not try to bypass them.
 */
export function embedUrlOf(source) {
  if (!source || source.type !== 'embed' || typeof source.data !== 'string') return null;
  const data = source.data.trim();
  const candidate = data.startsWith('<')
    ? (data.match(/src\s*=\s*["']([^"']+)["']/i)?.[1] ?? null)
    : data;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Opens the embed URL in its own browser window/tab, never inside this page. */
function openEmbedWindow(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Viewing sources never start playing on their own: the stage waits, the
 * picker below lists every source with its details (language, subtitles,
 * quality), and one click fills the stage. The Direct handler plays plain
 * media URLs through video.js; the Embed handler shows a provider iframe
 * as-is. Non-playable entries fall through to plain link rows.
 */
export default function SourceList({ sources = [], noun = 'entry' }) {
  const [selected, setSelected] = useState(null);
  const playable = sources.filter((s) => handlerFor(s));
  const links = sources.filter((s) => !handlerFor(s));
  const current = selected !== null ? playable[selected] : null;
  const handler = current ? handlerFor(current) : null;
  const externalUrl = embedUrlOf(current);

  // A different record's sources arrived: nothing should keep playing.
  useEffect(() => { setSelected(null); }, [sources]);

  return (
    <MetadataSection
      id="sources"
      title="Viewing sources"
      aside={playable.length ? <span className="muted">{playable.length}</span> : null}
    >
      {playable.length === 0 && links.length === 0 ? (
        <div className="no-source">
          <span className="no-source__icon"><Icon name="film" size={26} /></span>
          <p className="no-source__title">No viewing sources have been submitted for this {noun}.</p>
          <p className="no-source__text">Know a place to watch it? Sources are added by the community and checked before they are listed.</p>
          <Link className="btn btn--ghost btn--sm" to="/contribute?category=source">Suggest a source</Link>
        </div>
      ) : (
        <div className="source-viewer">
          {handler ? (
            <div className="source-stage">
              <p className="source-stage__bar">
                <SourceIcon type={current.type} />
                <span>Playing <strong>{current.label ?? handler.label}</strong></span>
                {externalUrl ? (
                  <button type="button" className="source-stage__external"
                    title="Open this embed in a separate browser window"
                    onClick={() => openEmbedWindow(externalUrl)}>
                    <Icon name="external" size={13} /> Open in new window
                  </button>
                ) : null}
                <button type="button" className="source-stage__stop" onClick={() => setSelected(null)}>Stop</button>
              </p>
              <handler.Player data={current.data} />
              {current.type === 'embed' ? (
                <p className="source-stage__note muted small">
                  An external player, shown as submitted. Some providers block being embedded —
                  if the frame stays blank or refuses to load, open it in a new window instead.
                </p>
              ) : null}
            </div>
          ) : (
            // Nothing is playing: the player container is removed from the
            // layout entirely — no empty frame, no reserved height. The
            // guidance collapses into a single quiet line above the picker.
            <p className="source-viewer__idle muted">
              {playable.length
                ? <>Nothing is playing yet. Choose one of the {playable.length} source{playable.length > 1 ? 's' : ''} below to start watching.</>
                : 'Only outbound links were submitted for this entry; find them below.'}
            </p>
          )}

          {playable.length > 0 ? (
            <div className="source-picker" role="radiogroup" aria-label="Choose a source">
              {playable.map((s, i) => (
                <SourceOption
                  key={`${s.type}-${i}`}
                  source={s}
                  index={i}
                  selected={selected === i}
                  onSelect={() => setSelected(selected === i ? null : i)}
                />
              ))}
            </div>
          ) : null}

          <p className="source-viewer__note muted">
            Sources are shown as submitted. Time Machine hosts no video itself.
          </p>
        </div>
      )}
      {links.length > 0 ? (
        <ul className="source-list source-list--extra">
          {links.map((s, i) => (
            <li key={i} className="source-item"><LinkRow source={s} /></li>
          ))}
        </ul>
      ) : null}
    </MetadataSection>
  );
}
