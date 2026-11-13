// In-app notification access for the signed-in user (the notifications
// table, migration 0004). RLS isolates rows per user on the server — these
// helpers only ever see the caller's own notifications. Everything degrades
// to null/[] when the backend is not configured.

import { supabase, backendConfigured } from './backend.js';

const COLUMNS = 'id, type, contribution_number, title, entry_id, entry_series, message, read_at, created_at';

/** The user's notifications, newest first. */
export async function fetchNotifications({ limit = 30 } = {}) {
  if (!backendConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Unread count for the bell badge (cheap: count-only query). */
export async function fetchUnreadCount() {
  if (!backendConfigured || !supabase) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Mark one notification as read. */
export async function markNotificationRead(id) {
  if (!backendConfigured || !supabase || !id) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Mark every notification as read. */
export async function markAllNotificationsRead() {
  if (!backendConfigured || !supabase) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(error.message);
}
