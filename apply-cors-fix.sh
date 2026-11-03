#!/bin/bash
# Applies the CORS response-header fix to the Time Machine Edge Functions.
# Run from the repo root (the folder that contains supabase/).
set -e
test -d supabase/functions || { echo "ERROR: run this from the repo root (no supabase/ directory here)."; exit 1; }
echo "writing supabase/functions/_shared/cors.js"
cat > supabase/functions/_shared/cors.js <<'ZCORSEOF'
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
ZCORSEOF
echo "writing supabase/functions/contribute/index.js"
cat > supabase/functions/contribute/index.js <<'ZCORSEOF'
// Edge Function: contribute — submits a contribution (see _shared/handlers).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeDb } from '../_shared/db.js';
import { makeGithub } from '../_shared/githubClient.js';
import { handleContribute } from '../_shared/handlers/contribute.js';
import { withCors } from '../_shared/cors.js';

const env = { get: (k) => Deno.env.get(k) };

Deno.serve((req) => {
  const admin = createClient(env.get('SUPABASE_URL'), env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleContribute(req, {
    db: makeDb(admin),
    authApi: admin.auth,
    env,
    webhookUrl: env.get('DISCORD_WEBHOOK_URL'),
    github: makeGithub(env),
  }).then((res) => withCors(res, req, env));
});
ZCORSEOF
echo "writing supabase/functions/direct-edit/index.js"
cat > supabase/functions/direct-edit/index.js <<'ZCORSEOF'
// Edge Function: direct-edit — staff edit an archive record directly.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeDb } from '../_shared/db.js';
import { makeGithub } from '../_shared/githubClient.js';
import { handleDirectEdit } from '../_shared/handlers/directEdit.js';
import { withCors } from '../_shared/cors.js';

const env = { get: (k) => Deno.env.get(k) };

Deno.serve((req) => {
  const admin = createClient(env.get('SUPABASE_URL'), env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleDirectEdit(req, {
    db: makeDb(admin),
    authApi: admin.auth,
    env,
    webhookUrl: env.get('DISCORD_WEBHOOK_URL'),
    github: makeGithub(env),
  }).then((res) => withCors(res, req, env));
});
ZCORSEOF
echo "writing supabase/functions/review/index.js"
cat > supabase/functions/review/index.js <<'ZCORSEOF'
// Edge Function: review — moderation workflow (see _shared/handlers).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeDb } from '../_shared/db.js';
import { makeGithub } from '../_shared/githubClient.js';
import { handleReview } from '../_shared/handlers/review.js';
import { withCors } from '../_shared/cors.js';

const env = { get: (k) => Deno.env.get(k) };

Deno.serve((req) => {
  const admin = createClient(env.get('SUPABASE_URL'), env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleReview(req, {
    db: makeDb(admin),
    authApi: admin.auth,
    env,
    webhookUrl: env.get('DISCORD_WEBHOOK_URL'),
    github: makeGithub(env),
  }).then((res) => withCors(res, req, env));
});
ZCORSEOF
echo "writing supabase/functions/manage-role/index.js"
cat > supabase/functions/manage-role/index.js <<'ZCORSEOF'
// Edge Function: manage-role — appoint/revoke checkers and admins.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeDb } from '../_shared/db.js';
import { handleManageRole } from '../_shared/handlers/manageRole.js';
import { withCors } from '../_shared/cors.js';

const env = { get: (k) => Deno.env.get(k) };

Deno.serve((req) => {
  const admin = createClient(env.get('SUPABASE_URL'), env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleManageRole(req, {
    db: makeDb(admin),
    authApi: admin.auth,
    env,
    webhookUrl: env.get('DISCORD_WEBHOOK_URL'),
  }).then((res) => withCors(res, req, env));
});
ZCORSEOF
echo "writing supabase/functions/reconcile-sync/index.js"
cat > supabase/functions/reconcile-sync/index.js <<'ZCORSEOF'
// Edge Function: reconcile-sync — recover partially completed operations.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeDb } from '../_shared/db.js';
import { makeGithub } from '../_shared/githubClient.js';
import { handleReconcile } from '../_shared/handlers/reconcile.js';
import { withCors } from '../_shared/cors.js';

const env = { get: (k) => Deno.env.get(k) };

Deno.serve((req) => {
  const admin = createClient(env.get('SUPABASE_URL'), env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleReconcile(req, {
    db: makeDb(admin),
    authApi: admin.auth,
    env,
    webhookUrl: env.get('DISCORD_WEBHOOK_URL'),
    github: makeGithub(env),
  }).then((res) => withCors(res, req, env));
});
ZCORSEOF
echo
echo "---- verification: every file must show 2 ----"
grep -c withCors supabase/functions/_shared/cors.js supabase/functions/*/index.js
echo
echo "Now run:"
echo "  git add -A && git commit -m \"CORS: allow-origin on actual responses\" && git push"
echo "  for f in contribute review direct-edit manage-role reconcile-sync; do supabase functions deploy \$f; done"
