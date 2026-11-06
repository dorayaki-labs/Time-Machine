// Data access for the public statistics page, the public contribution log
// and private account history. Everything degrades gracefully: when the
// backend is not configured, or a request fails, callers get null and show
// a friendly notice — the archive itself never breaks.

import { supabase, backendConfigured } from './backend.js';

/** Live counters from the public_stats view (no authentication needed). */
export async function fetchPublicStats() {
  if (!backendConfigured || !supabase) return null;
  const { data, error } = await supabase.from('public_stats').select('*').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Every contribution event, newest first — the public activity feed. One
    row per submission with its current status; payloads and review reasons
    never leave the database. */
export async function fetchPublicLog({ limit = 60 } = {}) {
  if (!backendConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('public_log')
    .select(`number, title, type, entry_id, entry_series, status,
             submitted_at, reviewed_at, contributor_name, contributor_username,
             contributor_avatar, reviewer_name, reviewer_avatar`)
    .order('submitted_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Direct archive edits and deletions (public metadata only). */
export async function fetchPublicEdits({ limit = 60 } = {}) {
  if (!backendConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('public_edits')
    .select('id, action, entity_type, entity_id, commit_sha, created_at, editor_name, editor_username, editor_avatar')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The signed-in user's own submissions with statuses, review details and
    their payloads (RLS only returns these for the author), plus the name of
    whoever reviewed each one. */
export async function fetchMyContributions() {
  if (!backendConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('contributions')
    .select('id, number, type, title, entry_id, status, reviewer_id, reviewed_at, review_reason, created_at, commit_sha, payload, payload_edited')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.reviewer_id).filter(Boolean))];
  if (!ids.length) return rows;
  const { data: people, error: peopleError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', ids);
  if (peopleError) throw new Error(peopleError.message);
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    reviewer_profile: byId.get(r.reviewer_id) ?? null,
  }));
}

/** Staff: all submissions with contributor info, filtered and paged. */
export async function fetchSubmissions({ status = 'all', type = 'all', search = '', limit = 50 } = {}) {
  if (!backendConfigured || !supabase) return null;
  // Embedding profiles twice in one query breaks on some PostgREST versions
  // ("table name ... specified more than once"), so the people are fetched in
  // a second query and stitched in here.
  let query = supabase
    .from('contributions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status !== 'all') query = query.eq('status', status);
  if (type !== 'all') query = query.eq('type', type);
  if (search.trim()) query = query.or(`title.ilike.%${search.trim()}%,entry_id.ilike.%${search.trim()}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ids = [...new Set(rows.flatMap((r) => [r.contributor_id, r.reviewer_id].filter(Boolean)))];
  if (!ids.length) return rows;
  const { data: people, error: peopleError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .in('id', ids);
  if (peopleError) throw new Error(peopleError.message);
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    profiles: byId.get(r.contributor_id) ?? null,
    reviewer_profile: byId.get(r.reviewer_id) ?? null,
  }));
}

/** Staff: audit events, newest first. */
export async function fetchAuditLog({ limit = 100 } = {}) {
  if (!backendConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Counts by status for the user's own stats strip. */
export function tallyStatuses(rows) {
  const tally = { pending: 0, accepted: 0, declined: 0, deleted: 0 };
  for (const row of rows ?? []) if (tally[row.status] !== undefined) tally[row.status]++;
  return tally;
}

/** Archive completeness from the already-loaded catalogue (same rules as the
    computed record status): counts as "completely documented" when every
    checklist field is filled. */
export function archiveDocumentedCounts(catalog) {
  return {
    episodes: catalog?.episodes?.filter((e) => e.status === 'complete').length ?? 0,
    movies: catalog?.movies?.filter((m) => m.status === 'complete').length ?? 0,
  };
}

export const STATUS_LABELS = {
  pending: 'Pending', accepted: 'Accepted', declined: 'Declined', deleted: 'Deleted',
};
