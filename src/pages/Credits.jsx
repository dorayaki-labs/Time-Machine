// Credits. Short and honest: who made this, who keeps it running, and the
// reference library the archive leans on.

import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';

const DORAEMON_WIKI = 'https://doraemon.fandom.com/';

export default function Credits() {
  useDocumentTitle('Credits');
  return (
    <PageContainer className="credits" narrow>
      <header className="page-opening">
        <p className="eyebrow">Credits</p>
        <h1>Who made this.</h1>
        <p className="page-opening__lead">
          Time Machine is a fan project, kept alive by a handful of people and a
          lot of community contributions. <Link to="/contribute" className="text-link">Add yours</Link>.
        </p>
      </header>

      <section className="credits-card" aria-label="Creator and owner">
        <div>
          <p className="credits-card__role">Creator &amp; owner</p>
          <h2 className="credits-card__name">piesimp</h2>
          <p className="credits-card__text">
            Started the archive, built the site, and still reviews most of what goes into it.
          </p>
        </div>
      </section>

      {/* The golden bar: deliberately longer and louder than everything else
          on the page — sneykk's help earned it. */}
      <section className="credits-gold" aria-label="Special thanks">
        <p className="credits-gold__role">Special thanks</p>
        <h2 className="credits-gold__name">sneykk</h2>
        <p className="credits-gold__text">
          Donated the domain this site lives on, and has helped out with development
          at every step along the way. Time Machine would not be what it is without him.
        </p>
      </section>

      <section className="credits-card" aria-label="The Doraemon Wiki">
        <div>
          <p className="credits-card__role">Reference &amp; gratitude</p>
          <h2 className="credits-card__name">Everyone at the <a href={DORAEMON_WIKI} target="_blank" rel="noreferrer noopener">Doraemon Wiki</a></h2>
          <p className="credits-card__text">
            Their episode guides and release data are a reference this archive leans on constantly.
            If you find Time Machine useful, pay them a visit too.
          </p>
        </div>
      </section>

      <p className="credits-legal">
        Doraemon and everything in it belongs to Fujiko-Pro, Shogakukan, and the other rights holders;
        this archive claims no ownership. <Link to="/about">The full disclaimer lives on the About page.</Link>
      </p>
    </PageContainer>
  );
}
