import { metadataStatusLabel, sourceStatusLabel, preservationLabel } from '@/lib/catalog.js';

const KINDS = {
  metadata: { label: metadataStatusLabel, prefix: 'Metadata' },
  availability: { label: sourceStatusLabel, prefix: 'Viewing' },
  preservation: { label: preservationLabel, prefix: 'Preservation' },
};

/** Metadata completeness, viewing availability, and preservation status are deliberately separate signals. */
export default function StatusIndicator({ kind = 'metadata', value, compact = false }) {
  const conf = KINDS[kind];
  if (!conf || !value) return null;
  const label = conf.label(value);
  return (
    <span className={`status status--${kind} status--${value}${compact ? ' status--compact' : ''}`} title={`${conf.prefix}: ${label}`}>
      <span className="status__dot" aria-hidden="true" />
      <span className="status__text"><span className="sr-only">{conf.prefix}: </span>{label}</span>
    </span>
  );
}
