// Edge Function: reconcile-sync — recover partially completed operations.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeDb } from '../_shared/db.js';
import { makeGithub } from '../_shared/githubClient.js';
import { handleReconcile } from '../_shared/handlers/reconcile.js';

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
  });
});
