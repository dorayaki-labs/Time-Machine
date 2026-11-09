// POST /functions/v1/direct-edit — staff edit an archive record directly.
//
// Same pipeline as accepting a contribution (validate → diff → commit →
// audit → notify) minus the contribution. Nothing about a direct edit is
// invisible: actor, timestamp, previous and new values and the commit are
// all recorded in the audit log.

import { json, preflight, checkOrigin } from '../cors.js';
import { authenticate, readJson } from '../auth.js';
import { isStaff, isOwner } from '../rbac.js';
import { applyArchivePatch } from '../patch.js';
import { notify, flushOutbox, profileRef } from '../discord.js';

export async function handleDirectEdit(req, { db, authApi, env, webhooks, github }) {
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
  // Creating or deleting an archive file rewrites the repository structure
  // itself, so it is owner-only. Edits stay available to all staff.
  // (Server-side enforced; the staff editor hides the buttons for others.)
  if ((patch?.mode === 'delete' || patch?.mode === 'create') && !isOwner(profile.role)) {
    return json({ error: 'Only the owner can create or delete archive entries.' }, 403);
  }
  const reviewNotes = typeof body?.reviewNotes === 'string' ? body.reviewNotes.trim().slice(0, 2000) : null;
  if (!reviewNotes) {
    return json({ error: 'A review note is required — it is shown in the audit log, on the contribution log and to the contributor.' }, 400);
  }
  const entityType = patch?.entityType;
  const entityId = String(patch?.entityId ?? '');
  const entrySeries = entityType === 'episode' ? entityId.split('-').slice(0, 2).join('-')
    : entityType === 'movie' ? 'movies' : null;

  const applied = await applyArchivePatch(github, patch).catch((err) => ({ error: err.message }));
  if (applied.error) return json({ error: applied.error }, 422);

  const isDelete = patch.mode === 'delete';
  const event = isDelete ? 'entry_deleted' : patch.mode === 'create' ? 'entry_created' : 'direct_edit';
  const commitMessage = isDelete
    ? `archive: delete entry (${applied.entity.type} ${applied.entity.id})\n\nDeleted by ${profile.display_name}.`
    : event === 'entry_created'
      ? `archive: create entry (${applied.entity.type} ${applied.entity.id})\n\nCreated by ${profile.display_name}.`
      : `archive: direct edit (${applied.entity.type} ${applied.entity.id})\n\nEdited by ${profile.display_name}.`;
  const commitSha = await github.commit(applied.files, commitMessage).catch(() => null);
  if (!commitSha) return json({ error: 'The GitHub commit failed — nothing was changed.' }, 502);

  await db.insertAudit({
    action: isDelete ? 'archive.entry_deleted' : event === 'entry_created' ? 'archive.entry_created' : 'archive.direct_edit',
    actor_id: profile.id, actor_display_name: profile.display_name,
    entity_type: applied.entity.type, entity_id: applied.entity.id,
    changes: applied.changes, review_notes: reviewNotes, commit_sha: commitSha,
  });

  // A direct edit IS a contribution: record it as an accepted one so it
  // appears in the author's "My contributions", the public contribution log
  // and the page's activity box with the same commit and change list.
  const recordForPayload = patch.mode === 'delete' ? null : patch.record;
  const inserted = await db.insertContribution({
    contributor_id: profile.id,
    type: 'archive-edit',
    title: `${applied.entity.type} ${applied.entity.id} — ${isDelete ? 'entry removed' : 'direct edit'}`.slice(0, 200),
    entry_id: applied.entity.id,
    entry_series: entrySeries,
    payload: { record: recordForPayload, baseRecord: patch.baseRecord ?? null, note: reviewNotes },
    proposed_patch: { entityType: applied.entity.type, entityId: applied.entity.id, mode: patch.mode, record: recordForPayload },
    status: 'accepted',
    reviewer_id: profile.id,
    reviewed_at: new Date().toISOString(),
    review_reason: reviewNotes,
    commit_sha: commitSha,
    sync_state: 'committed',
  });
  await db.insertStatusHistory({
    contribution_id: inserted.id, from_status: null, to_status: 'accepted', actor_id: profile.id,
    reason: reviewNotes,
  });
  const recordTitle = patch.record
    ? (typeof patch.record.title === 'string' ? patch.record.title : patch.record.title?.en ?? null)
    : null;
  await notify(db, webhooks, `direct-edit.${commitSha}`, event, {
    actor: profileRef(profile),
    entry: { type: applied.entity.type, id: applied.entity.id, name: recordTitle },
    changes: applied.changes,
    commit: commitSha,
    notes: reviewNotes,
  });
  await flushOutbox(db, webhooks);
  return json({ ok: true, commit_sha: commitSha, changes: applied.changes, contribution: inserted.number });
}
