// Owner-only user management panel. Separate from the Moderation Panel on
// purpose: the directory lists EVERY account and exposes role changes and
// ban management. The frontend gate (isOwner) is convenience only — the
// manage-users Edge Function re-verifies the owner role on every call, and
// the protected-field triggers make ban/role columns unwritable from any
// browser session.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import Icon from '@/components/Icon.jsx';
import Avatar from '@/components/Avatar.jsx';
import { useAuth, isOwner } from '@/hooks/useAuth.jsx';
import { listUsers, setUserRole, banUser, unbanUser } from '@/lib/staffApi.js';

const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

function RoleSelect({ user, busy, disabled, onChange }) {
  return (
    <div className="select-wrap owner-select">
      <select value={user.role} disabled={busy || disabled}
        aria-label={`Role for ${user.display_name}`}
        onChange={(e) => onChange(e.target.value)}>
        <option value="member">member</option>
        <option value="checker">checker</option>
        <option value="admin">admin</option>
        {user.role === 'owner' ? <option value="owner">owner</option> : null}
      </select>
      <Icon name="chevronDown" size={15} className="select-wrap__chev" />
    </div>
  );
}

function BanDialog({ user, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ban-title">
        <div className="modal__head">
          <h3 id="ban-title">Ban {user.display_name}?</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={19} /></button>
        </div>
        <div className="modal__body">
          <p className="muted small">
            The account immediately loses contributions, edits and staff actions — enforced
            server-side on every protected request. Their role is preserved and restored when the
            ban is lifted. The reason is shown to them in the site banner.
          </p>
          <div className="field">
            <label htmlFor="ban-reason">Reason <span className="field__opt">(shown to the user)</span></label>
            <textarea id="ban-reason" rows={3} value={reason} maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. repeated vandalism of episode records" />
          </div>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--danger" disabled={busy} onClick={() => onConfirm(reason.trim() || null)}>
            {busy ? 'Working…' : 'Ban account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserRow({ user, isSelf, busy, onRole, onBan, onUnban }) {
  const [confirming, setConfirming] = useState(false);
  const protected_ = user.role === 'owner' || isSelf;
  return (
    <article className={`owner-user${user.banned ? ' owner-user--banned' : ''}`}>
      <div className="owner-user__who">
        <Avatar name={user.display_name} url={user.avatar_url} size={38} />
        <div>
          <p className="owner-user__name">
            {user.display_name}
            {user.banned ? <span className="chip chip--mono owner-user__chip-banned">Banned</span> : null}
            {user.role === 'owner' ? <span className="chip chip--mono">Owner</span> : null}
            {isSelf ? <span className="chip chip--mono">You</span> : null}
          </p>
          <p className="owner-user__meta muted small">
            {user.username ? <>@{user.username} · </> : null}
            <span className="mono">{user.discord_id}</span> · joined {fmtDay(user.created_at)}
          </p>
        </div>
      </div>
      <div className="owner-user__stats" aria-label="Contribution statistics">
        <span title="Accepted contributions"><strong>{user.stats.accepted}</strong> accepted</span>
        <span title="Pending contributions"><strong>{user.stats.pending}</strong> pending</span>
        <span title="Total submissions"><strong>{user.stats.total}</strong> total</span>
      </div>
      <div className="owner-user__actions">
        <RoleSelect user={user} busy={busy} disabled={protected_} onChange={(role) => onRole(user, role)} />
        {user.banned ? (
          <button type="button" className="btn btn--ghost btn--sm" disabled={busy || protected_}
            onClick={() => onUnban(user)}>Lift ban</button>
        ) : (
          <button type="button" className={`btn btn--ghost btn--sm btn--danger${confirming ? ' is-active' : ''}`}
            disabled={busy || protected_}
            onClick={() => setConfirming((v) => !v)}>
            <Icon name="close" size={13} /> Ban…
          </button>
        )}
      </div>
      {user.banned && user.ban_reason ? (
        <p className="owner-user__reason muted small">Ban reason: {user.ban_reason} · banned {fmtDay(user.banned_at)}</p>
      ) : null}
      {confirming ? (
        <BanDialog user={user} busy={busy} onClose={() => setConfirming(false)} onConfirm={(reason) => { setConfirming(false); onBan(user, reason); }} />
      ) : null}
    </article>
  );
}

export default function OwnerPanel() {
  const { profile, ready, backendConfigured } = useAuth();
  const owner = isOwner(profile);

  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [banFilter, setBanFilter] = useState('');

  // Searches are debounced and panels can be opened/closed repeatedly, so
  // several list requests can be in flight at once. Every response carries a
  // sequence number; only the NEWEST one may touch state. This makes an
  // out-of-order response harmless instead of a stale-result overwrite, and
  // it works identically after auth token refreshes mid-session.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setError(null);
    try {
      const res = await listUsers({ q: q.trim() || undefined, role: roleFilter || undefined, banned: banFilter === '' ? undefined : banFilter === 'banned' });
      if (seq !== loadSeq.current) return;
      if (res && res.error) throw new Error(res.error);
      // The list action answers { ok, users: [...] } — unwrap the envelope,
      // accepting a bare array too, so users state is always a real array.
      setUsers(Array.isArray(res) ? res : Array.isArray(res?.users) ? res.users : []);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      console.error('[Time Machine] user list failed:', err?.message, err?.status ?? '');
      setError(err.message);
    }
  }, [q, roleFilter, banFilter]);

  useEffect(() => {
    if (!owner) return undefined;
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, owner, q]);

  const act = async (fn, okMessage) => {
    setBusy(true); setError(null); setMessage(null);
    try {
      await fn();
      setMessage(okMessage);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const onRole = (user, role) => {
    if (role === user.role) return;
    act(
      () => setUserRole(user.id, role),
      `${user.display_name} is now ${role === 'member' ? 'a regular member' : `a ${role}`}.`,
    );
  };
  const onBan = (user, reason) => act(
    () => banUser(user.id, reason),
    `${user.display_name} is banned. They keep their role and can be unbanned at any time.`,
  );
  const onUnban = (user) => act(
    () => unbanUser(user.id),
    `${user.display_name} can contribute again — their previous role is restored.`,
  );

  const filtered = useMemo(() => (Array.isArray(users) ? users : []).filter((u) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return [u.display_name, u.username, u.discord_id].some((v) => String(v ?? '').toLowerCase().includes(needle));
  }), [users, q]);

  if (!backendConfigured) {
    return (
      <PageContainer>
        <div className="page-opening"><h1>User management</h1></div>
        <EmptyState icon="archive" title="Backend not connected">
          <p>The user panel becomes available once the backend is configured.</p>
        </EmptyState>
      </PageContainer>
    );
  }
  if (!ready) return <PageContainer><LoadingState label="Loading…" /></PageContainer>;
  if (!owner) {
    return (
      <PageContainer>
        <div className="page-opening"><h1>User management</h1></div>
        <EmptyState icon="archive" title="Owner access required">
          <p>This panel is only available to the project owner. Administrators manage checkers from the moderation panel.</p>
        </EmptyState>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-opening">
        <p className="eyebrow">Owner area</p>
        <h1>User management</h1>
        <p className="page-opening__lead">
          Every registered account, with roles, ban state and contribution statistics. Role ladders
          and permissions follow the existing checker / admin / owner structure — all actions are
          validated server-side and recorded in the audit log.
        </p>
      </div>

      <div className="filter-row owner-filters">
        <input type="search" placeholder="Search by name, username or Discord ID…" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Search accounts" />
        <div className="select-wrap">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
            <option value="">Any role</option>
            <option value="member">member</option>
            <option value="checker">checker</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
          <Icon name="chevronDown" size={15} className="select-wrap__chev" />
        </div>
        <div className="select-wrap">
          <select value={banFilter} onChange={(e) => setBanFilter(e.target.value)} aria-label="Filter by ban state">
            <option value="">Any ban state</option>
            <option value="banned">Banned only</option>
            <option value="active">Not banned</option>
          </select>
          <Icon name="chevronDown" size={15} className="select-wrap__chev" />
        </div>
      </div>

      {message ? <p className="notice" role="status">{message}</p> : null}
      {error ? <p className="notice notice--error" role="alert">{error}</p> : null}

      {users === null ? (
        <LoadingState label="Loading accounts…" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="user" title="No accounts match">
          <p>No registered account matches this search or filter.</p>
        </EmptyState>
      ) : (
        <div className="owner-list">
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === profile.id} busy={busy}
              onRole={onRole} onBan={onBan} onUnban={onUnban} />
          ))}
        </div>
      )}
      <p className="muted small" style={{ marginTop: '1rem' }}>
        Roles are ranked member → checker → admin → owner. The owner role itself can never be
        granted, changed or removed here — recovery follows the documented SQL procedure — and you
        cannot change your own account, so ownership cannot be lost by accident.
      </p>
    </PageContainer>
  );
}
