import { Link, useParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import MediaImage from '@/components/MediaImage.jsx';
import MetadataSection, { FactList } from '@/components/MetadataSection.jsx';
import EntryActions from '@/components/EntryActions.jsx';
import AppearanceLists from '@/components/AppearanceLists.jsx';
import GadgetCard from '@/components/GadgetCard.jsx';
import NotFound from './NotFound.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { getCharacter, getEntriesForCharacter, getGadgetsForCharacter, getEntry, characterCategoryLabel, languageName, displayTitle } from '@/lib/catalog.js';

export default function CharacterDetails() {
  const { id } = useParams();
  const character = getCharacter(id);
  useDocumentTitle(character ? character.name.en : 'Character not found');
  if (!character) return <NotFound title="Character not found" message="That character is not in the archive yet." />;

  const appearances = getEntriesForCharacter(character.id);
  const gadgets = getGadgetsForCharacter(character.id);
  const first = character.firstAppearance?.entryId ? getEntry(character.firstAppearance.entryId) : null;

  return (
    <PageContainer className="detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/characters">Characters</Link><span aria-hidden="true">/</span><span aria-current="page">{character.name.en}</span>
      </nav>
      <section className="profile">
        <div className="profile__portrait"><MediaImage kind="character" seed={character.id} label={character.name.en.charAt(0)} src={character.image} alt={character.name.en} priority /></div>
        <div className="profile__main">
          <p className="eyebrow">{characterCategoryLabel(character.category)}</p>
          <h1>{character.name.en}</h1>
          {character.name.ja ? <p className="detail-head__ja" lang="ja">{character.name.ja}</p> : null}
          {character.aliases?.length ? <p className="detail-head__alt">Also known as {character.aliases.join(', ')}</p> : null}
          <p className="prose">{character.description || 'No description has been documented yet.'}</p>
          <FactList items={[
            { label: 'First known appearance', value: first ? <Link to={first.url}>{displayTitle(first)}</Link> : (character.firstAppearance?.note ?? null) },
            { label: 'Appears in', value: `${appearances.episodes.length} ${appearances.episodes.length === 1 ? 'episode' : 'episodes'}, ${appearances.movies.length} ${appearances.movies.length === 1 ? 'movie' : 'movies'}` },
            { label: 'Record ID', value: <span className="mono">{character.id}</span> },
          ]} />
        </div>
      </section>

      <EntryActions entry={character} />

      <MetadataSection id="voice-actors" title="Voice actors">
        {character.voiceActors?.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Voice actor</th><th scope="col">Language</th><th scope="col">Version</th></tr></thead>
              <tbody>
                {character.voiceActors.map((v) => (
                  <tr key={`${v.name?.en}-${v.version}`}>
                    <td>{v.name?.en}{v.name?.ja ? <span className="muted" lang="ja"> {v.name.ja}</span> : null}</td>
                    <td>{languageName(v.language)}</td>
                    <td>{v.version ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Voice actors have not been documented for this character yet.</p>}
      </MetadataSection>

      <AppearanceLists appearances={appearances} filterKey="character" id={character.id} />

      {gadgets.length ? (
        <MetadataSection id="gadgets" title="Related gadgets" aside={<span className="muted">Seen alongside {character.name.en}</span>}>
          <div className="grid grid--compact">{gadgets.map((g) => <GadgetCard key={g.id} gadget={g} compact />)}</div>
        </MetadataSection>
      ) : null}
    </PageContainer>
  );
}
