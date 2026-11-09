// The red ban notification strip. Shown for every signed-in user whose
// profile carries banned=true. Hiding it is session-only (sessionStorage):
// the strip returns on the next visit or new tab — and the ban itself is
// enforced server-side on every protected call, so hiding it changes nothing.

import { useState } from 'react';
import Icon from './Icon.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';

const HIDE_KEY = 'tm-ban-banner-hidden-session';

export default function BanBanner() {
  const { user, profile, ready, backendConfigured } = useAuth();
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
  });

  if (!backendConfigured || !ready || !user || !profile?.banned || hidden) return null;

  const hide = () => {
    try { sessionStorage.setItem(HIDE_KEY, '1'); } catch { /* private mode */ }
    setHidden(true);
  };

  return (
    <div className="ban-banner" role="alert">
      <span className="ban-banner__icon" aria-hidden="true"><Icon name="alert" size={17} /></span>
      <p className="ban-banner__text">
        <strong>Your account is currently banned.</strong>{' '}
        Contributions, edits and staff actions are unavailable while the ban is in place.
        {profile.ban_reason ? <> Reason on record: <em>{profile.ban_reason}</em></> : null}
      </p>
      <button type="button" className="ban-banner__hide" onClick={hide}
        aria-label="Hide the ban notice for this visit">
        Dismiss for this visit
      </button>
    </div>
  );
}
