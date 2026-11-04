import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import ContributionForm from '@/components/ContributionForm.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import Icon from '@/components/Icon.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { CONTRIBUTION_CATEGORIES } from '@/lib/contributionForms.js';

const CATEGORY_ICONS = {
  'missing-entry': 'archive',
  'metadata-correction': 'check',
  character: 'user',
  gadget: 'gadget',
  images: 'film',
  source: 'play',
  'broken-source': 'alert',
};

/* The three things people most often want to do, one click from the top. */
const QUICK_START = [
  { id: 'source', icon: 'play', title: 'Add a place to watch', text: 'Paste a video file link or an embed for any episode or movie, with its language, subtitles, and quality.' },
  { id: 'broken-source', icon: 'alert', title: 'Report a broken source', text: 'A video will not play, was removed, or is the wrong one? Point us at it and we will take it down.' },
  { id: 'metadata-correction', icon: 'check', title: 'Fix a wrong detail', text: 'A title, date, or other fact looks off? Send the correction — a reference backing it helps a lot.' },
];

const STEPS = [
  ['Pick a form', 'Each one covers one kind of contribution and takes a couple of minutes.'],
  ['Sign in with Discord', 'Contributions are tied to an account so we can credit you and follow up. It needs only one click.'],
  ['Fill in the form', 'Dates, entry IDs, and links are checked as you go, so mistakes are caught early.'],
  ['A checker reviews it', 'A human verifies the submission against its sources. You can follow the status in “My contributions”.'],
];

/* Detail pages deep-link here with ?entry=<id>; put it in the field the
   selected form actually uses. */
function prefillEntry(categoryId, entryId) {
  const value = String(entryId ?? '').trim();
  if (!value) return null;
  if (categoryId === 'character') return { characterId: value };
  if (categoryId === 'gadget') return { gadgetId: value };
  return { entryId: value };
}

export default function Contribute() {
  useDocumentTitle('Contribute');
  const [params, setParams] = useSearchParams();
  const requested = params.get('category');
  const entry = params.get('entry');
  const [active, setActive] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (requested && CONTRIBUTION_CATEGORIES.some((c) => c.id === requested)) setActive(requested);
  }, [requested]);

  const current = CONTRIBUTION_CATEGORIES.find((c) => c.id === active) ?? null;

  // Deep links from detail pages (?entry=...) prefill the right id field so
  // the contributor does not have to look it up.
  const initialValues = current && entry ? prefillEntry(current.id, entry) : null;

  const choose = (id) => {
    const next = active === id ? null : id;
    setActive(next);
    setParams(next ? { category: next } : {}, { replace: true });
  };

  // Opening a form brings it into view, so the click feels answered.
  useEffect(() => {
    if (current && formRef.current && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PageContainer className="contribute" narrow>
      <header className="page-head">
        <p className="eyebrow">Contribute</p>
        <h1>Help build the archive.</h1>
        <p className="page-head__lead">
          Found a video, spotted a mistake, or know an episode we are missing? The fastest route is
          the <strong>Edit this entry</strong> button on any episode, movie, character or gadget
          page — it opens the record with your changes ready for a checker to accept in one click.
          The forms below cover everything else.
        </p>
        <ul className="contribute-assurances" aria-label="What contributing involves">
          <li><Icon name="check" size={14} /> Discord sign-in</li>
          <li><Icon name="check" size={14} /> Nothing is published without review</li>
          <li><Icon name="check" size={14} /> A person checks every submission</li>
          <li><Icon name="check" size={14} /> Follow your submission in “My contributions”</li>
        </ul>
      </header>

      <div className="notice contribute-direct-hint">
        <strong>Tip:</strong> to fix a detail on an existing episode, movie, character or gadget,
        open its page and press <em>Edit this entry</em> — you edit the actual record and a checker
        accepts it in one click. No form needed.
      </div>

      <section className="contribute-quick" aria-label="Common contributions">
        {QUICK_START.map((q) => (
          <button
            key={q.id}
            type="button"
            className={`quick-card${active === q.id ? ' is-active' : ''}`}
            onClick={() => choose(q.id)}
            aria-expanded={active === q.id}
          >
            <span className="quick-card__icon"><Icon name={q.icon} size={20} /></span>
            <span className="quick-card__body">
              <span className="quick-card__title">{q.title}</span>
              <span className="quick-card__text">{q.text}</span>
            </span>
            <Icon name="chevronDown" size={16} className="quick-card__chev" />
          </button>
        ))}
      </section>

      <section className="contribute-steps" aria-label="How contributing works">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="step">
              <span className="step__num mono">{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="contribute-forms" aria-label="All contribution forms" ref={formRef}>
        <h2>All forms</h2>
        <ul className="form-picker">
          {CONTRIBUTION_CATEGORIES.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`form-picker__item${active === c.id ? ' is-active' : ''}`}
                onClick={() => choose(c.id)}
                aria-expanded={active === c.id}
              >
                <span className="form-picker__icon"><Icon name={CATEGORY_ICONS[c.id] ?? 'archive'} size={18} /></span>
                <span className="form-picker__body">
                  <span className="form-picker__label">{c.label}</span>
                  <span className="form-picker__summary">{c.summary}</span>
                </span>
                <Icon name={active === c.id ? 'chevronDown' : 'chevronRight'} size={16} className="form-picker__chev" />
              </button>
            </li>
          ))}
        </ul>
        {current ? (
          <div className="contribute-form-wrap">
            <h3><Icon name={CATEGORY_ICONS[current.id] ?? 'archive'} size={18} /> {current.label}</h3>
            <p className="muted contribute-form-wrap__intro">{current.summary}</p>
            <ContributionForm key={`${current.id}-${entry ?? ''}`} category={current} initialValues={initialValues} />
          </div>
        ) : (
          <p className="muted">Choose the kind of contribution you want to make, and its form will open right here.</p>
        )}
      </section>
    </PageContainer>
  );
}
