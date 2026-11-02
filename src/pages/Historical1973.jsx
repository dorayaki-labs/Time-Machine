import { Link } from 'react-router-dom';
import CatalogBrowser from '@/components/CatalogBrowser.jsx';
import Icon from '@/components/Icon.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';

export default function Historical1973() {
  useDocumentTitle('Anime (1973)');
  return (
    <CatalogBrowser
      seriesId="anime-1973"
      before={
        <div className="notice notice--historical" role="note">
          <Icon name="archive" size={18} />
          <div>
            <strong>An archival section.</strong> The 1973 adaptation is largely lost media, so it is kept
            separately from the three main catalogues. Every entry carries its preservation status:
            survives, partially survives, or lost. <Link to="/contribute">Recovered material is welcome.</Link>
          </div>
        </div>
      }
    />
  );
}
