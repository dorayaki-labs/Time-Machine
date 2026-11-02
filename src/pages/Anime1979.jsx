import CatalogBrowser from '@/components/CatalogBrowser.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';

export default function Anime1979() {
  useDocumentTitle('Anime (1979)');
  return <CatalogBrowser seriesId="anime-1979" />;
}
