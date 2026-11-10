// SECTION 01 — Episode header. The most prominent section: a large segment
// cover on the left; on the right the series/episode line with a segment-count
// pill, the active segment's title, the episode's combined segment titles, and
// a compact metadata table. The cover, title, segment row and record ID all
// follow the selected segment; the rest of the table is episode-level.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import MediaImage from '../MediaImage.jsx';
import { displayTitle, segmentTitle } from '@/lib/catalog.js';
import { formatRelease } from '@/lib/dates.js';
import { languageName, preservationLabel } from '@/lib/catalog.js';

function CopyId({ value }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable — the id stays selectable text */ }
  };
  return (
    <span className="ev-copy">
      <span className="mono">{value}</span>
      <button type="button" className="ev-copy__btn" onClick={copy}
        aria-label={`Copy record ID ${value}`}>
        <Icon name={copied ? 'check' : 'copy'} size={13} />
        {copied ? <span className="ev-copy__done">Copied</span> : null}
      </button>
    </span>
  );
}

export default function EpisodeHeader({ record, series, segment, segmentIndex, multi, entry }) {
  const pad = (n) => String(n).padStart(3, '0');
  const segmentCount = record.segments?.length ?? 1;
  const number = segment?.segmentNumber ?? segmentIndex + 1;
  return (
    <header className="ev-header" id="episode-top">
      <div className="ev-header__media">
        <MediaImage
          kind="episode"
          seed={segment?.id ?? record.id}
          src={segment?.image?.url ?? null}
          alt={segment?.image?.alt ?? ''}
          label={`EP ${pad(record.number)}`}
          priority
        />
      </div>
      <div className="ev-header__body">
        <p className="eyebrow">
          <span>{series.label} · Episode {record.number}</span>
          <span className="chip chip--mono ev-pill" title="Segments broadcast in this episode">
            {segmentCount} {segmentCount === 1 ? 'Segment' : 'Segments'}
          </span>
        </p>
        <h1 className="ev-header__title">
          {multi ? segmentTitle(entry, segmentIndex) : displayTitle(entry)}
        </h1>
        {multi ? (
          <p className="ev-header__combined muted">{displayTitle(entry)}</p>
        ) : (
          segment?.title?.ja && segment.title.en && segment.title.ja !== segment.title.en
            ? <p className="detail-head__ja" lang="ja">{segment.title.ja}</p>
            : null
        )}

        <dl className="facts ev-facts">
          <div>
            <dt>Series</dt>
            <dd><Link to={series.basePath}>{series.label}</Link></dd>
          </div>
          <div>
            <dt>Episode number</dt>
            <dd><span className="mono">{record.number}</span></dd>
          </div>
          {multi ? (
            <div>
              <dt>Segment</dt>
              <dd><span className="mono">{number} of {segmentCount}</span></dd>
            </div>
          ) : null}
          <div>
            <dt>Broadcast date</dt>
            <dd>{record.release?.date
              ? <>{formatRelease(record.release)}{record.release.precision && record.release.precision !== 'day'
                ? <span className="muted"> ({record.release.precision} only)</span> : null}</>
              : null}</dd>
          </div>
          <div>
            <dt>Original language</dt>
            <dd>{languageName(record.originalLanguage ?? 'ja')}</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>{record.release?.region ?? null}</dd>
          </div>
          <div>
            <dt>Preservation</dt>
            <dd>{record.preservation ? preservationLabel(record.preservation) : null}</dd>
          </div>
          <div>
            <dt>Record ID</dt>
            <dd><CopyId value={segment?.id ?? record.id} /></dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
