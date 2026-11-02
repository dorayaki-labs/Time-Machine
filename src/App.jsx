import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import SearchOverlay from '@/components/SearchOverlay.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import PageContainer from '@/components/PageContainer.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import { SearchProvider } from '@/hooks/SearchContext.jsx';
import { AuthProvider } from '@/hooks/useAuth.jsx';
import { CatalogProvider, useCatalog } from '@/hooks/useCatalog.jsx';
import Home from '@/pages/Home.jsx';
import Anime1979 from '@/pages/Anime1979.jsx';
import Anime2005 from '@/pages/Anime2005.jsx';
import Movies from '@/pages/Movies.jsx';
import Historical1973 from '@/pages/Historical1973.jsx';
import EpisodeDetails from '@/pages/EpisodeDetails.jsx';
import MovieDetails from '@/pages/MovieDetails.jsx';
import Characters from '@/pages/Characters.jsx';
import CharacterDetails from '@/pages/CharacterDetails.jsx';
import Gadgets from '@/pages/Gadgets.jsx';
import GadgetDetails from '@/pages/GadgetDetails.jsx';
import Search from '@/pages/Search.jsx';
import About from '@/pages/About.jsx';
import Contribute from '@/pages/Contribute.jsx';
import Statistics from '@/pages/Statistics.jsx';
import ContributionLog from '@/pages/ContributionLog.jsx';
import Account from '@/pages/Account.jsx';
import Staff from '@/pages/Staff.jsx';
import NotFound from '@/pages/NotFound.jsx';

// Pages are imported eagerly, not code-split: the whole app is small, and a
// single bundle makes every navigation instantaneous — no chunk request, no
// Suspense flicker on first visit to a page.

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// Old links pointed at /anime/1973/... before the 1973 series moved to the historical section.
function MoveToHistorical() {
  const { id } = useParams();
  return <Navigate to={id ? `/historical/1973/${id}` : '/historical/1973'} replace />;
}

function Routed() {
  const { pathname } = useLocation();
  return (
    <main
      id="main"
      className="site-main"
      key={pathname.split('/').slice(0, 2).join('/')}
      tabIndex={-1}
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/anime/1979" element={<Anime1979 />} />
        <Route path="/anime/2005" element={<Anime2005 />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/historical/1973" element={<Historical1973 />} />
        <Route path="/anime/1973" element={<MoveToHistorical />} />
        <Route path="/anime/1979/:id" element={<EpisodeDetails seriesId="anime-1979" />} />
        <Route path="/anime/2005/:id" element={<EpisodeDetails seriesId="anime-2005" />} />
        <Route path="/historical/1973/:id" element={<EpisodeDetails seriesId="anime-1973" />} />
        <Route path="/anime/1973/:id" element={<MoveToHistorical />} />
        <Route path="/movies/:id" element={<MovieDetails />} />
        <Route path="/characters" element={<Characters />} />
        <Route path="/characters/:id" element={<CharacterDetails />} />
        <Route path="/gadgets" element={<Gadgets />} />
        <Route path="/gadgets/:id" element={<GadgetDetails />} />
        <Route path="/search" element={<Search />} />
        <Route path="/about" element={<About />} />
        <Route path="/contribute" element={<Contribute />} />
        <Route path="/stats" element={<Statistics />} />
        <Route path="/log" element={<ContributionLog />} />
        <Route path="/account" element={<Account />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  );
}

function RoutedWithCatalog() {
  const { ready, error } = useCatalog();
  if (error) {
    return (
      <main id="main" className="site-main">
        <PageContainer>
          <div className="empty-state" role="alert">
            <span className="empty-state__icon" aria-hidden="true">!</span>
            <h1>The archive could not be loaded</h1>
            <p>The catalogue data did not arrive. Refresh the page to try again.</p>
          </div>
        </PageContainer>
      </main>
    );
  }
  if (!ready) {
    return (
      <main id="main" className="site-main">
        <PageContainer><LoadingState label="Loading the archive…" /></PageContainer>
      </main>
    );
  }
  return <Routed />;
}

export default function App() {
  return (
    <AuthProvider>
    <CatalogProvider>
      <SearchProvider>
        <a href="#main" className="skip-link">Skip to content</a>
        <Header />
        <ScrollToTop />
        <ErrorBoundary>
          <RoutedWithCatalog />
        </ErrorBoundary>
        <Footer />
        <SearchOverlay />
      </SearchProvider>
    </CatalogProvider>
    </AuthProvider>
  );
}
