// CORS + JSON helpers. Allowed origins are supplied through the
// ALLOWED_ORIGINS function secret (comma-separated, "*" allows every origin);
// requests from anywhere else are rejected before any work happens.

// Bumped on every change to this file so a live deployment can be verified
// without credentials: `curl -i -X OPTIONS <function-url>` must show
// x-tm-cors-version: 2. If it is missing, the function is running old code.
export const CORS_VERSION = '2';

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

export function allowedOrigins(env) {
  return String(env.get?.('ALLOWED_ORIGINS') ?? env.ALLOWED_ORIGINS ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
}

/** Origins are compared scheme+host+port only, so a trailing slash or
 *  uppercase host in the secret cannot silently break matching. */
export function normalizeOrigin(origin) {
  try {
    const u = new URL(String(origin));
    return `${u.protocol}//${u.host.toLowerCase()}`;
  } catch {
    return String(origin ?? '').trim().replace(/\/+$/, '');
  }
}

export function corsHeaders(env, origin) {
  const list = allowedOrigins(env);
  const ok = origin && (list.includes('*') || list.some((o) => normalizeOrigin(o) === normalizeOrigin(origin)));
  return ok
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Expose-Headers': 'x-tm-cors-version',
        'x-tm-cors-version': CORS_VERSION,
        Vary: 'Origin',
      }
    : { Vary: 'Origin' };
}

/** Handles the OPTIONS preflight. Returns a Response, or null if not preflight. */
export function preflight(req, env) {
  if (req.method !== 'OPTIONS') return null;
  const origin = req.headers.get('Origin');
  const headers = corsHeaders(env, origin);
  if (origin && !headers['Access-Control-Allow-Origin']) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers });
}

/** Rejects cross-origin requests from hosts we did not configure. */
export function checkOrigin(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return { ok: true };  // same-origin / server-to-server calls
  const headers = corsHeaders(env, origin);
  if (!headers['Access-Control-Allow-Origin']) {
    return { ok: false, response: json({ error: 'Origin not allowed.' }, 403) };
  }
  return { ok: true, headers };
}

/** The browser demands Access-Control-Allow-Origin on the ACTUAL response,
 *  not just on the preflight — without it every POST dies as "NetworkError"
 *  even when the preflight passed. Wrap each handler's response with this so
 *  every reply to an allowed origin carries the headers. */
export function withCors(response, req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return response;
  const headers = corsHeaders(env, origin);
  if (!headers['Access-Control-Allow-Origin']) return response;  // rejected upstream
  const out = new Headers(response.headers);
  for (const [k, v] of Object.entries(headers)) if (!out.has(k)) out.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: out });
}
