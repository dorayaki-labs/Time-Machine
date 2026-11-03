// Backend client. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are the ONLY
// credentials the frontend ever holds — both are public by design (the anon
// key plus RLS and server-side permission checks are the security boundary).
// When these are not configured the site runs in "archive-only" mode: all
// backend-powered pages show a friendly notice and the archive keeps working.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const backendConfigured = Boolean(url && anonKey);

export const supabase = backendConfigured ? createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' },
}) : null;

/** Calls an Edge Function with the caller's session token attached. */
export async function callFunction(name, body) {
  if (!supabase) throw new Error('The backend is not configured.');
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  let res;
  try {
    res = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST', headers, body: JSON.stringify(body ?? {}),
    });
  } catch {
    // A rejected fetch here is almost always a blocked CORS preflight (the
    // backend's ALLOWED_ORIGINS secret missing this exact site address), not
    // a user-facing network problem.
    throw new Error(
      'Could not reach the submission service. If the site address changed '
      + 'recently, the backend ALLOWED_ORIGINS secret must include it exactly — '
      + 'see DEPLOYMENT.md, step D8.',
    );
  }
  let parsed = null;
  try { parsed = await res.json(); } catch { /* non-JSON error */ }
  if (!res.ok) {
    const err = new Error(parsed?.error ?? `The request failed (${res.status}).`);
    err.status = res.status;
    err.fieldErrors = parsed?.errors ?? null;
    throw err;
  }
  return parsed;
}
