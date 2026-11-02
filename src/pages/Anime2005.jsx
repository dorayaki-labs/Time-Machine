import CatalogBrowser from '@/components/CatalogBrowser.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';

export default function Anime2005() {
  useDocumentTitle('Anime (2005)');
  return <CatalogBrowser seriesId="anime-2005" />;
}
