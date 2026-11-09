// Edge Function: manage-users — owner-only user directory, role changes and
// bans (see _shared/handlers/manageUsers.js).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeDb } from '../_shared/db.js';
import { handleManageUsers } from '../_shared/handlers/manageUsers.js';
import { withCors } from '../_shared/cors.js';

const env = { get: (k) => Deno.env.get(k) };

Deno.serve((req) => {
  const admin = createClient(env.get('SUPABASE_URL'), env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleManageUsers(req, {
    db: makeDb(admin),
    authApi: admin.auth,
    env,
    webhooks: { main: env.get('DISCORD_WEBHOOK_URL'), ban: env.get('DISCORD_BAN_WEBHOOK_URL') },
  }).then((res) => withCors(res, req, env));
});
