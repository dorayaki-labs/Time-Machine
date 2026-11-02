import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';

const SECTIONS = [
  {
    id: 'worth-preserving',
    title: 'A franchise worth preserving',
    body: [
      'Doraemon has been broadcast since 1973, across three television series, more than forty theatrical films, and thousands of stories. It is one of the most watched animated franchises on Earth.',
      'Yet finding and exploring its history is surprisingly difficult. Its content is scattered across databases, fan sites, and regional releases, many of them incomplete or out of date, and the earliest series has already partially disappeared.',
      'Time Machine exists to document what is known, organize what can be found, and keep the archive easy to explore and to contribute to.',
    ],
  },
  {
    id: 'disappearing',
    title: 'Preventing history from disappearing',
    body: [
      'The original 1973 anime is the warning. Of its 52 stories, only a fraction survive today, and much of what remains does so in fragments.',
      'The historical section of this archive tracks the preservation status of every 1973 story: what survives, what survives only in part, and what is still lost.',
      'The same care is applied to everything else in the archive. Broadcast dates, titles, and credits are recorded with their sources, so the record stays checkable.',
    ],
  },
  {
    id: 'independent',
    title: 'Independent and non-commercial',
    body: [
      'Time Machine is an independent, non-commercial project maintained by the community.',
      'It is not a streaming platform. Nothing copyrighted is hosted here: the archive records facts, sources, and links to places where content can be watched legally.',
      'Doraemon, its characters, artwork, and media belong to their respective rights holders. This is an unofficial fan project with no affiliation or endorsement.',
    ],
  },
  {
    id: 'free',
    title: 'Always free',
    body: [
      'The archive is completely free to use, and it always will be.',
      'There is no subscription, no paid tier, and no advertising. The goal is simply to make Doraemon\'s history accessible to anyone who wants to explore it.',
    ],
  },
  {
    id: 'community',
    title: 'Community preservation',
    body: [
      'An archive of this size cannot be completed by one person alone.',
      'People help by documenting episodes, verifying titles and broadcast dates, writing synopses, identifying characters and gadgets, and submitting legal viewing sources.',
      'Contributions go through the site: sign in with Discord, fill in a form, and a checker reviews it before anything is published. You can follow every submission — accepted, declined, pending — in your own contribution history.',
      'Every checked contribution makes the archive a little more complete, and every accepted one appears in the public contribution log and on the Statistics page.',
    ],
  },
];

export default function About() {
  useDocumentTitle('About');
  return (
    <PageContainer className="about" narrow>
      <header className="about__hero">
        <p className="eyebrow">About the project</p>
        <h1>Why Time Machine exists.</h1>
      </header>

      <div className="about__body">
        {SECTIONS.map((s) => (
          <section key={s.id} className="about-section" aria-labelledby={`${s.id}-t`}>
            <h2 id={`${s.id}-t`}>{s.title}</h2>
            <div className="about-section__text">{s.body.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
          </section>
        ))}

        <section className="about-closing" aria-label="Closing statement">
          <p className="about-closing__line">Stories shouldn't disappear simply because they're difficult to find.</p>
          <p className="about-closing__line about-closing__line--strong">Let's keep them in time.</p>
          <div className="btn-row">
            <Link to="/contribute" className="btn btn--primary">Help build the archive</Link>
            <Link to="/historical/1973" className="btn btn--ghost">Browse the 1973 archive</Link>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
