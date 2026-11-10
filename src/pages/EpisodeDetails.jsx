import { useSearchParams } from 'react-router-dom';
import EpisodeView from '@/components/episode/EpisodeView.jsx';
import LegacyEpisodeView from '@/components/episode/LegacyEpisodeView.jsx';

/**
 * Episode detail routes to the redesigned episode view (default) or the
 * classic pre-redesign layout when the URL carries
 * ?legacyEpisodeView=true. Both views share the same data layer, actions,
 * permissions and ?segment=N deep links — only the presentation differs.
 */
export default function EpisodeDetails({ seriesId }) {
  const [params] = useSearchParams();
  if (params.get('legacyEpisodeView') === 'true') {
    return <LegacyEpisodeView seriesId={seriesId} />;
  }
  return <EpisodeView seriesId={seriesId} />;
}
