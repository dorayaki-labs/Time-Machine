// Manga: a Coming Soon page. The section is real architecture (route, nav
// entry, footer link) but no catalogue yet — an honest, polished placeholder
// instead of empty grids or fake data. When manga records arrive, this page
// becomes the same CatalogBrowser the other sections use, and the nav item
// drops its `soon` marker.

import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import Placeholder from '@/components/Placeholder.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';

export default function Manga() {
  useDocumentTitle('Manga (coming soon)');
  return (
    <PageContainer className="manga-soon" narrow>
      <header className="page-opening">
        <p className="eyebrow">Manga</p>
        <h1>Coming Soon!</h1>
        <p className="page-opening__lead">
          The manga archive is being built: volumes, chapters, and the stories
          that started it all in 1969. It will live here, alongside the anime
          and movie catalogues, documented by the same community.
        </p>
      </header>

      <div className="manga-soon__art" aria-hidden="true">
        <Placeholder kind="book" />
      </div>

      <div className="manga-soon__actions btn-row">
        <Link to="/contribute" className="btn btn--primary">Help us prepare</Link>
        <Link to="/anime/1979" className="btn btn--ghost">Browse the anime meanwhile</Link>
      </div>
    </PageContainer>
  );
}
