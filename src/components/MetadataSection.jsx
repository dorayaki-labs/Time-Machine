export default function MetadataSection({ id, title, aside, children, className = '' }) {
  return (
    <section className={`detail-section ${className}`} aria-labelledby={id ? `${id}-title` : undefined} id={id}>
      <header className="detail-section__head">
        <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
        {aside ? <div className="detail-section__aside">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function FactList({ items }) {
  return (
    <dl className="facts">
      {items.filter(Boolean).map((it) => (
        <div key={it.label}>
          <dt>{it.label}</dt>
          <dd>{it.value ?? <span className="muted">Not documented</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
