// The avatar button in the header. Logged out: a "Sign in" pill that starts
// the Discord OAuth flow. Logged in: the Discord profile picture; clicking it
// opens a dropdown with profile, contribution statistics, history and logout.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';

export default function AccountMenu() {
  const { user, profile, backendConfigured, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!backendConfigured) return null;  // archive-only mode: no UI at all

  if (!user) {
    return (
      <button type="button" className="btn btn--primary account-menu__signin" onClick={signIn}>
        <Icon name="user" size={16} /> Sign in
      </button>
    );
  }

  const avatar = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const name = profile?.display_name ?? user.user_metadata?.full_name ?? 'Member';
  const role = profile?.role ?? 'member';
  const initials = String(name).slice(0, 2).toUpperCase();

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="account-menu__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${name}`}
        title={`Signed in as ${name}`}
      >
        {avatar
          ? <img src={avatar} alt="" width="34" height="34" className="account-menu__avatar" referrerPolicy="no-referrer" />
          : <span className="account-menu__avatar account-menu__avatar--fallback" aria-hidden="true">{initials}</span>}
      </button>

      {open ? (
        <div className="account-menu__panel" role="menu" aria-label="Account">
          <div className="account-menu__who">
            <strong>{name}</strong>
            <span className="account-menu__role account-menu__role--{role}">{role}</span>
          </div>
          <ul className="account-menu__links">
            <li><Link role="menuitem" to="/account" onClick={() => setOpen(false)}><Icon name="user" size={15} /> My contributions</Link></li>
            <li><Link role="menuitem" to="/stats" onClick={() => setOpen(false)}><Icon name="stats" size={15} /> Statistics</Link></li>
            {['checker', 'admin', 'owner'].includes(role)
              ? <li><Link role="menuitem" to="/staff" onClick={() => setOpen(false)}><Icon name="check" size={15} /> Moderation panel</Link></li>
              : null}
            <li role="separator" />
            <li><button type="button" role="menuitem" onClick={() => { setOpen(false); signOut(); }}><Icon name="close" size={15} /> Sign out</button></li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
