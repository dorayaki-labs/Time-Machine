// POST /functions/v1/manage-role — appoint or revoke checkers and admins.
//
//   { action: 'grant' | 'revoke', role: 'checker' | 'admin',
//     discordId?: string, userId?: uuid, reason?: string }
//
// Only the owner manages admins; admins and the owner manage checkers. The
// owner role itself is never changed here (owner changes go through the
// documented SQL recovery procedure). Self-modification is refused.

import { json, preflight, checkOrigin } from '../cors.js';
import { authenticate, readJson } from '../auth.js';
import { checkRoleAction, isOwner } from '../rbac.js';
import { enqueue, flushOutbox } from '../discord.js';

export async function handleManageRole(req, { db, authApi, env, webhookUrl }) {
  const pre = preflight(req, env);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const origin = checkOrigin(req, env);
  if (!origin.ok) return origin.response;

  const auth = await authenticate({ authApi, db }, req);
  if (auth.error) return json({ error: auth.error.message }, auth.error.code);
  const { profile: actor } = auth;

  const { body, error: bodyError } = await readJson(req);
  if (bodyError) return json({ error: bodyError }, 400);

  const { action, role, reason } = body ?? {};
  const verdict = checkRoleAction(actor, action, role);
  if (!verdict.ok) return json({ error: verdict.message }, verdict.code);

  const target = body.discordId
    ? await db.profileByDiscordId(String(body.discordId).trim())
    : body.userId ? await db.profileById(body.userId) : null;
  if (!target) return json({ error: 'Target user not found — check the Discord ID or user ID.' }, 404);

  if (isOwner(target.role)) return json({ error: 'The owner role cannot be changed here.' }, 403);
  if (target.id === actor.id) return json({ error: 'You cannot change your own role.' }, 403);

  const newRole = action === 'grant' ? role : 'member';
  if (action === 'grant' && target.role === newRole) {
    return json({ error: `${target.display_name} already has the ${role} role.` }, 409);
  }
  if (action === 'revoke' && target.role !== role) {
    return json({ error: `${target.display_name} does not have the ${role} role.` }, 409);
  }

  await db.setProfileRole(target.id, newRole);
  await db.insertAudit({
    action: action === 'grant' ? 'role.grant' : 'role.revoke',
    actor_id: actor.id, actor_display_name: actor.display_name,
    target_user_id: target.id, target_display_name: target.display_name,
    entity_type: 'role', entity_id: role,
    review_notes: typeof reason === 'string' ? reason.slice(0, 2000) : null,
  });
  await enqueue(db, `role.${target.id}.${action}.${role}.${Date.now()}`, 'role', {
    target: target.display_name, role, action: action === 'grant' ? 'granted' : 'revoked',
    actor: actor.display_name,
  });
  await flushOutbox(db, webhookUrl);
  return json({ ok: true, userId: target.id, role: newRole, display_name: target.display_name });
}
