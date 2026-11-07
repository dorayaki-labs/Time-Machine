// The studio's live preview. It renders real Time Machine components with
// their real classes, so the tokens shown here are exactly the ones the live
// site is using — the whole site updates behind the studio anyway; this
// panel just gathers the important pieces in one place. All content is
// preview-only; nothing here touches the archive or the backend.

import Icon from '../Icon.jsx';

const SAMPLE_CARD = {
  number: 1234,
  title: 'The Time Machine Blues',
  ja: 'タイムマシンでぶん回そう',
  meta: '1979 · 10 min',
};

export default function StudioPreview() {
  return (
    <div className="studio-preview" aria-label="Live preview of the current settings">
      <p className="studio-preview__note">
        <Icon name="check" size={13} /> Applied to the site as you edit — nothing is kept until you save.
      </p>

      {/* Navigation specimen */}
      <div className="studio-spec">
        <p className="studio-spec__name">Navigation</p>
        <div className="studio-preview__bar">
          <span className="studio-preview__brand mono">TIME MACHINE</span>
          <nav className="studio-preview__nav" aria-hidden="true">
            <span className="is-active">Movies</span>
            <span>Characters</span>
            <span>Gadgets</span>
          </nav>
          <span className="studio-preview__icons" aria-hidden="true">
            <Icon name="palette" size={15} />
            <Icon name="search" size={15} />
          </span>
        </div>
      </div>

      {/* Typography specimen */}
      <div className="studio-spec">
        <p className="studio-spec__name">Typography</p>
        <strong className="studio-preview__h">Nobita’s Dinosaur</strong>
        <p className="studio-preview__p">
          Nobita digs up a fossil egg and hatches it, raising a plesiosaur he names Pisuke. When Pisuke grows too
          big for modern Tokyo, the gang takes him back to the Cretaceous.
        </p>
        <p className="studio-preview__meta mono">1980-03-15 · 92 min · Fukumoto Seitarō</p>
      </div>

      {/* Buttons & inputs specimen */}
      <div className="studio-spec">
        <p className="studio-spec__name">Buttons &amp; inputs</p>
        <div className="btn-row">
          <span className="btn btn--primary">View record</span>
          <span className="btn btn--ghost">Contribute</span>
          <span className="chip chip--mono mono">#movie-0061</span>
        </div>
        <div className="field">
          <label>Search the archive</label>
          <input type="text" placeholder="Search episodes by title or number" readOnly />
        </div>
      </div>

      {/* Card specimen */}
      <div className="studio-spec">
        <p className="studio-spec__name">Catalogue card</p>
        <div className="media-card" style={{ maxWidth: '260px' }}>
          <div className="media media--episode studio-preview__art">
            <span className="media__label mono">EP {SAMPLE_CARD.number}</span>
          </div>
          <div className="media-card__body">
            <h4 className="media-card__title">{SAMPLE_CARD.title}</h4>
            <p className="media-card__subtitle" lang="ja">{SAMPLE_CARD.ja}</p>
            <p className="media-card__desc">The gang borrows a time machine to redo a disastrous day, with increasingly creative results.</p>
            <p className="media-card__meta">{SAMPLE_CARD.meta}</p>
          </div>
        </div>
      </div>

      {/* Status & notices specimen */}
      <div className="studio-spec">
        <p className="studio-spec__name">Status &amp; notices</p>
        <div className="studio-preview__row">
          <span className="status status--available"><span className="status__dot" /> Available</span>
          <span className="status status--partial"><span className="status__dot" /> Partially lost</span>
          <span className="status status--lost"><span className="status__dot" /> Lost</span>
        </div>
        <p className="notice"><Icon name="check" size={15} /> A community contribution was accepted and published.</p>
      </div>
    </div>
  );
}
