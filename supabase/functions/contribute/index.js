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
    webhooks: { main: env.get('DISCORD_WEBHOOK_URL'), ban: env.get('DISCORD_BAN_WEBHOOK_URL') },
    github: makeGithub(env),
  }).then((res) => withCors(res, req, env));
});
