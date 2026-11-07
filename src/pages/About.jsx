// About. Written as an editorial page: a short lead, then numbered
// chapters with the heading beside the text, not a wall of identical cards.

import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { DOOR_ART } from '@/config.js';

const CHAPTERS = [
  {
    id: 'idea',
    kicker: 'The idea',
    title: 'Why this exists',
    body: [
      'Doraemon has been on the air almost continuously since 1979 — two television series, forty-plus theatrical films, thousands of individual stories. Few cartoons can match that. Now try looking up one episode’s original broadcast date.',
      'The information is out there, but it is scattered across databases, fan wikis and regional releases, much of it incomplete or contradicting itself. Time Machine gathers it in one place: what is known, where it came from, and where you can watch it.',
    ],
  },
  {
    id: 'lost',
    kicker: 'Why it matters',
    title: 'The 1973 series',
    body: [
      'The first Doraemon anime, from 1973, is the cautionary tale. Of its 52 stories only a fraction survives today, most of that in fragments. When something drops out of circulation for that long, it tends to stay lost.',
      'That series gets its own historical section here, tracking story by story what survives, what survives only in part, and what is gone. Everything else gets the same care: broadcast dates, titles and credits are recorded with their sources, so the record stays checkable.',
    ],
  },
  {
    id: 'rules',
    kicker: 'The rules',
    title: 'What this is',
    body: [
      'An archive, not a streaming site. Nothing copyrighted is hosted here — the archive records facts and sources, and links to places where something can legally be watched. No ads, no subscriptions, no account needed to browse.',
      'It is also an unofficial fan project. Doraemon, its characters and artwork belong to their rights holders; there is no affiliation or endorsement, and there never will be.',
    ],
  },
  {
    id: 'contributions',
    kicker: 'Contributions',
    title: 'How it grows',
    body: [
      'Most of what fills the gaps comes from the community. People document episodes, verify titles and broadcast dates, write synopses, identify characters and gadgets, and submit viewing sources.',
      // eslint-disable-next-line react/jsx-key -- keyed by index in the map below
      <>Sign in with Discord, fill in a form — or press <em>Edit this entry</em> on any page — and a checker looks at it before anything is published. You can follow each of your submissions, pending or decided, in your own contribution history. Accepted changes land in the public log and on the statistics page.</>,
    ],
  },
  {
    id: 'open',
    kicker: 'The records',
    title: 'Open by design',
    body: [
      'The whole archive lives in a public GitHub repository. Every episode file, every correction, every review decision is visible in the commit history — nothing happens behind a curtain. Anyone can check where a piece of information came from, and anyone can propose a better version of it.',
    ],
  },
];

export default function About() {
  useDocumentTitle('About');
  return (
    <PageContainer className="about">
      <header className="about__hero">
        <div className="about__intro">
          <p className="eyebrow">About the project</p>
          <h1>Why Time Machine exists.</h1>
          <p className="about__lead">
            A community-maintained record of the whole Doraemon franchise — episodes, movies,
            characters, gadgets — free to browse and open to anyone who wants to help.
          </p>
          <ul className="about__facts" aria-label="The archive at a glance">
            <li><strong>3</strong><span>TV series covered</span></li>
            <li><strong>40+</strong><span>theatrical films</span></li>
            <li><strong>1973</strong><span>preservation tracking</span></li>
          </ul>
        </div>
        <img className="about__art" src={DOOR_ART} alt="" width="260" height="260" loading="lazy" />
      </header>

      <div className="about__chapters">
        {CHAPTERS.map((chapter, i) => (
          <section key={chapter.id} className="about-chapter" aria-labelledby={`${chapter.id}-t`}>
            <div className="about-chapter__side">
              <span className="about-chapter__num mono" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <span className="about-chapter__kicker">{chapter.kicker}</span>
            </div>
            <div className="about-chapter__body">
              <h2 id={`${chapter.id}-t`}>{chapter.title}</h2>
              {chapter.body.map((paragraph, j) => <p key={j}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>

      <section className="about-closing" aria-label="Closing statement">
        <p className="about-closing__line">Stories shouldn’t disappear just because they’re hard to find.</p>
        <p className="about-closing__line about-closing__line--strong">Let’s keep them in time.</p>
        <div className="btn-row about-closing__actions">
          <Link to="/contribute" className="btn btn--primary">Help build the archive</Link>
          <Link to="/credits" className="btn btn--ghost">Credits</Link>
          <Link to="/historical/1973" className="btn btn--ghost">Browse the 1973 archive</Link>
        </div>
      </section>
    </PageContainer>
  );
}
