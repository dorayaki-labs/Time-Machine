// Public profile access (the public_profiles view, migration 0004) plus the
// per-username contribution history reused by the public profile page. Only
// deliberately public fields ever cross this module: username, display name,
// avatar, role, account creation date, and the public activity already
// exposed by the public_log view. Tokens, Discord ids, ban state and every
// other profile column stay in the database.

import { supabase, backendConfigured } from './backend.js';

/**
 * Look up a public profile by username (case-insensitive: Discord usernames
 * are lowercase, but the route must survive any casing someone types).
 * Returns null when the backend is off or the profile is not public
 * (unknown username, never-contributed member, or banned account).
 */
export async function fetchPublicProfile(username) {
  if (!backendConfigured || !supabase || !username) return null;
  const wanted = String(username).trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,32}$/.test(wanted)) return null; // not a username at all
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, username, display_name, avatar_url, role, created_at')
    .ilike('username', wanted)
    .limit(2);
  if (error) throw new Error(error.message);
  // Exact (case-insensitive) match only — ilike allows wildcards we already
  // screened out, but an exact compare is the honest guard.
  const match = (data ?? []).find((row) => (row.username ?? '').toLowerCase() === wanted) ?? null;
  return match;
}

/**
 * One contributor's public contribution history (public_log view rows).
 * Statuses, entry ids and dates are already public in the activity feed;
 * payloads and review reasons never ride along.
 */
export async function fetchPublicContributions(username, { limit = 200 } = {}) {
  if (!backendConfigured || !supabase || !username) return [];
  const { data, error } = await supabase
    .from('public_log')
    .select('number, title, type, entry_id, entry_series, status, submitted_at, reviewed_at, contributor_name, contributor_username')
    .eq('contributor_username', username)
    .order('submitted_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
