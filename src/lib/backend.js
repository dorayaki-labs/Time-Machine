// Backend client. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are the ONLY
// credentials the frontend ever holds — both are public by design (the anon
// key plus RLS and server-side permission checks are the security boundary).
// When these are not configured the site runs in "archive-only" mode: all
// backend-powered pages show a friendly notice and the archive keeps working.

import { createClient } from '@supabase/supabase-js';

// Build variables are pasted by hand into dashboards, so be forgiving at the
// edges: trim stray whitespace, strip wrapping quotes, and add the https://
// scheme when a bare host was pasted (a malformed value used to make
// createClient throw at module load and black-screen the whole site).
function cleanConfigValue(raw) {
  return String(raw ?? '').trim().replace(/^["']+|["']+$/g, '');
}

const rawUrl = cleanConfigValue(import.meta.env.VITE_SUPABASE_URL);
const anonKey = cleanConfigValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

const url = (() => {
  if (!rawUrl) return null;
  const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    // WHATWG URL parsing is lenient — "https://garbage!!" parses instead of
    // throwing. A real backend host has a dot (project-ref.supabase.co);
    // localhost and raw IPs are the explicit development exceptions.
    const host = parsed.hostname;
    const sane = host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes('.');
    return sane ? withScheme : null;
  } catch {
    return null;
  }
})();

if (!url && rawUrl) {
  console.error('Time Machine: running in archive-only mode. VITE_SUPABASE_URL is set '
    + 'but is not a valid http(s) URL — use the Project URL from Supabase → Settings '
    + '→ Data API, e.g. https://<project-ref>.supabase.co');
} else if (url && !anonKey) {
  console.error('Time Machine: running in archive-only mode. VITE_SUPABASE_ANON_KEY '
    + 'is missing from this build.');
}

export const backendConfigured = Boolean(url && anonKey);

export const supabase = backendConfigured ? createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' },
}) : null;

// ---------------------------------------------------------------------------
// Session handling
// ---------------------------------------------------------------------------

const TOKEN_REFRESH_MARGIN_MS = 60_000;

/**
 * A valid access token, refreshing proactively when the current one expires
 * within the next minute. This is the root fix for the "buttons randomly
 * stop working" reports: a token that expired moments before a request made
 * the Edge Function answer 401, the UI showed a dead-end error, and some
 * flows looked permanently stuck. Returns null when signed out.
 */
export async function getAccessToken() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  if (!expiresAt || expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return session.access_token;
  }
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data?.session?.access_token) return null;
  return data.session.access_token;
}

/** True when the error is a hard authentication failure (not a network glitch). */
export const isAuthError = (err) => err?.status === 401;

// ---------------------------------------------------------------------------
// Edge Function calls
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

function functionError(message, { status = null, cause = null, timeout = false } = {}) {
  const err = new Error(message, cause ? { cause } : undefined);
  err.status = status;
  err.timeout = timeout;
  return err;
}

function networkHint(status) {
  if (status === 401) return 'Your session has expired — sign in again and retry.';
  if (status === 403) return 'Your account does not have permission for this action.';
  if (status === 429) return 'The backend asked you to slow down — wait a moment and retry.';
  return null;
}

/**
 * Calls an Edge Function with the caller's session token attached.
 *
 * Reliability contract (the fix for randomly unresponsive buttons):
 *   * every request gets a hard 30 s timeout, so `busy` state can never hang
 *     forever — the button re-enables and the user sees a clear message;
 *   * the token is refreshed PROACTIVELY when close to expiry, and a 401
 *     triggers exactly one refresh + retry (safe: the function rejected the
 *     original request before doing any work, so nothing can be duplicated);
 *   * state-changing operations are NEVER automatically retried on network
 *     or timeout errors — an ambiguity could double-apply a commit, so those
 *     surface as explicit errors instead.
 */
export async function callFunction(name, body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!supabase) throw functionError('The backend is not configured.');

  const call = async (token, signal) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST', headers, body: JSON.stringify(body ?? {}), signal,
    });
    return res;
  };

  const run = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await call(await getAccessToken(), controller.signal);
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw functionError(
          `The backend did not answer within ${Math.round(timeoutMs / 1000)} seconds. `
          + 'It may be starting up — try again in a moment.',
          { timeout: true, cause: err },
        );
      }
      // A rejected fetch here is almost always a blocked CORS preflight (the
      // backend's ALLOWED_ORIGINS secret missing this exact site address) or
      // a transient network blip. No automatic retry: the request MAY have
      // reached the server, and blindly repeating it could double-apply an
      // archive commit.
      throw functionError(
        'Could not reach the submission service. Check your connection, then try again. '
        + 'If the site address changed recently, the backend ALLOWED_ORIGINS secret '
        + 'must include it exactly — see DEPLOYMENT.md, step D8.',
        { cause: err },
      );
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await run();
  if (res.status === 401) {
    // One refresh + retry: the request was rejected before any work happened.
    const { error } = await supabase.auth.refreshSession();
    if (!error) res = await run();
  }

  let parsed = null;
  try { parsed = await res.json(); } catch { /* non-JSON error */ }
  if (!res.ok) {
    const hint = networkHint(res.status);
    const base = parsed?.error ?? `The request failed (${res.status}).`;
    const err = functionError(hint ? `${base} — ${hint}` : base, { status: res.status });
    err.fieldErrors = parsed?.errors ?? null;
    throw err;
  }
  return parsed;
}
