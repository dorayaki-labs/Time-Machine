// POST /functions/v1/manage-users — owner-only user management.
//
//   { action: 'list', q?, role?, banned?, limit? }
//   { action: 'set-role', userId, role: 'member'|'checker'|'admin' }
//   { action: 'ban', userId, reason? }
//   { action: 'unban', userId }
//
// EVERY branch re-checks the caller's role server-side (owner only) and the
// target's state (rbac.js). Ban enforcement itself lives in authenticate()
// and applies to every protected function, not just these actions. All
// actions land in the append-only audit_logs; bans and unbans also notify
// Discord through the existing outbox.

import { json, preflight, checkOrigin } from '../cors.js';
import { authenticate, readJson } from '../auth.js';
import { isOwner, checkSetRoleAction, canBanUser, canUnbanUser } from '../rbac.js';
import { notify, flushOutbox, profileRef } from '../discord.js';

export async function handleManageUsers(req, { db, authApi, env, webhooks }) {
  const pre = preflight(req, env);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const origin = checkOrigin(req, env);
  if (!origin.ok) return origin.response;

  const auth = await authenticate({ authApi, db }, req);
  if (auth.error) return json({ error: auth.error.message }, auth.error.code);
  const { profile: actor } = auth;
  if (!isOwner(actor.role)) return json({ error: 'This panel is only available to the project owner.' }, 403);

  const { body, error: bodyError } = await readJson(req);
  if (bodyError) return json({ error: bodyError }, 400);
  const { action } = body ?? {};

  // -------------------------------------------------------------------- list
  if (action === 'list') {
    const limit = Math.min(Math.max(Number(body?.limit) || 200, 1), 500);
    const role = ['member', 'checker', 'admin', 'owner'].includes(body?.role) ? body.role : null;
    const banned = body?.banned === true ? true : body?.banned === false ? false : null;
    const [users, counts] = await Promise.all([
      db.listProfiles({ q: typeof body?.q === 'string' ? body.q.slice(0, 80) : '', role, banned, limit }),
      db.contributionCounts(),
    ]);
    const byId = new Map(counts.map((c) => [c.profile_id, c]));
    return json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        discord_id: u.discord_id,
        username: u.username,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        role: u.role,
        banned: Boolean(u.banned),
        ban_reason: u.banned ? (u.ban_reason ?? null) : null,
        banned_at: u.banned ? (u.banned_at ?? null) : null,
        ban_lifted_at: u.ban_lifted_at ?? null,
        created_at: u.created_at ?? null,
        stats: {
          total: byId.get(u.id)?.total_submitted ?? 0,
          accepted: byId.get(u.id)?.accepted ?? 0,
          pending: byId.get(u.id)?.pending ?? 0,
        },
      })),
    });
  }

  // set-role / ban / unban target a user by uuid (owner panel) or Discord id
  // (the staff admin tab), mirroring manage-role. Any all-digit id is a valid
  // lookup key here — length rules belong to manual form entry, not lookups.
  const userId = typeof body?.userId === 'string' ? body.userId : null;
  const discordId = typeof body?.discordId === 'string' ? body.discordId.trim() : '';
  if (!userId && !/^\d{1,25}$/.test(discordId)) {
    return json({ error: 'A userId or a numeric discordId is required.' }, 400);
  }
  const target = userId
    ? await db.profileById(userId)
    : await db.profileByDiscordId(discordId);
  if (!target) return json({ error: 'Target user not found — check the Discord ID or user ID.' }, 404);

  // ---------------------------------------------------------------- set-role
  if (action === 'set-role') {
    const verdict = checkSetRoleAction(actor, target, body?.role);
    if (!verdict.ok) return json({ error: verdict.message }, verdict.code);
    const previousRole = target.role;
    await db.setProfileRole(target.id, body.role);
    await db.insertAudit({
      action: body.role === 'member' ? 'role.demote' : 'role.grant',
      actor_id: actor.id, actor_display_name: actor.display_name,
      target_user_id: target.id, target_display_name: target.display_name,
      entity_type: 'role', entity_id: body.role,
      changes: [{ field: 'role', before: previousRole, after: body.role }],
      review_notes: typeof body?.reason === 'string' ? body.reason.slice(0, 2000) : null,
    });
    await notify(db, webhooks, `role.${target.id}.set.${body.role}.${Date.now()}`, 'role', {
      actor: profileRef(actor), target: profileRef(target),
      role: body.role, action: 'set to',
    });
    await flushOutbox(db, webhooks);
    return json({ ok: true, userId: target.id, role: body.role, display_name: target.display_name });
  }

  // --------------------------------------------------------------------- ban
  if (action === 'ban') {
    if (!canBanUser(actor.role, target)) {
      return json({ error: 'You cannot ban this account (owner accounts are protected).' }, 403);
    }
    if (target.banned) return json({ error: `${target.display_name} is already banned.` }, 409);
    const reason = typeof body?.reason === 'string' && body.reason.trim()
      ? body.reason.trim().slice(0, 2000) : null;
    await db.setBanState(target.id, { banned: true, reason, bannedBy: actor.id });
    await db.insertAudit({
      action: 'user.banned', actor_id: actor.id, actor_display_name: actor.display_name,
      target_user_id: target.id, target_display_name: target.display_name,
      entity_type: 'ban', entity_id: target.discord_id,
      review_notes: reason, changes: [{ field: 'banned', before: false, after: true }],
    });
    await notify(db, webhooks, `user.${target.id}.banned.${Date.now()}`, 'banned', {
      target: profileRef(target), actor: profileRef(actor), reason,
    });
    await flushOutbox(db, webhooks);
    return json({ ok: true, userId: target.id, banned: true, display_name: target.display_name });
  }

  // ------------------------------------------------------------------- unban
  if (action === 'unban') {
    if (!canUnbanUser(actor.role, target)) {
      return json({ error: 'You cannot lift this ban (owner accounts are protected).' }, 403);
    }
    if (!target.banned) return json({ error: `${target.display_name} is not banned.` }, 409);
    await db.setBanState(target.id, { banned: false });
    await db.insertAudit({
      action: 'user.unbanned', actor_id: actor.id, actor_display_name: actor.display_name,
      target_user_id: target.id, target_display_name: target.display_name,
      entity_type: 'ban', entity_id: target.discord_id,
      changes: [{ field: 'banned', before: true, after: false }],
    });
    await notify(db, webhooks, `user.${target.id}.unbanned.${Date.now()}`, 'unbanned', {
      target: profileRef(target), actor: profileRef(actor),
    });
    await flushOutbox(db, webhooks);
    return json({ ok: true, userId: target.id, banned: false, display_name: target.display_name });
  }

  return json({ error: 'action must be list, set-role, ban or unban.' }, 400);
}
