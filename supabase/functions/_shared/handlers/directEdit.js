// POST /functions/v1/direct-edit — staff edit an archive record directly.
//
// Same pipeline as accepting a contribution (validate → diff → commit →
// audit → notify) minus the contribution. Nothing about a direct edit is
// invisible: actor, timestamp, previous and new values and the commit are
// all recorded in the audit log.

import { json, preflight, checkOrigin } from '../cors.js';
import { authenticate, readJson } from '../auth.js';
import { isStaff } from '../rbac.js';
import { applyArchivePatch } from '../patch.js';
import { summarizeChanges } from '../diff.js';
import { enqueue, flushOutbox } from '../discord.js';

export async function handleDirectEdit(req, { db, authApi, env, webhookUrl, github }) {
  const pre = preflight(req, env);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const origin = checkOrigin(req, env);
  if (!origin.ok) return origin.response;

  const auth = await authenticate({ authApi, db }, req);
  if (auth.error) return json({ error: auth.error.message }, auth.error.code);
  const { profile } = auth;

  if (!isStaff(profile.role)) return json({ error: 'This area is for authorised staff.' }, 403);
  if (!github?.token) return json({ error: 'The backend is not configured for archive updates (missing GITHUB_TOKEN).' }, 500);

  const { body, error: bodyError } = await readJson(req);
  if (bodyError) return json({ error: bodyError }, 400);

  const patch = body?.patch;
  const reviewNotes = typeof body?.reviewNotes === 'string' ? body.reviewNotes.slice(0, 2000) : null;

  const applied = await applyArchivePatch(github, patch).catch((err) => ({ error: err.message }));
  if (applied.error) return json({ error: applied.error }, 422);

  const message = `archive: direct edit (${applied.entity.type} ${applied.entity.id})\n\nEdited by ${profile.display_name}.`;
  const commitSha = await github.commit(applied.files, message).catch(() => null);
  if (!commitSha) return json({ error: 'The GitHub commit failed — nothing was changed.' }, 502);

  await db.insertAudit({
    action: 'archive.direct_edit', actor_id: profile.id, actor_display_name: profile.display_name,
    entity_type: applied.entity.type, entity_id: applied.entity.id,
    changes: applied.changes, review_notes: reviewNotes, commit_sha: commitSha,
  });
  await enqueue(db, `direct-edit.${commitSha}`, 'direct_edit', {
    reviewer: profile.display_name,
    entry: `${applied.entity.type} ${applied.entity.id}`,
    changes: summarizeChanges(applied.changes).join('\n'),
    commit: commitSha.slice(0, 7),
  });
  await flushOutbox(db, webhookUrl);
  return json({ ok: true, commit_sha: commitSha, changes: applied.changes });
}
