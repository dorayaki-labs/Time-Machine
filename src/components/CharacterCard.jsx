import MediaCard from './MediaCard.jsx';
import { characterCategoryLabel } from '@/lib/catalog.js';

export default function CharacterCard({ character, compact = false }) {
  return (
    <MediaCard
      to={`/characters/${character.id}`}
      kind="character"
      seed={character.id}
      image={character.image?.url ?? null}
      imageAlt={character.image?.url ? (character.image?.alt ?? character.name.en) : ''}
      label={character.name.en.charAt(0)}
      title={character.name.en}
      subtitle={character.name.ja && character.name.ja !== character.name.en ? character.name.ja : null}
      className={compact ? 'media-card--compact' : ''}
    >
      {!compact && character.description ? <p className="media-card__desc">{character.description}</p> : null}
      <p className="media-card__meta">{characterCategoryLabel(character.category)}</p>
    </MediaCard>
  );
}
