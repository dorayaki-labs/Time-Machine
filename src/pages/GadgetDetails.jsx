import { Link, useParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import MediaImage from '@/components/MediaImage.jsx';
import MetadataSection, { FactList } from '@/components/MetadataSection.jsx';
import AppearanceLists from '@/components/AppearanceLists.jsx';
import GadgetCard from '@/components/GadgetCard.jsx';
import { ReferencesSection } from '@/components/EntrySections.jsx';
import NotFound from './NotFound.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { getGadget, getEntriesForGadget, getRelatedGadgets, getEntry, displayTitle } from '@/lib/catalog.js';

export default function GadgetDetails() {
  const { id } = useParams();
  const gadget = getGadget(id);
  useDocumentTitle(gadget ? gadget.name.en : 'Gadget not found');
  if (!gadget) return <NotFound title="Gadget not found" message="That gadget is not in the archive yet." />;

  const appearances = getEntriesForGadget(gadget.id);
  const related = getRelatedGadgets(gadget.id);
  const first = gadget.firstAppearance?.entryId ? getEntry(gadget.firstAppearance.entryId) : null;

  return (
    <PageContainer className="detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/gadgets">Gadgets</Link><span aria-hidden="true">/</span><span aria-current="page">{gadget.name.en}</span>
      </nav>
      <section className="profile profile--gadget">
        <div className="profile__portrait"><MediaImage kind="gadget" seed={gadget.id} src={gadget.image} alt={gadget.name.en} priority /></div>
        <div className="profile__main">
          <p className="eyebrow">Gadget</p>
          <h1>{gadget.name.en}</h1>
          {gadget.name.ja ? <p className="detail-head__ja" lang="ja">{gadget.name.ja}</p> : null}
          {gadget.aliases?.length ? <p className="detail-head__alt">Also known as {gadget.aliases.join(', ')}</p> : null}
          <p className="prose">{gadget.description || 'No description has been documented yet.'}</p>
          <FactList items={[
            { label: 'How it works', value: gadget.howItWorks || null },
            { label: 'First known appearance', value: first ? <Link to={first.url}>{displayTitle(first)}</Link> : (gadget.firstAppearance?.note ?? null) },
            { label: 'Appears in', value: `${appearances.episodes.length} ${appearances.episodes.length === 1 ? 'episode' : 'episodes'}, ${appearances.movies.length} ${appearances.movies.length === 1 ? 'movie' : 'movies'}` },
            { label: 'Record ID', value: <span className="mono">{gadget.id}</span> },
          ]} />
        </div>
      </section>

      <AppearanceLists appearances={appearances} filterKey="gadget" id={gadget.id} />

      {related.length ? (
        <MetadataSection id="related" title="Related gadgets">
          <div className="grid grid--compact">{related.map((g) => <GadgetCard key={g.id} gadget={g} compact />)}</div>
        </MetadataSection>
      ) : null}
      <ReferencesSection references={gadget.references} />
    </PageContainer>
  );
}
