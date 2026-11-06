import { Link } from 'react-router-dom';
import MetadataSection from './MetadataSection.jsx';
import CharacterCard from './CharacterCard.jsx';
import GadgetCard from './GadgetCard.jsx';
import EmptyState from './EmptyState.jsx';
import { getCharacter, getGadget, languageName, displayTitle } from '@/lib/catalog.js';

export function CharactersSection({ ids = [] }) {
  const items = ids.map(getCharacter).filter(Boolean);
  return (
    <MetadataSection id="characters" title="Characters" aside={items.length ? <span className="muted">{items.length}</span> : null}>
      {items.length ? (
        <div className="grid grid--compact">{items.map((c) => <CharacterCard key={c.id} character={c} compact />)}</div>
      ) : (
        <p className="muted">No characters have been documented for this entry yet.</p>
      )}
    </MetadataSection>
  );
}

export function GadgetsSection({ ids = [] }) {
  const items = ids.map(getGadget).filter(Boolean);
  return (
    <MetadataSection id="gadgets" title="Gadgets" aside={items.length ? <span className="muted">{items.length}</span> : null}>
      {items.length ? (
        <div className="grid grid--compact">{items.map((g) => <GadgetCard key={g.id} gadget={g} compact />)}</div>
      ) : (
        <p className="muted">No gadgets have been documented for this entry yet.</p>
      )}
    </MetadataSection>
  );
}

export function VoiceActorsSection({ voiceActors }) {
  const rows = Array.isArray(voiceActors) ? voiceActors : [];
  return (
    <MetadataSection id="voice-actors" title="Voice actors">
      {rows.length ? (
        <div className="table-wrap">
          {/* Episodes and movies do not carry a `version` on voice actors —
              each entry IS a version — so the table is character, actor,
              language, with the character linking to its page. */}
          <table className="data-table">
            <thead><tr><th scope="col">Character</th><th scope="col">Voice actor</th><th scope="col">Language</th></tr></thead>
            <tbody>
              {rows.map((v, i) => {
                const c = getCharacter(v.characterId);
                return (
                  <tr key={`${v.characterId ?? 'unknown'}-${v.name?.en}-${i}`}>
                    <td>{c ? <Link to={`/characters/${c.id}`}>{c.name.en}</Link> : (v.characterId ?? '—')}</td>
                    <td>{v.name?.en}{v.name?.ja ? <span className="muted" lang="ja"> {v.name.ja}</span> : null}</td>
                    <td>{languageName(v.language)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Voice actor information has not been documented for this entry yet.</p>
      )}
    </MetadataSection>
  );
}


export function Completeness({ checklist }) {
  if (!checklist.length) return null;
  const done = checklist.filter((c) => c.done).length;
  return (
    <div className="completeness" aria-label={`${done} of ${checklist.length} fields documented`}>
      <div className="completeness__bar" aria-hidden="true"><span style={{ width: `${(done / checklist.length) * 100}%` }} /></div>
      <p className="completeness__text">{done} of {checklist.length} fields documented</p>
      <ul className="completeness__list">
        {checklist.map((c) => <li key={c.label} className={c.done ? 'is-done' : ''}>{c.label}</li>)}
      </ul>
    </div>
  );
}

export function PrevNext({ previous, next, label }) {
  const gap = (a, b) => (a && b && Math.abs(a.number - b.number) > 1 ? ` (${label}s in between are not documented yet)` : '');
  return (
    <nav className="prev-next" aria-label={`Previous and next ${label}`}>
      {previous ? (
        <Link to={previous.url} state={{ preserveScroll: true }} className="prev-next__link prev-next__link--prev" rel="prev">
          <span className="prev-next__dir">Previous {label}</span>
          <span className="prev-next__title">{label === 'movie' ? 'No.' : '#'}{previous.number} {displayTitle(previous)}</span>
        </Link>
      ) : <span />}
      {next ? (
        <Link to={next.url} state={{ preserveScroll: true }} className="prev-next__link prev-next__link--next" rel="next">
          <span className="prev-next__dir">Next {label}</span>
          <span className="prev-next__title">{label === 'movie' ? 'No.' : '#'}{next.number} {displayTitle(next)}</span>
        </Link>
      ) : <span />}
    </nav>
  );
}
