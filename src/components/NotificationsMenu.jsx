// The notifications bell in the top bar (signed-in users). Unread count on
// the badge; opening the panel lists notifications with their status icon —
// green check (accepted), red cross (declined), red trash (deleted) — the
// message, the entry link and the date. Clicking marks the item read and
// navigates to the entry (or the contributor's own history when the entry
// is unknown). The badge refreshes on mount and whenever the visitor returns
// to the tab — no polling loop, no duplicate generation (that is the
// backend's job, see migration 0004 and _shared/notifications.js).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { entryPath, fmtTime } from '@/lib/activity.js';
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead } from '@/lib/notifications.js';

const TYPE_META = {
  accepted: { icon: 'check', cls: 'is-accepted', label: 'Accepted' },
  declined: { icon: 'close', cls: 'is-declined', label: 'Declined' },
  deleted: { icon: 'trash', cls: 'is-deleted', label: 'Deleted' },
};

function NotificationRow({ item, onOpen }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.accepted;
  const target = entryPath(item.entry_id);
  return (
    <button
      type="button"
      className={`notifications-item ${meta.cls}${item.read_at ? '' : ' is-unread'}`}
      onClick={() => onOpen(item)}
      aria-label={`${meta.label}: ${item.message}`}
    >
      <span className="notifications-item__icon" aria-hidden="true"><Icon name={meta.icon} size={13} /></span>
      <span className="notifications-item__body">
        <span className="notifications-item__text">
          {item.message}
          {target
            ? <span className="notifications-item__go"> View the entry →</span>
            : <span className="notifications-item__go"> View in your profile →</span>}
        </span>
        <span className="notifications-item__meta muted">
          {item.contribution_number ? <>#{item.contribution_number} · </> : null}
          {fmtTime(item.created_at)}
        </span>
      </span>
      {item.read_at ? null : <span className="notifications-item__dot" aria-label="Unread" />}
    </button>
  );
}

export default function NotificationsMenu() {
  const { user, backendConfigured } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const navigate = useNavigate();

  const refreshBadge = useCallback(() => {
    if (!user) return;
    fetchUnreadCount()
      .then(setUnread)
      .catch(() => { /* the badge is cosmetic — failures stay silent */ });
  }, [user]);

  useEffect(() => {
    refreshBadge();
    // Re-check when the visitor comes back to the tab, like the account
    // banner does — statuses change while people are away.
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      if (!open) refreshBadge();
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [refreshBadge, open]);

  // The full list loads when the panel opens, never before.
  useEffect(() => {
    if (!open || items !== null) return undefined;
    let active = true;
    fetchNotifications()
      .then((rows) => active && setItems(rows))
      .catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [open, items]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!backendConfigured || !user) return null;

  const openItem = async (item) => {
    if (!item.read_at) {
      setUnread((n) => Math.max(0, n - 1));
      setItems((rows) => rows?.map((r) => (r.id === item.id ? { ...r, read_at: new Date().toISOString() } : r)) ?? rows);
      try { await markNotificationRead(item.id); } catch { /* stays unread server-side; the panel move already happened */ }
    }
    setOpen(false);
    navigate(entryPath(item.entry_id) ?? '/account');
  };

  const markAll = async () => {
    setItems((rows) => rows?.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })) ?? rows);
    setUnread(0);
    try { await markAllNotificationsRead(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="notifications" ref={ref}>
      <button
        type="button"
        className="icon-btn notifications__bell"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        title="Notifications"
      >
        <Icon name="bell" size={19} />
        {unread > 0 ? <span className="notifications__badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="notifications__panel" role="menu" aria-label="Notifications">
          <div className="notifications__head">
            <strong>Notifications</strong>
            {unread > 0 ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={markAll}>Mark all as read</button>
            ) : null}
          </div>
          {error ? <p className="notice notice--warn notifications__error">Notifications could not load ({error}).</p> : null}
          {items === null && !error ? <p className="muted small notifications__loading">Loading…</p> : null}
          {items !== null && items.length === 0 ? (
            <p className="notifications__empty muted small">
              You&rsquo;re all caught up — notifications about your contributions appear here.
            </p>
          ) : null}
          {items !== null && items.length > 0 ? (
            <div className="notifications__list" role="presentation">
              {items.map((item) => (
                <NotificationRow key={item.id} item={item} onOpen={openItem} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
