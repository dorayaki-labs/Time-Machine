// Role-aware actions shown on every archive detail page (episode, movie,
// character, gadget). Everyone signed in gets the direct "edit & send for
// review" dialog; staff additionally get a one-click jump into the archive
// editor. All rules are enforced again server-side — this row is convenience.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import EntryEditDialog from './EntryEditDialog.jsx';
import { useAuth, isStaff } from '@/hooks/useAuth.jsx';

export function entityTypeFor(entry) {
  if (entry?.kind === 'movie') return 'movie';
  if (entry?.kind === 'episode') return 'episode';
  if (entry?.id?.startsWith('char-')) return 'character';
  if (entry?.id?.startsWith('gadget-')) return 'gadget';
  return null;
}

export default function EntryActions({ entry }) {
  const { user, profile, backendConfigured } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const staff = isStaff(profile);
  const type = entityTypeFor(entry);
  if (!type) return null;

  return (
    <div className="entry-actions" aria-label="Contribution actions for this entry">
      {backendConfigured
        ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditOpen(true)}>
            <Icon name="edit" size={15} /> Edit this entry
          </button>
        )
        : (
          <Link className="btn btn--ghost btn--sm" to={`/contribute?category=metadata-correction&entry=${encodeURIComponent(entry.id)}`}>
            <Icon name="edit" size={15} /> Suggest an improvement
          </Link>
        )}
      {backendConfigured && user
        ? (
          <Link className="btn btn--ghost btn--sm" to={`/contribute?category=source&entry=${encodeURIComponent(entry.id)}`}>
            <Icon name="play" size={15} /> Add a viewing source
          </Link>
        ) : null}
      {backendConfigured && !user
        ? <span className="muted small entry-actions__hint">Sign in to edit this entry directly.</span>
        : null}
      {staff ? (
        <Link
          className="btn btn--ghost btn--sm"
          to={`/staff?tab=editor&entityType=${type}&entityId=${encodeURIComponent(entry.id)}`}
        >
          <Icon name="archive" size={15} /> Open in archive editor
        </Link>
      ) : null}
      {editOpen ? <EntryEditDialog entry={entry} onClose={() => setEditOpen(false)} /> : null}
    </div>
  );
}
