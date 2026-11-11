import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import CharacterCard from '@/components/CharacterCard.jsx';
import GadgetCard from '@/components/GadgetCard.jsx';
import Icon from '@/components/Icon.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { getCharacters, getGadgets, getRecentlyAdded, getSeries, SERIES_IDS } from '@/lib/catalog.js';
import { getArchiveStats } from '@/lib/statistics.js';
import { fetchPublicLog, fetchPublicEdits } from '@/lib/stats.js';
import { useAuth } from '@/hooks/useAuth.jsx';
import { SUBMISSION_EVENT, EDIT_EVENT, entryPath } from '@/lib/activity.js';
import { DOOR_ART } from '@/config.js';
import { randomMenuImage, randomSlogan } from '@/lib/menuContent.js';

// Both picks are made once per page load, at module scope — a re-render can
// never re-roll them, and every render of this session shows the same pair.
const HERO_ART = randomMenuImage();
const HERO_SLOGAN = randomSlogan();

/* The homepage feed: the latest community contributions and staff edits,
   newest first, each linking to the page it changed. Falls back to the
   "recently added" archive list whenever the backend is not configured,
   has no activity yet, or fails — the section is never empty or broken. */
function RecentContributions() {
  const { backendConfigured } = useAuth();
  const [events, setEvents] = useState(null);

  useEffect(() => {
    if (!backendConfigured) return undefined;
    let active = true;
    Promise.allSettled([fetchPublicLog({ limit: 40 }), fetchPublicEdits({ limit: 40 })])
      .then(([subs, edits]) => {
        if (!active) return;
        if (subs.status === 'rejected' && edits.status === 'rejected') {
          setEvents([]);
          return;
        }
        const merged = [
          ...(subs.status === 'fulfilled' ? subs.value ?? [] : []).map((row) => ({ key: `c-${row.number}`, at: row.reviewed_at ?? row.submitted_at, row })),
          ...(edits.status === 'fulfilled' ? edits.value ?? [] : []).map((row) => ({ key: `e-${row.id}`, at: row.created_at, row })),
        ].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
        setEvents(merged.slice(0, 10));
      });
    return () => { active = false; };
  }, [backendConfigured]);

  if (backendConfigured && events === null) {
    return <ul className="recent-list"><li className="recent-row muted">Loading recent contributions…</li></ul>;
  }
  if (!backendConfigured || (events && events.length === 0)) {
    return <ArchiveRecentList />;
  }
  return (
    <ul className="recent-list">
      {events.map(({ key, row }) => {
        if (row.id !== undefined && row.action) {
          const meta = EDIT_EVENT[row.action?.replace(/\./g, '_')] ?? { label: 'edited the archive', icon: 'edit' };
          const path = entryPath(row.entity_id);
          const body = (
            <>
              <span className="recent-row__type mono"><Icon name={meta.icon} size={13} /></span>
              <span className="recent-row__num mono">{String(row.commit_sha ?? '').slice(0, 7)}</span>
              <span className="recent-row__title">{row.editor_name ?? 'A staff member'} {meta.label} <span className="mono">{row.entity_id}</span></span>
              <span className="recent-row__catalogue" />
              <span className="recent-row__date">{new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </>
          );
          return (
            <li key={key}>
              {path ? <Link to={path} className="recent-row">{body}</Link> : <div className="recent-row">{body}</div>}
            </li>
          );
        }
        const meta = SUBMISSION_EVENT[row.status] ?? SUBMISSION_EVENT.pending;
        const path = entryPath(row.entry_id);
        const body = (
          <>
            <span className={`recent-row__type mono recent-row__type--${meta.tone}`}>{meta.label}</span>
            <span className="recent-row__num mono">#{row.number}</span>
            <span className="recent-row__title">
              {row.contributor_name ?? 'A community member'}: {row.title}
            </span>
            <span className="recent-row__catalogue">{row.reviewer_name && row.status === 'accepted' ? `accepted by ${row.reviewer_name}` : ''}</span>
            <span className="recent-row__date">{new Date(row.at ?? row.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </>
        );
        return (
          <li key={key}>
            {path ? <Link to={path} className="recent-row">{body}</Link> : <div className="recent-row">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/* Fallback feed for archive-only mode: the newest records in the catalogues. */
function ArchiveRecentList() {
  const recent = getRecentlyAdded(10);
  return (
    <ul className="recent-list">
      {recent.map((e) => (
        <li key={e.id}>
          <Link to={e.url} className="recent-row">
            <span className={`recent-row__type mono${e.kind === 'movie' ? ' recent-row__type--movie' : ''}`}>
              {e.kind === 'movie' ? 'Film' : 'Ep'}
            </span>
            <span className="recent-row__num mono">{e.kind === 'movie' ? `No.${e.number}` : `#${e.number}`}</span>
            <span className="recent-row__title">{e.title.en || <span lang="ja">{e.title.ja}</span>}</span>
            <span className="recent-row__date">{e.release?.date ?? ''}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* The hero illustration. A picked image from the menu-images rotation, with
   the standing door art as the fallback when the rotation is empty or the
   file fails to load — the hero is never a broken-image icon. */
function HeroArt({ src }) {
  const [failed, setFailed] = useState(false);
  const url = failed || !src ? DOOR_ART : src;
  return (
    <img
      src={url}
      alt=""
      width="380"
      height="611"
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export default function Home() {
  useDocumentTitle();
  const stats = getArchiveStats();
  const characters = getCharacters().slice(0, 4);
  const gadgets = getGadgets().slice(0, 4);

  return (
    <>
      <section className="hero">
        <PageContainer className="hero__inner">
          <div className="hero__copy">
            <p className="eyebrow">The Doraemon community archive</p>
            <h1 className="hero__slogan">{HERO_SLOGAN}</h1>
            <p className="hero__lead">
              A free, open record of the Doraemon franchise, kept by the people who use it.
              {' '}{stats.episodes + stats.movies} entries and counting.
            </p>
            <div className="btn-row">
              <Link to="/anime/1979" className="btn btn--primary">Browse the archive <Icon name="arrowRight" size={16} /></Link>
              <Link to="/about" className="btn btn--ghost">About the project</Link>
            </div>
          </div>
          <div className="hero__art" aria-hidden="true">
            {/* The rotation from public/menu images/ when it has images; the
                standing door artwork when it does not (empty rotation, or the
                picked file fails to load). */}
            <HeroArt src={HERO_ART} />
          </div>
        </PageContainer>
      </section>

      <PageContainer className="home-section" as="section" id="archives">
        <header className="section-head">
          <h2>The catalogues</h2>
          <p>Start anywhere — everything links together.</p>
        </header>
        <ul className="catalogue-index">
          {SERIES_IDS.map((id) => {
            const series = getSeries(id);
            return (
              <li key={id}>
                <Link to={series.basePath} className="catalogue-row">
                  <span className="catalogue-row__label">{series.label}</span>
                  <span className="catalogue-row__desc">{series.description.split('. ')[0]}.</span>
                  <span className="catalogue-row__count mono">{series.entries.length}</span>
                  <Icon name="arrowRight" size={18} className="catalogue-row__arrow" />
                </Link>
              </li>
            );
          })}
        </ul>
      </PageContainer>

      <PageContainer className="home-section" as="section">
        <header className="section-head section-head--row">
          <div>
            <h2>Recent contributions</h2>
            <p>What the community changed lately — every row opens the page it touched.</p>
          </div>
          <Link to="/log" className="btn btn--ghost btn--sm">Full contribution log</Link>
        </header>
        <RecentContributions />
      </PageContainer>

      <PageContainer className="home-section" as="section">
        <header className="section-head"><h2>Explore the archive</h2></header>
        <div className="explore-grid">
          <div className="explore-block">
            <div className="explore-block__head"><h3>Characters</h3><Link to="/characters" className="text-link">Browse all {stats.characters}</Link></div>
            <div className="grid grid--compact">{characters.map((c) => <CharacterCard key={c.id} character={c} compact />)}</div>
          </div>
          <div className="explore-block">
            <div className="explore-block__head"><h3>Gadgets</h3><Link to="/gadgets" className="text-link">Browse all {stats.gadgets}</Link></div>
            <div className="grid grid--compact">{gadgets.map((g) => <GadgetCard key={g.id} gadget={g} compact />)}</div>
          </div>
        </div>
      </PageContainer>

      <PageContainer className="home-section" as="section">
        <div className="contribute-strip">
          <div>
            <h2>Help fill the gaps</h2>
            <p>Episode synopses, verified English titles, images with alt text, and community-submitted viewing sources are the archive's biggest needs right now.</p>
          </div>
          <div className="btn-row">
            <Link to="/contribute" className="btn btn--primary">Contribute</Link>
            <Link to="/historical/1973" className="btn btn--ghost">See the lost 1973 series</Link>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
