import MediaCard from './MediaCard.jsx';

export default function GadgetCard({ gadget, compact = false }) {
  return (
    <MediaCard
      to={`/gadgets/${gadget.id}`}
      kind="gadget"
      seed={gadget.id}
      image={gadget.image?.url ?? null}
      imageAlt={gadget.image?.url ? (gadget.image?.alt ?? gadget.name.en) : ''}
      label="G"
      title={gadget.name.en}
      subtitle={gadget.name.ja && gadget.name.ja !== gadget.name.en ? gadget.name.ja : null}
      className={compact ? 'media-card--compact' : ''}
    >
      {!compact && gadget.description ? <p className="media-card__desc">{gadget.description}</p> : null}
    </MediaCard>
  );
}
