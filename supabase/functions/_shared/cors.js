// CORS + JSON helpers. Allowed origins are supplied through the
// ALLOWED_ORIGINS function secret (comma-separated); requests from anywhere
// else are rejected before any work happens.

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

export function corsHeaders(env, origin) {
  const list = allowedOrigins(env);
  return origin && list.includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
