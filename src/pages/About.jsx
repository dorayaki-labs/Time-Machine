import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import Icon from '@/components/Icon.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { DOOR_ART } from '@/config.js';

const SECTIONS = [
  {
    id: 'worth-preserving',
    icon: 'film',
    title: 'A franchise worth preserving',
    body: [
      'Doraemon has been broadcast since 1979, across two long-running television series, more than forty theatrical films, and thousands of stories. It is one of the most watched animated franchises on Earth.',
      'Yet finding and exploring its history is surprisingly difficult. Its content is scattered across databases, fan sites, and regional releases, many of them incomplete or out of date.',
      'Time Machine exists to document what is known, organize what can be found, and keep the archive easy to explore and to contribute to.',
    ],
  },
  {
    id: 'disappearing',
    icon: 'alert',
    title: 'Preventing history from disappearing',
    body: [
      'The original 1973 anime is the warning. Of its 52 stories, only a fraction survive today, and much of what remains does so in fragments.',
      'The historical section of this archive tracks the preservation status of every 1973 story: what survives, what survives only in part, and what is still lost.',
      'The same care is applied to everything else in the archive. Broadcast dates, titles, and credits are recorded with their sources, so the record stays checkable.',
    ],
  },
  {
    id: 'independent',
    icon: 'check',
    title: 'Independent and non-commercial',
    body: [
      'Time Machine is an independent, non-commercial project maintained by the community.',
      'It is not a streaming platform. Nothing copyrighted is hosted here: the archive records facts, sources, and links to places where content can be watched.',
      'Doraemon, its characters, artwork, and media belong to their respective rights holders. This is an unofficial fan project with no affiliation or endorsement.',
    ],
  },
  {
    id: 'free',
    icon: 'play',
    title: 'Always free',
    body: [
      'The archive is completely free to use, and it always will be.',
      'There is no subscription, no paid tier, and no advertising. The goal is simply to make Doraemon\'s history accessible to anyone who wants to explore it.',
    ],
  },
  {
    id: 'community',
    icon: 'user',
    title: 'Community preservation',
    body: [
      'An archive of this size cannot be completed by one person alone.',
      'People help by documenting episodes, verifying titles and broadcast dates, writing synopses, identifying characters and gadgets, and submitting viewing sources.',
      'Contributions go through the site: sign in with Discord, fill in a form, and a checker reviews it before anything is published. You can follow every submission — accepted, declined, pending — in your own contribution history.',
      'Every checked contribution makes the archive a little more complete, and every accepted one appears in the public contribution log and on the Statistics page.',
    ],
  },
  {
    id: 'open-data',
    icon: 'archive',
    title: 'Open by design',
    body: [
      'The entire archive lives in a public GitHub repository. Every episode file, every correction, and every review decision is visible in the commit history — nothing happens behind a curtain.',
      'That openness is also what keeps the record honest: anyone can check where a piece of information came from, and anyone can propose a better version of it.',
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
          <p className="page-opening__lead">
            A free, community-maintained archive of the Doraemon franchise — every episode, movie,
            character, and gadget, documented carefully and checked by people who care about it.
          </p>
          <ul className="about__facts" aria-label="The archive at a glance">
            <li><strong>3</strong><span>TV series covered</span></li>
            <li><strong>40+</strong><span>theatrical films</span></li>
            <li><strong>1973</strong><span>preservation tracking</span></li>
          </ul>
        </div>
        <img className="about__art" src={DOOR_ART} alt="" width="260" height="260" loading="lazy" />
      </header>

      <div className="about__grid">
        {SECTIONS.map((s) => (
          <section key={s.id} className="about-card" aria-labelledby={`${s.id}-t`}>
            <span className="about-card__icon"><Icon name={s.icon} size={20} /></span>
            <h2 id={`${s.id}-t`}>{s.title}</h2>
            <div className="about-card__text">{s.body.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
          </section>
        ))}
      </div>

      <section className="about-closing" aria-label="Closing statement">
        <p className="about-closing__line">Stories shouldn't disappear simply because they're difficult to find.</p>
        <p className="about-closing__line about-closing__line--strong">Let's keep them in time.</p>
        <div className="btn-row about-closing__actions">
          <Link to="/contribute" className="btn btn--primary">Help build the archive</Link>
          <Link to="/log" className="btn btn--ghost">See recent contributions</Link>
          <Link to="/historical/1973" className="btn btn--ghost">Browse the 1973 archive</Link>
        </div>
      </section>
    </PageContainer>
  );
}
