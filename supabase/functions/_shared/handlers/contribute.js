// POST /functions/v1/contribute — submit a contribution.
//
// Flow: authenticate → validate payload → enforce server-side rate limits →
// insert (status pending) → status history + audit event → Discord
// notification (outbox) → return the contribution number.

import { json, preflight, checkOrigin } from '../cors.js';
import { authenticate, readJson } from '../auth.js';
import { FORM_SPECS, loadConfig } from '../formSpec.js';
import { validateContributionPayload } from '../validate.js';
import { notify, flushOutbox, profileRef } from '../discord.js';

export async function handleContribute(req, { db, authApi, env, webhooks }) {
  const pre = preflight(req, env);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const origin = checkOrigin(req, env);
  if (!origin.ok) return origin.response;

  const auth = await authenticate({ authApi, db }, req);
  if (auth.error) return json({ error: auth.error.message }, auth.error.code);
  const { profile } = auth;

  const { body, error: bodyError } = await readJson(req);
  if (bodyError) return json({ error: bodyError }, 400);

  const { type, title, entryId, entrySeries, payload, honeypot } = body ?? {};
  const spec = FORM_SPECS[type];
  if (!spec) return json({ error: 'Unknown contribution type.' }, 400);
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
    return json({ error: 'A contribution name of up to 200 characters is required.' }, 400);
  }
  // Hidden field real users never fill: bots that do are rejected outright.
  if (honeypot) return json({ error: 'Request rejected.' }, 400);

  const validation = validateContributionPayload(spec, payload ?? {});
  if (!validation.ok) return json({ errors: validation.errors, error: 'Some fields need attention.' }, 422);

  const cfg = await loadConfig(db);
  const now = Date.now();

  const latest = await db.latestSubmission(profile.id);
  if (latest?.created_at) {
    const elapsed = now - new Date(latest.created_at).getTime();
    const cooldownMs = cfg.submission_cooldown_minutes * 60_000;
    if (elapsed < cooldownMs) {
      const wait = Math.ceil((cooldownMs - elapsed) / 60_000);
      return json({ error: `Please wait ${wait} more minute(s) before submitting again.` }, 429);
    }
  }

  const pending = await db.pendingCount(profile.id);
  if (pending >= cfg.max_pending_per_user) {
    return json({ error: `You already have ${pending} submission(s) awaiting review. Please wait for them to be handled first.` }, 429);
  }

  const dayAgo = new Date(now - 24 * 60 * 60_000).toISOString();
  const todayCount = await db.countSince(profile.id, dayAgo);
  if (todayCount >= cfg.max_submissions_per_day) {
    return json({ error: 'Daily submission limit reached — please try again tomorrow.' }, 429);
  }

  const windowStart = new Date(now - cfg.duplicate_window_minutes * 60_000).toISOString();
  const duplicate = await db.findDuplicate(profile.id, type, entryId ?? null, title.trim(), windowStart);
  if (duplicate) {
    return json({ error: `This looks like a submission you already sent (#${duplicate.number}).` }, 409);
  }

  const inserted = await db.insertContribution({
    contributor_id: profile.id,
    type,
    title: title.trim(),
    entry_id: entryId ?? null,
    entry_series: entrySeries ?? null,
    payload,
    status: 'pending',
  });

  await db.insertStatusHistory({
    contribution_id: inserted.id, from_status: null, to_status: 'pending', actor_id: profile.id,
  });
  await db.insertAudit({
    contribution_id: inserted.id, contribution_number: inserted.number,
    action: 'contribution.submitted', actor_id: profile.id, actor_display_name: profile.display_name,
    entity_id: entryId ?? null,
  });
  await notify(db, webhooks, `contribution.${inserted.id}.submitted`, 'submitted', {
    number: inserted.number, title: title.trim(), type,
    contributor: profileRef(profile),
    entry: entryId ? { id: entryId } : null,
    notes: firstText(payload),
  });

  await flushOutbox(db, webhooks);
  return json({ ok: true, id: inserted.id, number: inserted.number });
}

function firstText(payload) {
  for (const key of ['notes', 'details', 'description', 'proposed']) {
    if (typeof payload?.[key] === 'string' && payload[key].trim()) return payload[key];
  }
  return null;
}
