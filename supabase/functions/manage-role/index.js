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
    webhooks: { main: env.get('DISCORD_WEBHOOK_URL'), ban: env.get('DISCORD_BAN_WEBHOOK_URL') },
  }).then((res) => withCors(res, req, env));
});
